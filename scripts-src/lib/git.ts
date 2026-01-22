/**
 * Git utilities
 *
 * Provides git and gh CLI operations for:
 * - Branch management
 * - Commit operations
 * - PR creation and management
 */

import { spawnSync } from "child_process";

/**
 * Result from a git command
 */
export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a git command and return the result
 */
export function gitCommand(args: string[], cwd?: string): GitResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
  });

  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || "",
    exitCode: result.status ?? 1,
  };
}

/**
 * Execute a gh CLI command and return the result
 */
export function ghCommand(args: string[], cwd?: string): GitResult {
  const result = spawnSync("gh", args, {
    cwd,
    encoding: "utf-8",
  });

  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || "",
    exitCode: result.status ?? 1,
  };
}

/**
 * Get the current branch name
 */
export function getCurrentBranch(cwd?: string): string | null {
  const result = gitCommand(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return result.success ? result.stdout : null;
}

/**
 * Get all local branches
 */
export function getLocalBranches(cwd?: string): string[] {
  const result = gitCommand(
    ["branch", "--format=%(refname:short)"],
    cwd
  );
  if (!result.success) {
    return [];
  }
  return result.stdout.split("\n").filter(Boolean);
}

/**
 * Get all remote branches (without remote prefix)
 */
export function getRemoteBranches(cwd?: string): string[] {
  const result = gitCommand(
    ["branch", "-r", "--format=%(refname:short)"],
    cwd
  );
  if (!result.success) {
    return [];
  }
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((b) => b.replace(/^origin\//, ""))
    .filter((b) => b !== "HEAD");
}

/**
 * Get all branches (local + remote, deduplicated)
 */
export function getAllBranches(cwd?: string): string[] {
  const local = getLocalBranches(cwd);
  const remote = getRemoteBranches(cwd);
  const all = new Set([...local, ...remote]);
  return Array.from(all).sort();
}

/**
 * Check if a branch exists (locally or remotely)
 */
export function branchExists(branchName: string, cwd?: string): boolean {
  const all = getAllBranches(cwd);
  return all.includes(branchName);
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd?: string): boolean {
  const result = gitCommand(["status", "--porcelain"], cwd);
  return result.success && result.stdout.length > 0;
}

/**
 * Get list of uncommitted files
 */
export function getUncommittedFiles(cwd?: string): string[] {
  const result = gitCommand(["status", "--porcelain"], cwd);
  if (!result.success) {
    return [];
  }
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.substring(3));
}

/**
 * Create and checkout a new branch
 */
export function createBranch(
  branchName: string,
  fromBranch?: string,
  cwd?: string
): GitResult {
  if (fromBranch) {
    return gitCommand(["checkout", "-b", branchName, fromBranch], cwd);
  }
  return gitCommand(["checkout", "-b", branchName], cwd);
}

/**
 * Checkout an existing branch
 */
export function checkoutBranch(branchName: string, cwd?: string): GitResult {
  return gitCommand(["checkout", branchName], cwd);
}

/**
 * Generate the next available epic branch name
 * Format: epic/{epic-name}-{N} where N starts at 0
 */
export function generateEpicBranchName(
  epicName: string,
  cwd?: string
): { branchName: string; suffix: number } {
  let suffix = 0;
  let branchName = `epic/${epicName}-${suffix}`;

  while (branchExists(branchName, cwd)) {
    suffix++;
    branchName = `epic/${epicName}-${suffix}`;
  }

  return { branchName, suffix };
}

/**
 * Stage all changes
 */
export function stageAll(cwd?: string): GitResult {
  return gitCommand(["add", "-A"], cwd);
}

/**
 * Check if there are staged changes
 */
export function hasStagedChanges(cwd?: string): boolean {
  const result = gitCommand(["diff", "--cached", "--quiet"], cwd);
  // Exit code 1 means there are differences (staged changes)
  return result.exitCode === 1;
}

/**
 * Commit staged changes with a message
 */
export function commit(message: string, cwd?: string): GitResult {
  return gitCommand(["commit", "-m", message], cwd);
}

/**
 * Stage all and commit if there are changes
 * Returns success even if there's nothing to commit
 */
export function commitIfChanges(
  message: string,
  cwd?: string
): { committed: boolean; result: GitResult } {
  stageAll(cwd);

  if (!hasStagedChanges(cwd)) {
    return {
      committed: false,
      result: {
        success: true,
        stdout: "Nothing to commit",
        stderr: "",
        exitCode: 0,
      },
    };
  }

  const result = commit(message, cwd);
  return { committed: result.success, result };
}

/**
 * Push the current branch to origin
 */
export function pushBranch(
  branchName: string,
  setUpstream: boolean = true,
  cwd?: string
): GitResult {
  const args = ["push"];
  if (setUpstream) {
    args.push("-u", "origin", branchName);
  } else {
    args.push("origin", branchName);
  }
  return gitCommand(args, cwd);
}

/**
 * Create a draft PR using gh CLI
 */
export function createDraftPR(
  title: string,
  targetBranch: string,
  body?: string,
  cwd?: string
): GitResult {
  const args = [
    "pr",
    "create",
    "--draft",
    "--title",
    title,
    "--base",
    targetBranch,
  ];

  if (body) {
    args.push("--body", body);
  } else {
    args.push("--body", "");
  }

  return ghCommand(args, cwd);
}

/**
 * Mark a PR as ready (remove draft status)
 */
export function markPRReady(cwd?: string): GitResult {
  return ghCommand(["pr", "ready"], cwd);
}

/**
 * Get the URL of the current PR
 */
export function getPRUrl(cwd?: string): string | null {
  const result = ghCommand(["pr", "view", "--json", "url", "-q", ".url"], cwd);
  return result.success ? result.stdout : null;
}

/**
 * Check if gh CLI is available and authenticated
 */
export function isGhAvailable(cwd?: string): boolean {
  const result = ghCommand(["auth", "status"], cwd);
  return result.success;
}

/**
 * Fetch from origin
 */
export function fetch(cwd?: string): GitResult {
  return gitCommand(["fetch", "origin"], cwd);
}

/**
 * Get the default branch (usually main or master)
 */
export function getDefaultBranch(cwd?: string): string {
  // Try to get it from remote
  const result = gitCommand(
    ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
    cwd
  );
  if (result.success) {
    return result.stdout.replace("origin/", "");
  }

  // Fallback: check if main exists, otherwise master
  if (branchExists("main", cwd)) {
    return "main";
  }
  if (branchExists("master", cwd)) {
    return "master";
  }

  return "main"; // Default fallback
}
