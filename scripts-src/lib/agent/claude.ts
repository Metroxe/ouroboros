/**
 * Claude Code runtime implementation
 *
 * Executes prompts using the `claude` CLI with support for:
 * - Streaming JSON output with block tracking
 * - Real-time text deltas and thinking display
 * - Tool use and tool result formatting
 * - Token usage tracking
 * - Model selection
 * - Automated and interactive modes
 */

import chalk from "chalk";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { formatToolResult, formatToolUse } from "./formatting.js";
import type {
  LLMRuntime,
  Model,
  PromptOptions,
  PromptResult,
  TokenUsage,
} from "./types.js";

/**
 * Block tracking entry for streaming
 * Tracks content blocks by index during streaming
 */
interface StreamingBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  name?: string;
  input?: string;
  content?: string;
}

/**
 * Parse streaming JSON events from Claude CLI
 * Extracts token usage and cost information
 */
function parseStreamingOutput(jsonLines: string[]): {
  tokenUsage?: TokenUsage;
  costUsd?: number;
} {
  let tokenUsage: TokenUsage | undefined;
  let costUsd: number | undefined;

  for (const line of jsonLines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "result" && event.usage) {
        tokenUsage = {
          inputTokens: event.usage.input_tokens || 0,
          outputTokens: event.usage.output_tokens || 0,
          cacheReadTokens: event.usage.cache_read_input_tokens || 0,
          cacheCreationTokens: event.usage.cache_creation_input_tokens || 0,
        };
        costUsd = event.total_cost_usd;
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return { tokenUsage, costUsd };
}

/**
 * Format number with commas for display
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Claude Code runtime implementation
 */
export const claudeRuntime: LLMRuntime = {
  name: "claude",
  displayName: "Claude Code",
  supportsStreaming: true,
  supportsTokenTracking: true,

  async runPrompt(
    prompt: string,
    options?: PromptOptions
  ): Promise<PromptResult> {
    const startTime = Date.now();
    const args: string[] = [];

    // Build command arguments
    if (options?.automated) {
      args.push("--dangerously-skip-permissions", "-p", "--verbose");
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    if (options?.automated) {
      args.push("--output-format", "stream-json");
    }

    args.push(prompt);

    return new Promise((resolve) => {
      let output = "";
      const jsonLines: string[] = [];
      let thinkingStarted = false;

      // Block tracking system - track blocks by their index
      const blocks: Record<number, StreamingBlock> = {};

      const proc = spawn("claude", args, {
        stdio: ["inherit", "pipe", "pipe"],
        cwd: options?.workingDirectory,
        shell: false,
      });

      const rl = createInterface({ input: proc.stdout });

      rl.on("line", (line) => {
        jsonLines.push(line);

        if (options?.streamOutput) {
          // Parse and display streaming output
          try {
            const event = JSON.parse(line);

            // Verbose mode: print raw JSON before formatted output
            if (options?.verbose) {
              console.log(chalk.gray(`[VERBOSE] ${line}`));
            }

            // Handle content_block_start - begin tracking new blocks
            if (event.type === "content_block_start") {
              const idx = event.index;
              if (event.content_block?.type === "tool_use") {
                blocks[idx] = {
                  type: "tool_use",
                  name: event.content_block.name || "tool",
                  input: "",
                };
              } else if (event.content_block?.type === "text") {
                blocks[idx] = { type: "text", content: "" };
              } else if (event.content_block?.type === "tool_result") {
                blocks[idx] = { type: "tool_result", content: "" };
              } else if (event.content_block?.type === "thinking") {
                blocks[idx] = { type: "thinking", content: "" };
              }
            }
            // Handle content_block_delta - accumulate content
            else if (event.type === "content_block_delta") {
              const idx = event.index;

              // Text delta - stream in real-time
              if (event.delta?.type === "text_delta" && event.delta?.text) {
                process.stdout.write(event.delta.text);
                output += event.delta.text;
                if (blocks[idx]) {
                  blocks[idx].content =
                    (blocks[idx].content || "") + event.delta.text;
                }
              }
              // Thinking delta - stream in magenta with [Thinking] prefix
              else if (
                event.delta?.type === "thinking_delta" &&
                event.delta?.thinking
              ) {
                if (!thinkingStarted) {
                  process.stdout.write(chalk.magenta("[Thinking] "));
                  thinkingStarted = true;
                }
                process.stdout.write(chalk.magenta(event.delta.thinking));
                output += event.delta.thinking;
                if (blocks[idx]) {
                  blocks[idx].content =
                    (blocks[idx].content || "") + event.delta.thinking;
                }
              }
              // Tool input JSON delta - accumulate for later display
              else if (
                event.delta?.type === "input_json_delta" &&
                event.delta?.partial_json
              ) {
                if (blocks[idx]) {
                  blocks[idx].input =
                    (blocks[idx].input || "") + event.delta.partial_json;
                }
              }
            }
            // Handle content_block_stop - display completed blocks
            else if (event.type === "content_block_stop") {
              const idx = event.index;
              const block = blocks[idx];

              if (block && block.type === "tool_use") {
                // Show what tool was used with its input
                const toolDisplay = formatToolUse(
                  block.name || "tool",
                  block.input || ""
                );
                console.log(chalk.cyan(`  > ${toolDisplay}`));
              } else if (block && block.type === "tool_result") {
                // Show tool result (detect tool type from content structure)
                const resultPreview = formatToolResult(block.content);
                if (resultPreview) {
                  console.log(resultPreview);
                }
              } else if (block && block.type === "thinking") {
                // End thinking block with newline
                if (thinkingStarted) {
                  console.log(""); // Newline after thinking block
                  thinkingStarted = false;
                }
              }

              // Clean up block tracking
              delete blocks[idx];
            }
            // Handle assistant message - final message content
            else if (event.type === "assistant") {
              if (event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === "text" && block.text) {
                    console.log(block.text);
                    output += block.text + "\n";
                  } else if (block.type === "tool_use") {
                    // Tool use in final message
                    const toolDisplay = formatToolUse(block.name, block.input);
                    console.log(chalk.cyan(`  > ${toolDisplay}`));
                  } else if (block.type === "tool_result") {
                    // Tool result in final message
                    if (block.content) {
                      console.log(formatToolResult(block.content));
                    }
                  }
                }
              }
            }
            // Handle user message - often contains tool results
            else if (event.type === "user") {
              if (event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === "tool_result") {
                    // Show tool result with preview
                    const resultPreview = formatToolResult(block.content);
                    if (resultPreview) {
                      console.log(resultPreview);
                    }
                  }
                }
              }
            }
            // Handle result - token usage and cost
            else if (event.type === "result") {
              if (event.total_cost_usd) {
                console.log("");
                console.log(
                  chalk.dim(
                    `  Step cost: ${formatCost(event.total_cost_usd)} | ` +
                      `${formatNumber(event.usage?.input_tokens || 0)} in / ` +
                      `${formatNumber(event.usage?.output_tokens || 0)} out`
                  )
                );
              }
            }
            // Log unknown event types only in verbose mode
            else if (options?.verbose) {
              const knownTypes = [
                "content_block_start",
                "content_block_delta",
                "content_block_stop",
                "assistant",
                "user",
                "result",
                "message_start",
                "message_delta",
                "message_stop",
                "ping",
              ];
              if (!knownTypes.includes(event.type)) {
                console.log(chalk.yellow(`[VERBOSE] Unknown event type: ${event.type}`));
              }
            }
          } catch {
            // Not JSON, just capture it
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
        if (options?.streamOutput) {
          console.log(""); // Newline after output
        }
        const durationMs = Date.now() - startTime;
        const exitCode = code ?? 1;
        const { tokenUsage, costUsd } = parseStreamingOutput(jsonLines);

        resolve({
          success: exitCode === 0,
          output,
          exitCode,
          durationMs,
          tokenUsage,
          costUsd,
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
    // Claude Code CLI doesn't have a models list command
    // Return known models
    return [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description: "Balanced performance and cost",
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        description: "Most capable model",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Previous generation",
      },
    ];
  },

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["claude"]);
      proc.on("close", (code) => {
        resolve(code === 0);
      });
      proc.on("error", () => {
        resolve(false);
      });
    });
  },
};
