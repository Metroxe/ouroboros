/**
 * Tests for version utilities
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseVersion,
  formatVersion,
  compareVersions,
  readInstalledVersion,
  writeVersion,
  isUpdateAvailable,
} from "../../lib/version.js";

describe("parseVersion", () => {
  test("parses simple semver string", () => {
    const result = parseVersion("1.2.3");
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
  });

  test("parses version with v prefix", () => {
    const result = parseVersion("v1.2.3");
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
  });

  test("parses version with prerelease", () => {
    const result = parseVersion("1.2.3-beta.1");
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: "beta.1",
    });
  });

  test("parses version with whitespace", () => {
    const result = parseVersion("  1.2.3  ");
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
  });

  test("returns null for invalid version", () => {
    expect(parseVersion("invalid")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("1.2.3.4")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("formatVersion", () => {
  test("formats simple version", () => {
    expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe("1.2.3");
  });

  test("formats version with prerelease", () => {
    expect(
      formatVersion({ major: 1, minor: 2, patch: 3, prerelease: "alpha" })
    ).toBe("1.2.3-alpha");
  });

  test("round-trips with parseVersion", () => {
    const original = "2.0.0-rc.1";
    const parsed = parseVersion(original);
    expect(parsed).not.toBeNull();
    expect(formatVersion(parsed!)).toBe(original);
  });
});

describe("compareVersions", () => {
  test("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
  });

  test("compares major versions", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
  });

  test("compares minor versions", () => {
    expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
    expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
  });

  test("compares patch versions", () => {
    expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
    expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
  });

  test("prerelease is less than release", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-alpha")).toBe(1);
  });

  test("compares prerelease versions lexically", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBe(1);
  });
});

describe("readInstalledVersion / writeVersion", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "version-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns null for non-existent directory", () => {
    expect(readInstalledVersion("/nonexistent/path")).toBeNull();
  });

  test("returns null for directory without .version file", () => {
    expect(readInstalledVersion(tempDir)).toBeNull();
  });

  test("reads simple version format", () => {
    writeFileSync(join(tempDir, ".version"), "1.2.3");
    expect(readInstalledVersion(tempDir)).toBe("1.2.3");
  });

  test("reads 'version: X.X.X' format", () => {
    writeFileSync(join(tempDir, ".version"), "version: 1.2.3\n");
    expect(readInstalledVersion(tempDir)).toBe("1.2.3");
  });

  test("writeVersion creates correct format", () => {
    writeVersion(tempDir, "2.0.0");
    const content = readFileSync(join(tempDir, ".version"), "utf-8");
    expect(content).toBe("version: 2.0.0\n");
  });

  test("round-trips version correctly", () => {
    writeVersion(tempDir, "3.1.4");
    expect(readInstalledVersion(tempDir)).toBe("3.1.4");
  });
});

describe("isUpdateAvailable", () => {
  test("returns true when update is available", () => {
    expect(isUpdateAvailable("1.0.0", "1.0.1")).toBe(true);
    expect(isUpdateAvailable("1.0.0", "2.0.0")).toBe(true);
  });

  test("returns false when already up to date", () => {
    expect(isUpdateAvailable("1.0.0", "1.0.0")).toBe(false);
  });

  test("returns false when installed is newer", () => {
    expect(isUpdateAvailable("2.0.0", "1.0.0")).toBe(false);
  });
});
