/**
 * Tests for Cursor runtime implementation
 */

import { describe, test, expect } from "bun:test";
import { parseModelsOutput, cursorRuntime } from "../../../lib/agent/cursor.js";

describe("parseModelsOutput", () => {
  test("parses typical agent models output", () => {
    const output = `Available models:
---
  1) claude-sonnet-4-20250514 - Claude Sonnet 4
  2) claude-opus-4-20250514 - Claude Opus 4
  3) gpt-4o - GPT-4o
  4) o3 - O3
  5) o3-mini - O3 Mini
  6) deepseek-r1 - DeepSeek R1
---
Tip: Use --model <id> to select a model`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(6);
    expect(models[0]).toEqual({
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4",
      description: "Claude Sonnet 4",
    });
    expect(models[1]).toEqual({
      id: "claude-opus-4-20250514",
      name: "Claude Opus 4",
      description: "Claude Opus 4",
    });
    expect(models[2]).toEqual({
      id: "gpt-4o",
      name: "GPT-4o",
      description: "GPT-4o",
    });
  });

  test("parses output with asterisk for selected model", () => {
    const output = `Available models:
  1) claude-sonnet-4-20250514 - Claude Sonnet 4
* 2) gpt-4o - GPT-4o (selected)
  3) o3 - O3`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(3);
    expect(models[0].id).toBe("claude-sonnet-4-20250514");
    expect(models[1].id).toBe("gpt-4o");
    expect(models[2].id).toBe("o3");
  });

  test("handles models without descriptions", () => {
    const output = `  1) some-model-id
  2) another-model`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({
      id: "some-model-id",
      name: "some-model-id",
      description: undefined,
    });
    expect(models[1]).toEqual({
      id: "another-model",
      name: "another-model",
      description: undefined,
    });
  });

  test("skips empty lines and headers", () => {
    const output = `
Available models:
---

  1) model-a - Model A

---
Tip: something`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("model-a");
  });

  test("returns empty array for empty input", () => {
    const models = parseModelsOutput("");
    expect(models).toEqual([]);
  });

  test("returns empty array for input with only headers", () => {
    const output = `Available models:
---
Tip: Use --model to select`;

    const models = parseModelsOutput(output);
    expect(models).toEqual([]);
  });

  test("handles thinking model format", () => {
    const output = `  8) opus-4.5-thinking - Claude 4.5 Opus (Thinking)
  9) sonnet-4-thinking - Claude Sonnet 4 (Thinking)`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({
      id: "opus-4.5-thinking",
      name: "Claude 4.5 Opus (Thinking)",
      description: "Claude 4.5 Opus (Thinking)",
    });
  });

  test("handles various whitespace formats", () => {
    const output = `   1)   claude-sonnet   -   Claude Sonnet   
2) gpt-4o - GPT-4o`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("claude-sonnet");
    expect(models[1].id).toBe("gpt-4o");
  });
});

describe("cursorRuntime", () => {
  test("has correct name and display name", () => {
    expect(cursorRuntime.name).toBe("cursor");
    expect(cursorRuntime.displayName).toBe("Agent Cursor");
  });

  test("supports streaming but not token tracking", () => {
    expect(cursorRuntime.supportsStreaming).toBe(true);
    expect(cursorRuntime.supportsTokenTracking).toBe(false);
  });

  test("has required methods", () => {
    expect(typeof cursorRuntime.runPrompt).toBe("function");
    expect(typeof cursorRuntime.listModels).toBe("function");
    expect(typeof cursorRuntime.isAvailable).toBe("function");
  });

  test("listModels returns array with fallback when agent not available", async () => {
    // This test runs without mocking, so if agent is not available,
    // it should return the fallback models
    const models = await cursorRuntime.listModels();
    
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    
    // All models should have id and name
    for (const model of models) {
      expect(model.id).toBeDefined();
      expect(typeof model.id).toBe("string");
      expect(model.name).toBeDefined();
      expect(typeof model.name).toBe("string");
    }
  });

  test("isAvailable returns boolean", async () => {
    const available = await cursorRuntime.isAvailable();
    expect(typeof available).toBe("boolean");
  });
});
