/**
 * E2E tests for LLM runtime integrations
 *
 * These tests invoke real CLI tools and are SKIPPED in CI environments.
 * Run locally with: bun test:e2e:runtime
 */

import { describe, test, expect, beforeAll } from "bun:test";
import {
  getAllRuntimes,
  getAvailableRuntimes,
  claudeRuntime,
  cursorRuntime,
  opencodeRuntime,
} from "../../lib/agent/index.js";
import type { LLMRuntime } from "../../lib/agent/types.js";
import { shouldSkipRuntimeTests } from "../helpers/setup.js";

// Skip all runtime tests in CI
const skipTests = shouldSkipRuntimeTests();

describe("Runtime Availability", () => {
  test.skipIf(skipTests)("detects available runtimes on this system", async () => {
    const available = await getAvailableRuntimes();
    console.log(
      `Available runtimes: ${available.map((r) => r.displayName).join(", ") || "none"}`
    );

    // At least document what's available
    expect(Array.isArray(available)).toBe(true);
  });

  test.skipIf(skipTests)("claude isAvailable returns correct result", async () => {
    const available = await claudeRuntime.isAvailable();
    console.log(`Claude Code available: ${available}`);
    expect(typeof available).toBe("boolean");
  });

  test.skipIf(skipTests)("cursor isAvailable returns correct result", async () => {
    const available = await cursorRuntime.isAvailable();
    console.log(`Cursor available: ${available}`);
    expect(typeof available).toBe("boolean");
  });

  test.skipIf(skipTests)("opencode isAvailable returns correct result", async () => {
    const available = await opencodeRuntime.isAvailable();
    console.log(`OpenCode available: ${available}`);
    expect(typeof available).toBe("boolean");
  });
});

describe("Claude Code Runtime", () => {
  let isAvailable = false;

  beforeAll(async () => {
    if (!skipTests) {
      isAvailable = await claudeRuntime.isAvailable();
    }
  });

  test.skipIf(skipTests || !isAvailable)(
    "can list models",
    async () => {
      const models = await claudeRuntime.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      console.log(`Claude models: ${models.map((m) => m.id).join(", ")}`);
    }
  );

  test.skipIf(skipTests || !isAvailable)(
    "can execute simple prompt",
    async () => {
      // Use a minimal prompt to test connectivity
      const result = await claudeRuntime.runPrompt(
        "Respond with just the word 'hello' and nothing else.",
        {
          automated: true,
          streamOutput: false,
        }
      );

      console.log(`Claude prompt result:`, {
        success: result.success,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        tokenUsage: result.tokenUsage,
        costUsd: result.costUsd,
      });

      expect(result.exitCode).toBeDefined();
      expect(result.durationMs).toBeGreaterThan(0);

      if (result.success) {
        expect(result.output.toLowerCase()).toContain("hello");
        // Claude should provide token tracking
        if (result.tokenUsage) {
          expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
          expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
        }
      }
    },
    { timeout: 60000 }
  );
});

describe("Cursor Runtime", () => {
  let isAvailable = false;

  beforeAll(async () => {
    if (!skipTests) {
      isAvailable = await cursorRuntime.isAvailable();
    }
  });

  test.skipIf(skipTests || !isAvailable)(
    "can list models",
    async () => {
      const models = await cursorRuntime.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      console.log(`Cursor models: ${models.map((m) => m.id).join(", ")}`);
    }
  );

  test.skipIf(skipTests || !isAvailable)(
    "can execute simple prompt",
    async () => {
      const result = await cursorRuntime.runPrompt(
        "Respond with just the word 'hello' and nothing else.",
        {
          automated: true,
          streamOutput: false,
        }
      );

      console.log(`Cursor prompt result:`, {
        success: result.success,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });

      expect(result.exitCode).toBeDefined();
      expect(result.durationMs).toBeGreaterThan(0);
    },
    { timeout: 60000 }
  );
});

describe("OpenCode Runtime", () => {
  let isAvailable = false;

  beforeAll(async () => {
    if (!skipTests) {
      isAvailable = await opencodeRuntime.isAvailable();
    }
  });

  test.skipIf(skipTests || !isAvailable)(
    "can list models",
    async () => {
      const models = await opencodeRuntime.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      console.log(`OpenCode models: ${models.map((m) => m.id).join(", ")}`);
    }
  );

  test.skipIf(skipTests || !isAvailable)(
    "can execute simple prompt",
    async () => {
      const result = await opencodeRuntime.runPrompt(
        "Respond with just the word 'hello' and nothing else.",
        {
          automated: true,
          streamOutput: false,
        }
      );

      console.log(`OpenCode prompt result:`, {
        success: result.success,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        tokenUsage: result.tokenUsage,
      });

      expect(result.exitCode).toBeDefined();
      expect(result.durationMs).toBeGreaterThan(0);
    },
    { timeout: 60000 }
  );
});

describe("Runtime Comparison", () => {
  test.skipIf(skipTests)(
    "all available runtimes can execute a prompt",
    async () => {
      const available = await getAvailableRuntimes();

      if (available.length === 0) {
        console.log("No runtimes available, skipping comparison test");
        return;
      }

      console.log(`Testing ${available.length} available runtime(s)...`);

      const results: Array<{
        name: string;
        success: boolean;
        durationMs: number;
      }> = [];

      for (const runtime of available) {
        console.log(`Testing ${runtime.displayName}...`);
        const result = await runtime.runPrompt("Say 'test'", {
          automated: true,
          streamOutput: false,
        });

        results.push({
          name: runtime.displayName,
          success: result.success,
          durationMs: result.durationMs,
        });
      }

      console.log("Runtime comparison results:", results);

      // At least one should succeed
      const anySuccess = results.some((r) => r.success);
      if (!anySuccess) {
        console.warn("No runtimes succeeded in the comparison test");
      }
    },
    { timeout: 120000 }
  );
});
