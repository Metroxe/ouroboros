/**
 * Tests for Git utilities
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

import {
  gitCommand,
  getCurrentBranch,
  getLocalBranches,
  branchExists,
  hasUncommittedChanges,
  getUncommittedFiles,
  generateEpicBranchName,
  hasStagedChanges,
  stageAll,
  commitIfChanges,
  getDefaultBranch,
  getLastCommitHash,
  resetHard,
  cleanUntracked,
  resetAndClean,
} from "../../lib/git.js";

/**
 * Create a temporary git repository
 */
function createTempGitRepo(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "git-test-"));

  // Initialize git repo
  spawnSync("git", ["init"], { cwd: tempDir });
  spawnSync("git", ["config", "user.email", "test@test.com"], { cwd: tempDir });
  spawnSync("git", ["config", "user.name", "Test User"], { cwd: tempDir });

  // Create initial commit
  writeFileSync(join(tempDir, "README.md"), "# Test");
  spawnSync("git", ["add", "."], { cwd: tempDir });
  spawnSync("git", ["commit", "-m", "Initial commit"], { cwd: tempDir });

  return tempDir;
}

describe("gitCommand", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("executes git commands successfully", () => {
    const result = gitCommand(["status"], tempDir);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("captures stdout", () => {
    const result = gitCommand(["log", "--oneline", "-1"], tempDir);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain("Initial commit");
  });

  test("handles failed commands", () => {
    const result = gitCommand(["invalid-command"], tempDir);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });
});

describe("getCurrentBranch", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns current branch name", () => {
    const branch = getCurrentBranch(tempDir);
    // Git defaults to master or main depending on version
    expect(branch).toMatch(/^(master|main)$/);
  });

  test("returns null for non-git directory", () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), "non-git-"));
    const branch = getCurrentBranch(nonGitDir);
    expect(branch).toBeNull();
    rmSync(nonGitDir, { recursive: true, force: true });
  });
});

describe("getLocalBranches", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns list of local branches", () => {
    const branches = getLocalBranches(tempDir);
    expect(branches.length).toBeGreaterThan(0);
    // Should include the default branch
    expect(branches.some((b) => b === "master" || b === "main")).toBe(true);
  });

  test("includes newly created branches", () => {
    spawnSync("git", ["checkout", "-b", "feature/test"], { cwd: tempDir });

    const branches = getLocalBranches(tempDir);
    expect(branches).toContain("feature/test");
  });
});

describe("branchExists", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns true for existing branch", () => {
    spawnSync("git", ["checkout", "-b", "test-branch"], { cwd: tempDir });
    expect(branchExists("test-branch", tempDir)).toBe(true);
  });

  test("returns false for non-existing branch", () => {
    expect(branchExists("nonexistent-branch", tempDir)).toBe(false);
  });
});

describe("hasUncommittedChanges", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns false for clean repo", () => {
    expect(hasUncommittedChanges(tempDir)).toBe(false);
  });

  test("returns true for modified files", () => {
    writeFileSync(join(tempDir, "README.md"), "# Modified");
    expect(hasUncommittedChanges(tempDir)).toBe(true);
  });

  test("returns true for new files", () => {
    writeFileSync(join(tempDir, "new-file.txt"), "content");
    expect(hasUncommittedChanges(tempDir)).toBe(true);
  });
});

describe("getUncommittedFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns empty array for clean repo", () => {
    const files = getUncommittedFiles(tempDir);
    expect(files).toEqual([]);
  });

  test("returns list of uncommitted files", () => {
    writeFileSync(join(tempDir, "new-file.txt"), "content");
    writeFileSync(join(tempDir, "README.md"), "# Modified");

    const files = getUncommittedFiles(tempDir);
    expect(files.length).toBe(2);
    expect(files).toContain("new-file.txt");
  });
});

describe("generateEpicBranchName", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("generates branch name with suffix 0", () => {
    const { branchName, suffix } = generateEpicBranchName("my-epic", tempDir);
    expect(branchName).toBe("epic/my-epic-0");
    expect(suffix).toBe(0);
  });

  test("increments suffix when branch exists", () => {
    // Create epic/my-epic-0
    spawnSync("git", ["checkout", "-b", "epic/my-epic-0"], { cwd: tempDir });
    spawnSync("git", ["checkout", "master"], { cwd: tempDir }).status === 0 ||
      spawnSync("git", ["checkout", "main"], { cwd: tempDir });

    const { branchName, suffix } = generateEpicBranchName("my-epic", tempDir);
    expect(branchName).toBe("epic/my-epic-1");
    expect(suffix).toBe(1);
  });

  test("finds next available suffix", () => {
    // Create epic/my-epic-0, epic/my-epic-1, epic/my-epic-2
    for (let i = 0; i < 3; i++) {
      spawnSync("git", ["checkout", "-b", `epic/my-epic-${i}`], { cwd: tempDir });
    }
    spawnSync("git", ["checkout", "master"], { cwd: tempDir }).status === 0 ||
      spawnSync("git", ["checkout", "main"], { cwd: tempDir });

    const { branchName, suffix } = generateEpicBranchName("my-epic", tempDir);
    expect(branchName).toBe("epic/my-epic-3");
    expect(suffix).toBe(3);
  });
});

describe("staging and commits", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("hasStagedChanges returns false for clean repo", () => {
    expect(hasStagedChanges(tempDir)).toBe(false);
  });

  test("hasStagedChanges returns true after staging", () => {
    writeFileSync(join(tempDir, "new.txt"), "content");
    stageAll(tempDir);
    expect(hasStagedChanges(tempDir)).toBe(true);
  });

  test("commitIfChanges commits when there are changes", () => {
    writeFileSync(join(tempDir, "new.txt"), "content");

    const { committed, result } = commitIfChanges("test commit", tempDir);
    expect(committed).toBe(true);
    expect(result.success).toBe(true);

    // Verify commit was made
    const logResult = gitCommand(["log", "--oneline", "-1"], tempDir);
    expect(logResult.stdout).toContain("test commit");
  });

  test("commitIfChanges does nothing when clean", () => {
    const { committed, result } = commitIfChanges("test commit", tempDir);
    expect(committed).toBe(false);
    expect(result.success).toBe(true);
  });
});

describe("getDefaultBranch", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns main or master", () => {
    const defaultBranch = getDefaultBranch(tempDir);
    expect(defaultBranch).toMatch(/^(main|master)$/);
  });
});

describe("getLastCommitHash", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns 40 character commit hash", () => {
    const hash = getLastCommitHash(tempDir);
    expect(hash).not.toBeNull();
    expect(hash).toHaveLength(40);
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
  });

  test("returns different hash after new commit", () => {
    const hash1 = getLastCommitHash(tempDir);

    writeFileSync(join(tempDir, "new.txt"), "content");
    spawnSync("git", ["add", "."], { cwd: tempDir });
    spawnSync("git", ["commit", "-m", "Second commit"], { cwd: tempDir });

    const hash2 = getLastCommitHash(tempDir);
    expect(hash2).not.toBe(hash1);
  });

  test("returns null for non-git directory", () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), "non-git-"));
    const hash = getLastCommitHash(nonGitDir);
    expect(hash).toBeNull();
    rmSync(nonGitDir, { recursive: true, force: true });
  });
});

describe("resetHard", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("discards uncommitted changes to tracked files", () => {
    // Modify a tracked file
    writeFileSync(join(tempDir, "README.md"), "# Modified content");
    expect(hasUncommittedChanges(tempDir)).toBe(true);

    // Reset
    const result = resetHard("HEAD", tempDir);
    expect(result.success).toBe(true);

    // Verify changes are gone
    expect(hasUncommittedChanges(tempDir)).toBe(false);
  });

  test("resets to specific commit", () => {
    const firstHash = getLastCommitHash(tempDir);

    // Make a second commit
    writeFileSync(join(tempDir, "new.txt"), "content");
    spawnSync("git", ["add", "."], { cwd: tempDir });
    spawnSync("git", ["commit", "-m", "Second commit"], { cwd: tempDir });

    const secondHash = getLastCommitHash(tempDir);
    expect(secondHash).not.toBe(firstHash);

    // Reset to first commit
    const result = resetHard(firstHash!, tempDir);
    expect(result.success).toBe(true);

    // Verify we're back to first commit
    const currentHash = getLastCommitHash(tempDir);
    expect(currentHash).toBe(firstHash);
  });

  test("returns success result", () => {
    const result = resetHard("HEAD", tempDir);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });
});

describe("cleanUntracked", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("removes untracked files", () => {
    // Create untracked file
    writeFileSync(join(tempDir, "untracked.txt"), "content");
    expect(getUncommittedFiles(tempDir)).toContain("untracked.txt");

    // Clean
    const result = cleanUntracked(tempDir);
    expect(result.success).toBe(true);

    // Verify file is gone
    expect(getUncommittedFiles(tempDir)).not.toContain("untracked.txt");
  });

  test("removes untracked directories", () => {
    // Create untracked directory with file
    const { mkdirSync } = require("fs");
    mkdirSync(join(tempDir, "untracked-dir"));
    writeFileSync(join(tempDir, "untracked-dir", "file.txt"), "content");

    // Clean
    const result = cleanUntracked(tempDir);
    expect(result.success).toBe(true);

    // Verify directory is gone
    const { existsSync } = require("fs");
    expect(existsSync(join(tempDir, "untracked-dir"))).toBe(false);
  });

  test("does not remove tracked files", () => {
    // README.md is tracked
    const result = cleanUntracked(tempDir);
    expect(result.success).toBe(true);

    const { existsSync } = require("fs");
    expect(existsSync(join(tempDir, "README.md"))).toBe(true);
  });
});

describe("resetAndClean", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("resets tracked changes and cleans untracked files", () => {
    // Modify tracked file
    writeFileSync(join(tempDir, "README.md"), "# Modified");
    // Create untracked file
    writeFileSync(join(tempDir, "untracked.txt"), "content");

    expect(hasUncommittedChanges(tempDir)).toBe(true);

    // Reset and clean
    const { resetResult, cleanResult } = resetAndClean("HEAD", tempDir);
    expect(resetResult.success).toBe(true);
    expect(cleanResult.success).toBe(true);

    // Verify clean state
    expect(hasUncommittedChanges(tempDir)).toBe(false);
    expect(getUncommittedFiles(tempDir)).toEqual([]);
  });

  test("resets to specific commit and cleans", () => {
    const firstHash = getLastCommitHash(tempDir);

    // Make changes and commit
    writeFileSync(join(tempDir, "new.txt"), "content");
    spawnSync("git", ["add", "."], { cwd: tempDir });
    spawnSync("git", ["commit", "-m", "Second commit"], { cwd: tempDir });

    // Add more untracked files
    writeFileSync(join(tempDir, "untracked.txt"), "extra");

    // Reset to first commit and clean
    const { resetResult, cleanResult } = resetAndClean(firstHash!, tempDir);
    expect(resetResult.success).toBe(true);
    expect(cleanResult.success).toBe(true);

    // Verify state
    expect(getLastCommitHash(tempDir)).toBe(firstHash);
    expect(getUncommittedFiles(tempDir)).toEqual([]);
  });

  test("returns both results even if one fails", () => {
    // Reset should work
    const { resetResult, cleanResult } = resetAndClean("HEAD", tempDir);

    expect(resetResult).toBeDefined();
    expect(cleanResult).toBeDefined();
    expect(resetResult.success).toBe(true);
    expect(cleanResult.success).toBe(true);
  });
});
