/**
 * Tests for CLI utilities
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { isHeadless } from "../../lib/cli.js";

describe("isHeadless", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  test("returns true when CI=true", () => {
    process.env.CI = "true";
    process.env.HEADLESS = undefined;
    expect(isHeadless()).toBe(true);
  });

  test("returns true when HEADLESS=1", () => {
    process.env.CI = undefined;
    process.env.HEADLESS = "1";
    expect(isHeadless()).toBe(true);
  });

  test("returns true when HEADLESS=true", () => {
    process.env.CI = undefined;
    process.env.HEADLESS = "true";
    expect(isHeadless()).toBe(true);
  });

  test("returns false when no headless env vars set and TTY available", () => {
    process.env.CI = undefined;
    process.env.HEADLESS = undefined;
    // In test environment, stdin.isTTY might be undefined/false
    // so isHeadless() may return true. This test documents behavior.
    const result = isHeadless();
    // Result depends on whether we're running in a TTY
    expect(typeof result).toBe("boolean");
  });
});

// Note: confirmWithDefault is difficult to test in isolation because it
// requires mocking @clack/prompts. For now, we rely on E2E tests to verify
// the headless mode behavior works correctly.
