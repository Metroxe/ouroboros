/**
 * GitHub Copilot CLI runtime implementation
 *
 * Executes prompts using the `copilot` CLI with support for:
 * - Non-interactive mode with -p flag
 * - Model selection (claude-sonnet-4, gpt-5, etc.)
 * - Automated mode with --allow-all for full permissions
 * - Text output streaming
 *
 * Note: Requires an active GitHub Copilot subscription (Pro, Pro+, Business, or Enterprise)
 *
 * Unlike Claude Code and Cursor, Copilot CLI does not have a JSON streaming output mode.
 * It outputs text directly to stdout, so we capture and display it as-is.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import type { LLMRuntime, Model, PromptOptions, PromptResult } from "./types.js";

/**
 * Parse model choices from `copilot --help` output
 * Extracts model IDs from the --model flag choices section
 *
 * Example format:
 *   --model <model>  Set the AI model to use (choices:
 *                    "claude-sonnet-4.5", "claude-haiku-4.5",
 *                    "gpt-5.2-codex", "gpt-5")
 */
export function parseModelsFromHelp(helpOutput: string): Model[] {
  const models: Model[] = [];

  // Find the --model section and extract choices
  const modelMatch = helpOutput.match(/--model\s+<model>\s+[^(]*\(choices:\s*([\s\S]*?)\)/);
  if (!modelMatch) {
    return models;
  }

  // Extract quoted model IDs
  const choicesText = modelMatch[1];
  const modelIds = choicesText.match(/"([^"]+)"/g);

  if (!modelIds) {
    return models;
  }

  for (const quoted of modelIds) {
    const id = quoted.replace(/"/g, "");

    // Generate display name from ID
    // e.g., "claude-sonnet-4.5" -> "Claude Sonnet 4.5"
    // e.g., "gpt-5.2-codex" -> "GPT 5.2 Codex"
    const name = id
      .split("-")
      .map((part) => {
        // Handle GPT specially (all uppercase)
        if (part.toLowerCase() === "gpt") return "GPT";
        // Capitalize first letter of other parts
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");

    models.push({
      id,
      name,
      description: name,
    });
  }

  return models;
}

/**
 * GitHub Copilot CLI runtime implementation
 */
export const copilotRuntime: LLMRuntime = {
  name: "copilot",
  displayName: "GitHub Copilot",
  supportsStreaming: false, // No JSON streaming mode available
  supportsTokenTracking: false,

  async runPrompt(
    prompt: string,
    options?: PromptOptions
  ): Promise<PromptResult> {
    const startTime = Date.now();
    const args: string[] = [];

    // Non-interactive mode with prompt flag
    args.push("-p", prompt);

    // Enable all permissions for automated mode (required for non-interactive)
    if (options?.automated) {
      args.push("--allow-all");
    }

    // Model selection
    if (options?.model) {
      args.push("--model", options.model);
    }

    return new Promise((resolve) => {
      let output = "";

      const proc = spawn("copilot", args, {
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
        const text = data.toString();
        output += text;
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

      const proc = spawn("copilot", ["--help"], {
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
      });

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          const models = parseModelsFromHelp(stdout);
          if (models.length > 0) {
            resolve(models);
            return;
          }
        }
        // Fallback if parsing fails
        resolve([
          { id: "gpt-5", name: "GPT-5", description: "OpenAI GPT-5" },
          { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Anthropic Claude Sonnet 4" },
        ]);
      });

      proc.on("error", () => {
        resolve([
          { id: "gpt-5", name: "GPT-5", description: "OpenAI GPT-5" },
          { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Anthropic Claude Sonnet 4" },
        ]);
      });
    });
  },

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["copilot"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  },
};
