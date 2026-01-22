/**
 * Tests for Cursor runtime implementation
 */

import { describe, test, expect } from "bun:test";
import { parseModelsOutput, cursorRuntime } from "../../../lib/agent/cursor.js";

describe("parseModelsOutput", () => {
  test("parses actual agent models output format", () => {
    const output = `Available models

auto - Auto
composer-1 - Composer 1
gpt-5.2-codex - GPT-5.2 Codex  (current)
opus-4.5-thinking - Claude 4.5 Opus (Thinking)  (default)
sonnet-4.5 - Claude 4.5 Sonnet
grok - Grok

Tip: use --model <id> (or /model <id> in interactive mode) to switch.`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(6);
    expect(models[0]).toEqual({
      id: "auto",
      name: "Auto",
      description: "Auto",
    });
    expect(models[1]).toEqual({
      id: "composer-1",
      name: "Composer 1",
      description: "Composer 1",
    });
    expect(models[2]).toEqual({
      id: "gpt-5.2-codex",
      name: "GPT-5.2 Codex  (current)",
      description: "GPT-5.2 Codex  (current)",
    });
    expect(models[3]).toEqual({
      id: "opus-4.5-thinking",
      name: "Claude 4.5 Opus (Thinking)  (default)",
      description: "Claude 4.5 Opus (Thinking)  (default)",
    });
  });

  test("parses numbered format with asterisk", () => {
    const output = `Available models:
  1) claude-sonnet-4 - Claude Sonnet 4
* 2) gpt-4o - GPT-4o (selected)
  3) o3 - O3`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(3);
    expect(models[0].id).toBe("claude-sonnet-4");
    expect(models[1].id).toBe("gpt-4o");
    expect(models[2].id).toBe("o3");
  });

  test("skips lines without separator", () => {
    const output = `Available models
auto - Auto
some-invalid-line-without-separator
gpt-4o - GPT-4o`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("auto");
    expect(models[1].id).toBe("gpt-4o");
  });

  test("skips empty lines and headers", () => {
    const output = `
Available models

model-a - Model A

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
    const output = `Available models
---
Tip: Use --model to select`;

    const models = parseModelsOutput(output);
    expect(models).toEqual([]);
  });

  test("handles thinking model format", () => {
    const output = `opus-4.5-thinking - Claude 4.5 Opus (Thinking)
sonnet-4-thinking - Claude Sonnet 4 (Thinking)`;

    const models = parseModelsOutput(output);

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({
      id: "opus-4.5-thinking",
      name: "Claude 4.5 Opus (Thinking)",
      description: "Claude 4.5 Opus (Thinking)",
    });
  });

  test("handles numbered prefix format", () => {
    const output = `  1) claude-sonnet - Claude Sonnet
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
