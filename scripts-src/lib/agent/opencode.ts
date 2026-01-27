/**
 * Open Code runtime implementation
 *
 * Executes prompts using the `opencode` CLI with support for:
 * - Streaming JSON output with colored formatting
 * - Real-time text display
 * - Tool use and tool result formatting
 * - Model selection
 * - Automated and interactive modes
 */

import chalk from "chalk";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { formatToolResult, formatToolUse } from "./formatting.js";
import type { LLMRuntime, Model, PromptOptions, PromptResult } from "./types.js";


/**
 * Open Code runtime implementation
 */
export const opencodeRuntime: LLMRuntime = {
  name: "opencode",
  displayName: "Open Code",
  supportsStreaming: true,
  supportsTokenTracking: false,

  async runPrompt(
    prompt: string,
    options?: PromptOptions
  ): Promise<PromptResult> {
    const startTime = Date.now();
    const args: string[] = ["run"];

    // Build command arguments
    if (options?.automated) {
      args.push("--format", "json");
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    // Add the prompt
    args.push(prompt);

    return new Promise((resolve) => {
      let output = "";

      const proc = spawn("opencode", args, {
        stdio: ["inherit", "pipe", "pipe"],
        cwd: options?.workingDirectory,
        shell: false,
      });

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

            // Handle different event structures from opencode
            // Try to extract the event type from various possible locations
            const eventType = event.type || event.event || (event.part?.type);

            switch (eventType) {
              case "step_start":
              case "step-start":
                // Show session info with dim formatting
                const sessionId = event.session_id || event.sessionId || event.session;
                if (sessionId) {
                  console.log(
                    chalk.dim(`  Session: ${String(sessionId).substring(0, 8)}...`)
                  );
                }
                break;

              case "tool_use":
              case "tool-use":
              case "tool_call":
              case "tool-call":
                // Tool use event - show tool name and args, then result
                // opencode format: { type, part: { tool, state: { input, output, ... } } }
                const part = event.part || event;
                const state = part.state || part;
                const toolName = part.tool || part.name || event.tool || event.name || "tool";
                const toolInput = state.input || part.input || event.input || {};
                const formattedToolName = toolName.charAt(0).toUpperCase() + toolName.slice(1);
                const toolDisplay = formatToolUse(formattedToolName, toolInput);
                console.log(chalk.cyan(`  > ${toolDisplay}`));

                // Show tool result if available
                const toolOutput = state.output || part.output || event.output;
                if (toolOutput) {
                  // For write operations, show the file path and content preview
                  if (formattedToolName === "Write" && toolInput.filePath) {
                    console.log(chalk.dim(`    | Wrote: ${toolInput.filePath}`));
                    // Show a preview of the content
                    if (toolInput.content && typeof toolInput.content === "string") {
                      const lines = toolInput.content.split("\n");
                      const previewLines = lines.slice(0, 8);
                      for (const line of previewLines) {
                        console.log(chalk.dim(`    | ${line}`));
                      }
                      if (lines.length > 8) {
                        console.log(chalk.dim(`    | ... (${lines.length - 8} more lines)`));
                      }
                    }
                  } else {
                    const resultPreview = formatToolResult(toolOutput, formattedToolName);
                    if (resultPreview) {
                      console.log(resultPreview);
                    }
                  }
                }

                // Show non-zero exit codes in yellow (check metadata.exit for bash)
                const exitCode = state.metadata?.exit ?? state.exitCode ?? part.exitCode ?? event.exitCode;
                if (exitCode !== undefined && exitCode !== 0) {
                  console.log(chalk.yellow(`    Exit code: ${exitCode}`));
                }
                break;

              case "text":
              case "text_delta":
              case "text-delta":
              case "assistant":
                // Display text output from the model
                // opencode format: { type: "text", part: { text: "..." } }
                const textPart = event.part || event;
                const text = textPart.text || event.text || event.content || event.delta || "";
                if (text) {
                  process.stdout.write(text);
                  output += text;
                }
                break;

              case "error":
                // Show errors in red
                const errorPart = event.part || event;
                let errorMsg = errorPart.error || errorPart.message || event.error || event.message;
                // Handle object errors
                if (errorMsg && typeof errorMsg === "object") {
                  errorMsg = errorMsg.message || errorMsg.error || JSON.stringify(errorMsg);
                }
                if (errorMsg) {
                  console.log(chalk.red(`  Error: ${errorMsg}`));
                }
                break;

              case "thinking":
              case "thinking_delta":
              case "reasoning":
                // Display thinking/reasoning in dim blue
                const thinkingPart = event.part || event;
                const thinking = thinkingPart.text || thinkingPart.thinking || event.thinking || event.text || "";
                if (thinking) {
                  process.stdout.write(chalk.blueBright.dim(thinking));
                  output += thinking;
                }
                break;

              case "result":
              case "done":
              case "complete":
                // Display completion time in dim if available
                const durationMs = event.duration_ms || event.durationMs || event.duration;
                if (durationMs) {
                  console.log(
                    chalk.dim(`  Completed in ${(Number(durationMs) / 1000).toFixed(1)}s`)
                  );
                }
                break;

              default:
                // For unknown events, try to display any text content
                const anyText = event.text || event.content || event.part?.text || event.part?.content;
                if (anyText) {
                  process.stdout.write(anyText);
                  output += anyText;
                } else if (options?.verbose) {
                  console.log(chalk.yellow(`[VERBOSE] Unknown event: ${JSON.stringify(event).substring(0, 200)}`));
                }
                break;
            }
          } catch {
            // Not JSON, print as-is (fallback for non-automated mode)
            console.log(line);
            output += line + "\n";
          }
        } else {
          output += line + "\n";
        }
      });

      // Also handle stderr - opencode may output JSON events there
      const stderrRl = createInterface({ input: proc.stderr });
      stderrRl.on("line", (line) => {
        // Skip INFO/WARN/ERROR log lines
        if (line.startsWith("INFO") || line.startsWith("WARN") || line.startsWith("ERROR") || line.startsWith("DEBUG")) {
          return;
        }
        output += line + "\n";
        if (options?.streamOutput) {
          // Try to parse as JSON, otherwise just print
          try {
            const event = JSON.parse(line);
            // Handle text events from stderr
            const text = event.text || event.content || event.delta;
            if (text) {
              process.stdout.write(text);
            }
          } catch {
            // Not JSON, print as-is
            console.error(line);
          }
        }
      });

      proc.on("close", (code) => {
        const durationMs = Date.now() - startTime;
        const exitCode = code ?? 1;

        resolve({
          success: exitCode === 0,
          output,
          exitCode,
          durationMs,
        });
      });

      proc.on("error", (err) => {
        const durationMs = Date.now() - startTime;
        resolve({
          success: false,
          output: err.message,
          exitCode: 1,
          durationMs,
        });
      });
    });
  },

  async listModels(): Promise<Model[]> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      const proc = spawn("opencode", ["models"], {
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
      });

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          const models: Model[] = [];
          // Combine stdout and stderr (opencode may write to either)
          const allOutput = stdout + stderr;
          const lines = allOutput.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines and INFO/log lines
            if (!trimmed || trimmed.startsWith("INFO") || trimmed.startsWith("WARN") || trimmed.startsWith("ERROR")) {
              continue;
            }
            // Model IDs look like "provider/model-name" (e.g., "opencode/big-pickle")
            if (trimmed.includes("/")) {
              const parts = trimmed.split("/");
              const provider = parts[0];
              const modelName = parts.slice(1).join("/");
              // Create display name from model ID (e.g., "big-pickle" -> "Big Pickle")
              const displayName = modelName
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
              models.push({
                id: trimmed,
                name: displayName,
                description: `Provider: ${provider}`,
              });
            }
          }
          resolve(models);
        } else {
          resolve([]);
        }
      });

      proc.on("error", () => {
        resolve([]);
      });
    });
  },

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["opencode"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  },
};
