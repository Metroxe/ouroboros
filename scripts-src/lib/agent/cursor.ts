/**
 * Agent Cursor runtime implementation
 *
 * Executes prompts using the `agent` CLI with support for:
 * - Streaming JSON output with colored formatting
 * - Real-time text deltas and thinking display
 * - Tool use and tool result formatting
 * - Model selection
 * - Automated and interactive modes
 * - Loop detection for repeated failing tool calls
 */

import chalk from "chalk";
import { createHash } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import { formatToolResult, formatToolUse } from "./formatting.js";
import type { LLMRuntime, Model, PromptOptions, PromptResult } from "./types.js";

/**
 * Loop detection configuration
 */
const LOOP_THRESHOLD = 3; // Number of identical calls/errors to trigger loop detection
const RECENT_CALLS_LIMIT = 10; // Number of recent calls to track

/**
 * State for tracking potential infinite loops
 */
interface LoopDetectionState {
  /** Recent tool call hashes (tool name + args) */
  recentCallHashes: string[];
  /** Recent error messages */
  recentErrors: string[];
  /** Currently pending tool calls (call_id -> hash) */
  pendingCalls: Map<string, string>;
}

/**
 * Create a hash of a tool call for comparison
 * Exported for testing
 */
export function hashToolCall(toolName: string, args: unknown): string {
  const content = JSON.stringify({ toolName, args });
  return createHash("md5").update(content).digest("hex").substring(0, 16);
}

/**
 * Check if the last N items in an array are all identical
 * Exported for testing
 */
export function hasRepeatedItems(items: string[], threshold: number): boolean {
  if (items.length < threshold) return false;
  const lastN = items.slice(-threshold);
  return lastN.every((item) => item === lastN[0]);
}

/**
 * Extract error message from tool result
 * Exported for testing
 */
export function extractErrorFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;

  const obj = result as Record<string, unknown>;

  // Check for error wrapper: { error: { error: "...", modelVisibleError: "..." } }
  if (obj.error && typeof obj.error === "object") {
    const errorObj = obj.error as Record<string, unknown>;
    if (typeof errorObj.modelVisibleError === "string") {
      return errorObj.modelVisibleError;
    }
    if (typeof errorObj.error === "string") {
      return errorObj.error;
    }
  }

  // Check for direct error field
  if (typeof obj.error === "string") {
    return obj.error;
  }

  return null;
}

/**
 * Parse models from `agent models` command output
 * Exported for testing
 *
 * Handles formats like:
 *   - "auto - Auto"
 *   - "gpt-5.2-codex - GPT-5.2 Codex  (current)"
 *   - "  8) opus-4.5-thinking - Claude 4.5 Opus (Thinking)"
 */
export function parseModelsOutput(stdout: string): Model[] {
  const models: Model[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and header/footer lines
    if (
      !trimmed ||
      trimmed.startsWith("Available") ||
      trimmed.startsWith("---") ||
      trimmed.startsWith("Tip:")
    ) {
      continue;
    }

    // Remove optional leading number prefix like "8) " or "* 8) "
    const withoutPrefix = trimmed.replace(/^[*\s]*\d+\)\s*/, "");

    // Split on " - " to separate ID from description
    const separatorIndex = withoutPrefix.indexOf(" - ");
    if (separatorIndex === -1) {
      continue; // No separator found, skip this line
    }

    const id = withoutPrefix.slice(0, separatorIndex).trim();
    const description = withoutPrefix.slice(separatorIndex + 3).trim();

    if (id) {
      models.push({
        id,
        name: description || id,
        description: description || undefined,
      });
    }
  }

  return models;
}

/**
 * Agent Cursor runtime implementation
 */
export const cursorRuntime: LLMRuntime = {
  name: "cursor",
  displayName: "Agent Cursor",
  supportsStreaming: true,
  supportsTokenTracking: false,

  async runPrompt(
    prompt: string,
    options?: PromptOptions
  ): Promise<PromptResult> {
    const startTime = Date.now();
    const args: string[] = [];

    // Build command arguments
    if (options?.automated) {
      args.push("-p", "--force", "--output-format", "stream-json");
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    // Disable sandbox to enable access to authenticated gh CLI and system credentials
    args.push("--sandbox", "disabled");

    args.push(prompt);

    return new Promise((resolve) => {
      let output = "";
      let thinkingStarted = false;
      let loopDetected = false;

      // Loop detection state
      const loopState: LoopDetectionState = {
        recentCallHashes: [],
        recentErrors: [],
        pendingCalls: new Map(),
      };

      const proc = spawn("agent", args, {
        stdio: ["inherit", "pipe", "pipe"],
        cwd: options?.workingDirectory,
        shell: false,
      });

      /**
       * Check for loop patterns and kill process if detected
       */
      const checkAndHandleLoop = (proc: ChildProcess): boolean => {
        // Check for repeated call hashes
        if (hasRepeatedItems(loopState.recentCallHashes, LOOP_THRESHOLD)) {
          console.log(
            chalk.red(
              `\n  Loop detected: Same tool call repeated ${LOOP_THRESHOLD} times`
            )
          );
          loopDetected = true;
          proc.kill("SIGKILL");
          return true;
        }

        // Check for repeated errors
        if (hasRepeatedItems(loopState.recentErrors, LOOP_THRESHOLD)) {
          console.log(
            chalk.red(
              `\n  Loop detected: Same error repeated ${LOOP_THRESHOLD} times`
            )
          );
          loopDetected = true;
          proc.kill("SIGKILL");
          return true;
        }

        return false;
      };

      const rl = createInterface({ input: proc.stdout });

      rl.on("line", (line) => {
        if (options?.streamOutput) {
          // Parse and display streaming output with colors
          try {
            const event = JSON.parse(line);

            // Verbose mode: print raw JSON before formatted output
            if (options?.verbose) {
              console.log(chalk.gray(`[VERBOSE] ${line}`));
            }

            switch (event.type) {
              case "system":
                // Subtype: init - show session ID with dim formatting
                if (event.subtype === "init" && event.session_id) {
                  console.log(
                    chalk.dim(`  Session: ${event.session_id.substring(0, 8)}...`)
                  );
                }
                break;

              case "thinking":
                // Subtype: delta - show thinking output in magenta
                if (event.subtype === "delta" && event.text) {
                  if (!thinkingStarted) {
                    process.stdout.write(chalk.magenta("[Thinking] "));
                    thinkingStarted = true;
                  }
                  process.stdout.write(chalk.magenta(event.text));
                  output += event.text;
                }
                // Subtype: completed - finalize thinking display
                else if (event.subtype === "completed") {
                  if (thinkingStarted) {
                    console.log(""); // Newline after thinking block
                    thinkingStarted = false;
                  }
                }
                break;

              case "tool_call":
                // Subtype: started - show tool name and args preview in cyan
                if (event.tool_call && event.subtype === "started") {
                  const toolKeys = Object.keys(event.tool_call);
                  for (const key of toolKeys) {
                    const toolData = event.tool_call[key];
                    // Extract tool name from key (e.g., "readToolCall" -> "Read")
                    const toolName = key
                      .replace(/ToolCall$/, "")
                      .replace(/^./, (c) => c.toUpperCase());
                    const toolDisplay = formatToolUse(toolName, toolData.args || {});
                    console.log(chalk.cyan(`  > ${toolDisplay}`));

                    // Track this call for loop detection
                    const callHash = hashToolCall(toolName, toolData.args || {});
                    if (event.call_id) {
                      loopState.pendingCalls.set(event.call_id, callHash);
                    }
                  }
                }
                // Subtype: completed - show tool results and check for loops
                else if (event.tool_call && event.subtype === "completed") {
                  const toolKeys = Object.keys(event.tool_call);
                  for (const key of toolKeys) {
                    const toolData = event.tool_call[key];

                    // Extract tool name from key
                    const toolName = key
                      .replace(/ToolCall$/, "")
                      .replace(/^./, (c) => c.toUpperCase());

                    // Get the call hash from pending calls or generate a new one
                    let callHash = event.call_id
                      ? loopState.pendingCalls.get(event.call_id)
                      : undefined;
                    if (!callHash) {
                      callHash = hashToolCall(toolName, toolData.args || {});
                    }

                    // Check for errors in the result
                    const errorMessage = extractErrorFromResult(toolData.result);
                    if (errorMessage) {
                      // Track this call hash and error
                      loopState.recentCallHashes.push(callHash);
                      loopState.recentErrors.push(errorMessage);

                      // Keep only the last N items
                      if (loopState.recentCallHashes.length > RECENT_CALLS_LIMIT) {
                        loopState.recentCallHashes.shift();
                      }
                      if (loopState.recentErrors.length > RECENT_CALLS_LIMIT) {
                        loopState.recentErrors.shift();
                      }

                      // Check for loop patterns
                      if (checkAndHandleLoop(proc)) {
                        return; // Process killed, stop processing
                      }
                    } else {
                      // Successful call resets the error tracking
                      loopState.recentErrors = [];
                    }

                    // Clean up pending call
                    if (event.call_id) {
                      loopState.pendingCalls.delete(event.call_id);
                    }

                    if (toolData.result) {
                      const resultPreview = formatToolResult(toolData.result, toolName);
                      if (resultPreview) {
                        console.log(resultPreview);
                      }
                    }
                    // Show non-zero exit codes in yellow
                    if (toolData.exitCode !== undefined && toolData.exitCode !== 0) {
                      console.log(chalk.yellow(`    Exit code: ${toolData.exitCode}`));
                    }
                  }
                }
                break;

              case "assistant":
                // Display assistant message content
                if (event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === "text" && block.text) {
                      console.log(block.text);
                      output += block.text + "\n";
                    }
                  }
                }
                break;

              case "result":
                // Display completion time in dim
                if (event.duration_ms) {
                  console.log(
                    chalk.dim(`  Completed in ${(event.duration_ms / 1000).toFixed(1)}s`)
                  );
                }
                break;

              case "error":
                // Show errors in red
                if (event.message) {
                  console.log(chalk.red(`  Error: ${event.message}`));
                }
                break;

              default:
                // Log unknown event types only in verbose mode
                if (options?.verbose) {
                  console.log(chalk.yellow(`[VERBOSE] Unknown event type: ${event.type}`));
                }
                break;
            }
          } catch {
            // Not JSON, print as-is
            console.log(line);
            output += line + "\n";
          }
        } else {
          output += line + "\n";
        }
      });

      proc.stderr.on("data", (data) => {
        output += data.toString();
        if (options?.streamOutput) {
          process.stderr.write(data);
        }
      });

      proc.on("close", (code) => {
        const durationMs = Date.now() - startTime;
        const exitCode = code ?? 1;

        resolve({
          success: exitCode === 0 && !loopDetected,
          output,
          exitCode,
          durationMs,
          loopDetected,
        });
      });

      proc.on("error", (err) => {
        const durationMs = Date.now() - startTime;
        resolve({
          success: false,
          output: err.message,
          exitCode: 1,
          durationMs,
          loopDetected,
        });
      });
    });
  },

  async listModels(): Promise<Model[]> {
    return new Promise((resolve) => {
      let stdout = "";

      const proc = spawn("agent", ["models"], {
        stdio: ["inherit", "pipe", "pipe"],
      });

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          const models = parseModelsOutput(stdout);
          if (models.length > 0) {
            resolve(models);
            return;
          }
        }
        // Return fallback models if command fails or returns empty
        resolve([
          { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
          { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
          { id: "gpt-4o", name: "GPT-4o" },
          { id: "o3", name: "o3" },
        ]);
      });

      proc.on("error", () => {
        // Return fallback models if command fails
        resolve([
          { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
          { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
          { id: "gpt-4o", name: "GPT-4o" },
        ]);
      });
    });
  },

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["agent"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  },
};
