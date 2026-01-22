/**
 * Agent Cursor runtime implementation
 *
 * Executes prompts using the `agent` CLI with support for:
 * - Streaming JSON output
 * - Model selection
 * - Automated and interactive modes
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import type { LLMRuntime, Model, PromptOptions, PromptResult } from "./types.js";

/**
 * Parse models from `agent models` command output
 * Exported for testing
 */
export function parseModelsOutput(stdout: string): Model[] {
  const models: Model[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    // Skip header/separator lines
    if (
      !line ||
      line.includes("Available") ||
      line.includes("---") ||
      line.includes("Tip:")
    ) {
      continue;
    }

    // Extract model info from lines like: "  8) opus-4.5-thinking - Claude 4.5 Opus (Thinking)"
    const cleaned = line.replace(/^[\s\d\)\-*]*/, "").trim();
    if (cleaned) {
      // Split on " - " to separate ID from description
      const parts = cleaned.split(" - ");
      const id = parts[0]?.trim();
      const description = parts[1]?.trim();

      if (id) {
        models.push({
          id,
          name: description || id,
          description,
        });
      }
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

    args.push(prompt);

    return new Promise((resolve) => {
      let output = "";

      const proc = spawn("agent", args, {
        stdio: ["inherit", "pipe", "pipe"],
        cwd: options?.workingDirectory,
        shell: false,
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
