/**
 * Tests for GitHub Copilot runtime
 */

import { describe, test, expect } from "bun:test";
import { parseModelsFromHelp } from "../../../lib/agent/copilot.js";

describe("parseModelsFromHelp", () => {
  test("parses model choices from help output", () => {
    const helpOutput = `
Usage: copilot [options] [command]

Options:
  --model <model>                     Set the AI model to use (choices:
                                      "claude-sonnet-4.5", "claude-haiku-4.5",
                                      "gpt-5.2-codex", "gpt-5")
  --no-ask-user                       Disable the ask_user tool
`;
    const models = parseModelsFromHelp(helpOutput);

    expect(models).toHaveLength(4);
    expect(models[0].id).toBe("claude-sonnet-4.5");
    expect(models[0].name).toBe("Claude Sonnet 4.5");
    expect(models[1].id).toBe("claude-haiku-4.5");
    expect(models[2].id).toBe("gpt-5.2-codex");
    expect(models[2].name).toBe("GPT 5.2 Codex");
    expect(models[3].id).toBe("gpt-5");
    expect(models[3].name).toBe("GPT 5");
  });

  test("handles single line of choices", () => {
    const helpOutput = `
  --model <model>  Set the AI model (choices: "gpt-5", "claude-sonnet-4")
  --other          Other option
`;
    const models = parseModelsFromHelp(helpOutput);

    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("gpt-5");
    expect(models[1].id).toBe("claude-sonnet-4");
  });

  test("returns empty array if no model choices found", () => {
    const helpOutput = `
Usage: copilot [options]
  --version  Show version
`;
    const models = parseModelsFromHelp(helpOutput);

    expect(models).toHaveLength(0);
  });

  test("handles real help output format", () => {
    const helpOutput = `
  --model <model>                     Set the AI model to use (choices:
                                      "claude-sonnet-4.5", "claude-haiku-4.5",
                                      "claude-opus-4.5", "claude-sonnet-4",
                                      "gemini-3-pro-preview", "gpt-5.2-codex",
                                      "gpt-5.2", "gpt-5.1-codex-max",
                                      "gpt-5.1-codex", "gpt-5.1", "gpt-5",
                                      "gpt-5.1-codex-mini", "gpt-5-mini",
                                      "gpt-4.1")
  --no-ask-user                       Disable the ask_user tool
`;
    const models = parseModelsFromHelp(helpOutput);

    expect(models.length).toBeGreaterThan(10);
    expect(models.map((m) => m.id)).toContain("claude-sonnet-4.5");
    expect(models.map((m) => m.id)).toContain("gpt-5.2-codex");
    expect(models.map((m) => m.id)).toContain("gemini-3-pro-preview");
  });

  test("formats GPT names correctly", () => {
    const helpOutput = `--model <model> (choices: "gpt-5.2-codex-max")`;
    const models = parseModelsFromHelp(helpOutput);

    expect(models[0].name).toBe("GPT 5.2 Codex Max");
  });

  test("formats Gemini names correctly", () => {
    const helpOutput = `--model <model> (choices: "gemini-3-pro-preview")`;
    const models = parseModelsFromHelp(helpOutput);

    expect(models[0].name).toBe("Gemini 3 Pro Preview");
  });
});
