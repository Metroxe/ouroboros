/**
 * Agent Cursor runtime implementation
 *
 * Executes prompts using the `cursor` or `agent` CLI.
 * Note: Cursor's CLI behavior can vary based on version.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import type { LLMRuntime, Model, PromptOptions, PromptResult } from "./types.js";

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

    // Cursor usually takes the prompt as a direct argument or via stdin
    args.push(prompt);

    return new Promise((resolve) => {
      let output = "";
      
      // Try 'cursor' command first, fallback to 'agent' if needed in isAvailable
      const proc = spawn("cursor", args, {
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
      // Cursor models are typically managed within the IDE, but we can return
      // the common ones used by the agent.
      resolve([
        { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "o1-mini", name: "o1-mini" },
        { id: "o1-preview", name: "o1-preview" },
      ]);
    });
  },

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["cursor"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  },
};
