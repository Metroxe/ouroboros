/**
 * Tests for file system utilities
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  ensureDir,
  exists,
  isDirectory,
  safeCopy,
  copyDirContents,
  remove,
  listDir,
} from "../../lib/fs.js";

describe("ensureDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates directory if it does not exist", () => {
    const newDir = join(tempDir, "new-dir");
    expect(existsSync(newDir)).toBe(false);
    ensureDir(newDir);
    expect(existsSync(newDir)).toBe(true);
  });

  test("creates nested directories", () => {
    const nestedDir = join(tempDir, "a", "b", "c");
    expect(existsSync(nestedDir)).toBe(false);
    ensureDir(nestedDir);
    expect(existsSync(nestedDir)).toBe(true);
  });

  test("does nothing if directory already exists", () => {
    const existingDir = join(tempDir, "existing");
    mkdirSync(existingDir);
    writeFileSync(join(existingDir, "file.txt"), "content");
    ensureDir(existingDir);
    // File should still exist
    expect(existsSync(join(existingDir, "file.txt"))).toBe(true);
  });
});

describe("exists", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns true for existing file", () => {
    const file = join(tempDir, "file.txt");
    writeFileSync(file, "content");
    expect(exists(file)).toBe(true);
  });

  test("returns true for existing directory", () => {
    const dir = join(tempDir, "subdir");
    mkdirSync(dir);
    expect(exists(dir)).toBe(true);
  });

  test("returns false for non-existent path", () => {
    expect(exists(join(tempDir, "nonexistent"))).toBe(false);
  });
});

describe("isDirectory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns true for directory", () => {
    const dir = join(tempDir, "subdir");
    mkdirSync(dir);
    expect(isDirectory(dir)).toBe(true);
  });

  test("returns false for file", () => {
    const file = join(tempDir, "file.txt");
    writeFileSync(file, "content");
    expect(isDirectory(file)).toBe(false);
  });

  test("returns false for non-existent path", () => {
    expect(isDirectory(join(tempDir, "nonexistent"))).toBe(false);
  });
});

describe("safeCopy", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("copies file to new location", () => {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "dest.txt");
    writeFileSync(src, "content");

    const copied = safeCopy(src, dest);
    expect(copied).toBe(true);
    expect(readFileSync(dest, "utf-8")).toBe("content");
  });

  test("copies directory recursively", () => {
    const srcDir = join(tempDir, "src");
    const destDir = join(tempDir, "dest");
    mkdirSync(srcDir);
    writeFileSync(join(srcDir, "file.txt"), "content");

    const copied = safeCopy(srcDir, destDir);
    expect(copied).toBe(true);
    expect(readFileSync(join(destDir, "file.txt"), "utf-8")).toBe("content");
  });

  test("throws error if destination exists and overwrite is false", () => {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "dest.txt");
    writeFileSync(src, "source");
    writeFileSync(dest, "destination");

    expect(() => safeCopy(src, dest)).toThrow("Destination already exists");
  });

  test("overwrites if overwrite option is true", () => {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "dest.txt");
    writeFileSync(src, "new content");
    writeFileSync(dest, "old content");

    const copied = safeCopy(src, dest, { overwrite: true });
    expect(copied).toBe(true);
    expect(readFileSync(dest, "utf-8")).toBe("new content");
  });

  test("skips if skipExisting is true and destination exists", () => {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "dest.txt");
    writeFileSync(src, "new content");
    writeFileSync(dest, "old content");

    const copied = safeCopy(src, dest, { skipExisting: true });
    expect(copied).toBe(false);
    expect(readFileSync(dest, "utf-8")).toBe("old content");
  });

  test("creates parent directories if needed", () => {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "a", "b", "dest.txt");
    writeFileSync(src, "content");

    const copied = safeCopy(src, dest);
    expect(copied).toBe(true);
    expect(readFileSync(dest, "utf-8")).toBe("content");
  });
});

describe("copyDirContents", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("copies all contents from source to destination", () => {
    const srcDir = join(tempDir, "src");
    const destDir = join(tempDir, "dest");
    mkdirSync(srcDir);
    writeFileSync(join(srcDir, "a.txt"), "a");
    writeFileSync(join(srcDir, "b.txt"), "b");

    const result = copyDirContents(srcDir, destDir, { overwrite: true });
    expect(result.copied).toContain("a.txt");
    expect(result.copied).toContain("b.txt");
    expect(readFileSync(join(destDir, "a.txt"), "utf-8")).toBe("a");
    expect(readFileSync(join(destDir, "b.txt"), "utf-8")).toBe("b");
  });

  test("tracks skipped files", () => {
    const srcDir = join(tempDir, "src");
    const destDir = join(tempDir, "dest");
    mkdirSync(srcDir);
    mkdirSync(destDir);
    writeFileSync(join(srcDir, "new.txt"), "new");
    writeFileSync(join(srcDir, "existing.txt"), "updated");
    writeFileSync(join(destDir, "existing.txt"), "original");

    const result = copyDirContents(srcDir, destDir, { skipExisting: true });
    expect(result.copied).toContain("new.txt");
    expect(result.skipped).toContain("existing.txt");
    expect(readFileSync(join(destDir, "existing.txt"), "utf-8")).toBe(
      "original"
    );
  });
});

describe("remove", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("removes file", () => {
    const file = join(tempDir, "file.txt");
    writeFileSync(file, "content");
    expect(existsSync(file)).toBe(true);
    remove(file);
    expect(existsSync(file)).toBe(false);
  });

  test("removes directory recursively", () => {
    const dir = join(tempDir, "subdir");
    mkdirSync(dir);
    writeFileSync(join(dir, "file.txt"), "content");
    expect(existsSync(dir)).toBe(true);
    remove(dir);
    expect(existsSync(dir)).toBe(false);
  });

  test("does nothing for non-existent path", () => {
    remove(join(tempDir, "nonexistent"));
    // Should not throw
  });
});

describe("listDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("lists files in directory", () => {
    writeFileSync(join(tempDir, "a.txt"), "a");
    writeFileSync(join(tempDir, "b.txt"), "b");
    mkdirSync(join(tempDir, "subdir"));

    const files = listDir(tempDir);
    expect(files).toContain("a.txt");
    expect(files).toContain("b.txt");
    expect(files).toContain("subdir");
  });

  test("returns empty array for non-existent directory", () => {
    const files = listDir(join(tempDir, "nonexistent"));
    expect(files).toEqual([]);
  });
});
