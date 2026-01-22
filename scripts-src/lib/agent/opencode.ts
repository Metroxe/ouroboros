/**
 * Open Code runtime implementation
 *
 * Executes prompts using the `opencode` CLI.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
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
      const proc = spawn("opencode", ["models", "--verbose"], {
        stdio: ["inherit", "pipe", "pipe"],
        shell: true,
      });

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          const models: Model[] = [];
          const lines = stdout.split("\n");
          let currentJson = "";
          let isInsideJson = false;

          for (const line of lines) {
            if (line.trim() === "{") {
              isInsideJson = true;
              currentJson = "{";
            } else if (line.trim() === "}") {
              currentJson += "}";
              isInsideJson = false;
              try {
                const modelData = JSON.parse(currentJson);
                models.push({
                  id: modelData.id,
                  name: modelData.name,
                  description: `Provider: ${modelData.providerID}, Context: ${modelData.limit?.context}`,
                });
              } catch (e) {
                // Skip invalid JSON
              }
            } else if (isInsideJson) {
              currentJson += line;
            }
          }
          resolve(models);
        } else {
          // Fallback to hardcoded models if command fails
          resolve([
            { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B" },
            { id: "deepseek-coder-v2", name: "DeepSeek Coder V2" },
          ]);
        }
      });

      proc.on("error", () => {
        resolve([
          { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B" },
          { id: "deepseek-coder-v2", name: "DeepSeek Coder V2" },
        ]);
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
