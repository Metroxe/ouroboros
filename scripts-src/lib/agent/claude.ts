/**
 * Claude Code runtime implementation
 *
 * Executes prompts using the `claude` CLI with support for:
 * - JSON output parsing
 * - Token usage tracking
 * - Model selection
 * - Automated and interactive modes
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import type {
  LLMRuntime,
  Model,
  PromptOptions,
  PromptResult,
  TokenUsage,
} from "./types.js";

/**
 * Parse JSON output from Claude CLI to extract usage info
 */
function parseUsage(output: string): { tokenUsage?: TokenUsage; costUsd?: number } {
  const lines = output.split("\n");
  let tokenUsage: TokenUsage | undefined;
  let costUsd: number | undefined;

  for (const line of lines) {
    try {
      if (line.trim().startsWith("{")) {
        const data = JSON.parse(line);
        if (data.type === "usage" || (data.type === "result" && data.usage)) {
          const usage = data.usage || data;
          tokenUsage = {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            cacheCreationTokens: usage.cache_creation_input_tokens || 0,
          };
          if (data.total_cost_usd) {
            costUsd = data.total_cost_usd;
          }
        }
      }
    } catch {
      // Ignore non-JSON lines
    }
  }

  return { tokenUsage, costUsd };
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

    if (options?.automated) {
      args.push("--dangerously-skip-permissions");
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    // Add the prompt
    args.push(prompt);

    return new Promise((resolve) => {
      let output = "";
      
      const proc = spawn("claude", args, {
        stdio: ["inherit", "pipe", "pipe"],
        cwd: options?.workingDirectory,
        shell: true,
      });

      const rl = createInterface({ input: proc.stdout });

      rl.on("line", (line) => {
        output += line + "\n";
        if (options?.streamOutput) {
          console.log(line);
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
        const { tokenUsage, costUsd } = parseUsage(output);

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
    return new Promise((resolve) => {
      let stdout = "";
      // Claude Code doesn't have a direct 'models' command, but we can try to get hints
      // or return a standard list. For now, we'll keep the standard list but
      // structure it as a promise for future API integration.
      resolve([
        { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-opus-latest", name: "Claude 3 Opus" },
        { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku" },
      ]);
    });
  },

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["claude"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  },
};
