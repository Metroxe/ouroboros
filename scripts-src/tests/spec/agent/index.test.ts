/**
 * Tests for agent runtime registry
 */

import { describe, test, expect } from "bun:test";
import {
  getAllRuntimes,
  getRuntime,
  getDefaultRuntime,
  getAvailableRuntimes,
  claudeRuntime,
  copilotRuntime,
  cursorRuntime,
  opencodeRuntime,
} from "../../../lib/agent/index.js";

describe("getAllRuntimes", () => {
  test("returns all 4 runtimes", () => {
    const runtimes = getAllRuntimes();
    expect(runtimes).toHaveLength(4);
  });

  test("includes claude, copilot, cursor, and opencode runtimes", () => {
    const runtimes = getAllRuntimes();
    const names = runtimes.map((r) => r.name);
    expect(names).toContain("claude");
    expect(names).toContain("copilot");
    expect(names).toContain("cursor");
    expect(names).toContain("opencode");
  });
});

describe("getRuntime", () => {
  test("returns claude runtime by name", () => {
    const runtime = getRuntime("claude");
    expect(runtime).toBe(claudeRuntime);
    expect(runtime.name).toBe("claude");
    expect(runtime.displayName).toBe("Claude Code");
  });

  test("returns cursor runtime by name", () => {
    const runtime = getRuntime("cursor");
    expect(runtime).toBe(cursorRuntime);
    expect(runtime.name).toBe("cursor");
    expect(runtime.displayName).toBe("Agent Cursor");
  });

  test("returns opencode runtime by name", () => {
    const runtime = getRuntime("opencode");
    expect(runtime).toBe(opencodeRuntime);
    expect(runtime.name).toBe("opencode");
    expect(runtime.displayName).toBe("Open Code");
  });

  test("returns copilot runtime by name", () => {
    const runtime = getRuntime("copilot");
    expect(runtime).toBe(copilotRuntime);
    expect(runtime.name).toBe("copilot");
    expect(runtime.displayName).toBe("GitHub Copilot");
  });
});

describe("getDefaultRuntime", () => {
  test("returns claude runtime as default", () => {
    const runtime = getDefaultRuntime();
    expect(runtime).toBe(claudeRuntime);
    expect(runtime.name).toBe("claude");
  });
});

describe("getAvailableRuntimes", () => {
  test("returns array of available runtimes", async () => {
    const available = await getAvailableRuntimes();
    expect(Array.isArray(available)).toBe(true);
    // All returned runtimes should have valid structure
    for (const runtime of available) {
      expect(runtime.name).toBeDefined();
      expect(runtime.displayName).toBeDefined();
      expect(typeof runtime.supportsStreaming).toBe("boolean");
      expect(typeof runtime.supportsTokenTracking).toBe("boolean");
    }
  });

  test("only returns runtimes that are available", async () => {
    const available = await getAvailableRuntimes();
    for (const runtime of available) {
      const isAvailable = await runtime.isAvailable();
      expect(isAvailable).toBe(true);
    }
  });
});

describe("runtime interface compliance", () => {
  const runtimes = [
    claudeRuntime,
    copilotRuntime,
    cursorRuntime,
    opencodeRuntime,
  ];

  for (const runtime of runtimes) {
    describe(`${runtime.displayName}`, () => {
      test("has required properties", () => {
        expect(runtime.name).toBeDefined();
        expect(runtime.displayName).toBeDefined();
        expect(typeof runtime.supportsStreaming).toBe("boolean");
        expect(typeof runtime.supportsTokenTracking).toBe("boolean");
      });

      test("has required methods", () => {
        expect(typeof runtime.runPrompt).toBe("function");
        expect(typeof runtime.listModels).toBe("function");
        expect(typeof runtime.isAvailable).toBe("function");
      });

      test("listModels returns array of models", async () => {
        const models = await runtime.listModels();
        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);
        for (const model of models) {
          expect(model.id).toBeDefined();
          expect(model.name).toBeDefined();
        }
      });

      test("isAvailable returns boolean", async () => {
        const available = await runtime.isAvailable();
        expect(typeof available).toBe("boolean");
      });
    });
  }
});
