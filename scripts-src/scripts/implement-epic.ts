#!/usr/bin/env bun
/**
 * implement-epic.ts
 *
 * Automated script to take a created epic through the full implementation pipeline.
 * Handles git branching, PR creation, prompt execution, progress tracking, and commits.
 *
 * Usage:
 *   ./implement-epic [options]
 *
 * Options:
 *   --epic=<name>              Epic folder name to implement
 *   --branch=<yes|no>          Create a new branch
 *   --branch-from=<name>       Branch to create from
 *   --bring-changes=<yes|no>   Bring uncommitted changes to new branch
 *   --open-pr=<yes|no>         Open a draft PR
 *   --pr-target=<name>         Target branch for PR (default: main)
 *   --commit-each=<yes|no>     Commit after each step
 *   --planning-runtime=<name>  Runtime for planning phases (claude|cursor|opencode)
 *   --planning-model=<id>      Model for planning phases
 *   --impl-runtime=<name>      Runtime for implementation phase (claude|cursor|opencode)
 *   --impl-model=<id>          Model for implementation phase
 *   --verbose                  Enable verbose output
 *   --help                     Show this help message
 */

import * as p from "@clack/prompts";
import { existsSync } from "fs";
import { join } from "path";

import {
  getRuntime,
  getAvailableRuntimes,
  type LLMRuntime,
  type RuntimeName,
  type PromptResult,
  type TokenUsage,
} from "../lib/agent/index.js";

import {
  listEpics,
  getEpic,
  detectProgress,
  discoverFeaturesFromDirectory,
  validateFeatures,
  findTaskPromptFile,
  isLastTaskGroup,
  type Epic,
  type Feature,
  type EpicProgress,
} from "../lib/epic.js";

import {
  readFeaturesIndex,
  readProgressYml,
  type ProgressYml,
} from "../lib/yaml.js";

import {
  getCurrentBranch,
  getAllBranches,
  hasUncommittedChanges,
  getUncommittedFiles,
  createBranch,
  generateEpicBranchName,
  commitIfChanges,
  pushBranch,
  createDraftPR,
  markPRReady,
  getPRUrl,
  isGhAvailable,
  getDefaultBranch,
  fetch,
  getLastCommitHash,
  resetAndClean,
} from "../lib/git.js";

// ============================================================================
// Types
// ============================================================================

interface Config {
  epic: Epic;
  createBranch: boolean;
  branchFrom: string;
  bringChanges: boolean;
  openPR: boolean;
  prTarget: string;
  commitEach: boolean;
  planningRuntime: LLMRuntime;
  planningModel: string;
  implRuntime: LLMRuntime;
  implModel: string;
  verbose: boolean;
  // Derived after branch creation
  branchName?: string;
  branchSuffix?: number;
}

interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  totalDurationMs: number;
  stepCount: number;
}

// ============================================================================
// Globals
// ============================================================================

let config: Config;
let tokenStats: TokenStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  totalCostUsd: 0,
  totalDurationMs: 0,
  stepCount: 0,
};

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  epic?: string;
  branch?: string;
  branchFrom?: string;
  bringChanges?: string;
  openPr?: string;
  prTarget?: string;
  commitEach?: string;
  planningRuntime?: string;
  planningModel?: string;
  implRuntime?: string;
  implModel?: string;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
    } else if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      (args as any)[camelKey] = value;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
implement-epic - Automate epic implementation pipeline

Usage:
  ./implement-epic [options]

Options:
  --epic=<name>              Epic folder name to implement
  --branch=<yes|no>          Create a new branch
  --branch-from=<name>       Branch to create from
  --bring-changes=<yes|no>   Bring uncommitted changes to new branch
  --open-pr=<yes|no>         Open a draft PR
  --pr-target=<name>         Target branch for PR (default: main)
  --commit-each=<yes|no>     Commit after each step
  --planning-runtime=<name>  Runtime for planning (claude|cursor|opencode)
  --planning-model=<id>      Model for planning phases
  --impl-runtime=<name>      Runtime for implementation (claude|cursor|opencode)
  --impl-model=<id>          Model for implementation phase
  --verbose                  Enable verbose output
  --help                     Show this help message

Examples:
  ./implement-epic
  ./implement-epic --epic=2025-01-21-user-auth --branch=yes
  ./implement-epic --planning-runtime=claude --impl-runtime=opencode
`);
}

function parseYesNo(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  return value.toLowerCase() === "yes" || value.toLowerCase() === "true";
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function verbose(message: string): void {
  if (config?.verbose) {
    p.log.info(`[verbose] ${message}`);
  }
}

// ============================================================================
// Prompt Execution
// ============================================================================

/**
 * Custom error class for loop detection
 */
class LoopDetectedError extends Error {
  constructor(stepName: string) {
    super(`Loop detected during: ${stepName}`);
    this.name = "LoopDetectedError";
  }
}

async function runPrompt(
  runtime: LLMRuntime,
  model: string,
  prompt: string,
  stepName: string
): Promise<PromptResult> {
  tokenStats.stepCount++;

  p.log.step(`Step ${tokenStats.stepCount}: ${stepName}`);
  verbose(`Using ${runtime.displayName} with model ${model}`);
  verbose(`Prompt: ${prompt.substring(0, 200)}...`);

  // Get commit hash before running (for potential rollback on loop detection)
  const commitHashBefore = config.commitEach ? getLastCommitHash() : null;
  verbose(`Commit hash before: ${commitHashBefore || "none"}`);

  const result = await runtime.runPrompt(prompt, {
    model,
    automated: true,
    streamOutput: true,
    verbose: config.verbose,
  });

  // Track token usage
  if (result.tokenUsage) {
    tokenStats.totalInputTokens += result.tokenUsage.inputTokens;
    tokenStats.totalOutputTokens += result.tokenUsage.outputTokens;
    tokenStats.totalCacheReadTokens += result.tokenUsage.cacheReadTokens || 0;
    tokenStats.totalCacheCreationTokens +=
      result.tokenUsage.cacheCreationTokens || 0;
  }
  if (result.costUsd) {
    tokenStats.totalCostUsd += result.costUsd;
  }
  tokenStats.totalDurationMs += result.durationMs;

  p.log.info(`Duration: ${formatDuration(result.durationMs)}`);

  if (runtime.supportsTokenTracking && tokenStats.totalInputTokens > 0) {
    p.log.info(
      `Running total: ${formatCost(tokenStats.totalCostUsd)} | ${formatNumber(
        tokenStats.totalInputTokens + tokenStats.totalOutputTokens
      )} tokens`
    );
  }

  // Handle loop detection
  if (result.loopDetected) {
    p.log.warn("Loop detected - agent was making repeated failing tool calls");

    if (config.commitEach && commitHashBefore) {
      p.log.info(`Resetting to last commit: ${commitHashBefore.substring(0, 8)}...`);
      const { resetResult, cleanResult } = resetAndClean(commitHashBefore);

      if (resetResult.success) {
        p.log.success("Successfully reset to last commit");
      } else {
        p.log.error(`Failed to reset: ${resetResult.stderr}`);
      }

      if (!cleanResult.success) {
        p.log.warn(`Failed to clean untracked files: ${cleanResult.stderr}`);
      }
    } else {
      p.log.info("No commit to reset to - changes from this step may be partial");
    }

    throw new LoopDetectedError(stepName);
  }

  if (!result.success) {
    p.log.error(`Step failed with exit code ${result.exitCode}`);
    throw new Error(`Prompt execution failed: ${stepName}`);
  }

  return result;
}

// ============================================================================
// Git Operations
// ============================================================================

async function maybeCommit(message: string): Promise<void> {
  if (!config.commitEach) {
    verbose("Commit disabled, skipping");
    return;
  }

  const { committed, result } = commitIfChanges(message);

  if (committed) {
    p.log.success(`Committed: ${message}`);
  } else {
    verbose("Nothing to commit");
  }
}

// ============================================================================
// Phase 1: Configuration
// ============================================================================

async function selectEpic(args: CliArgs): Promise<Epic> {
  if (args.epic) {
    const epic = getEpic(args.epic);
    if (!epic) {
      p.log.error(`Epic not found: ${args.epic}`);
      process.exit(1);
    }
    return epic;
  }

  const epics = listEpics();

  if (epics.length === 0) {
    p.log.error("No epics found in ouroboros/epics/");
    p.log.info("Run ouroboros/prompts/create-epic.md to create an epic first.");
    process.exit(1);
  }

  const epicChoice = await p.select({
    message: "Which epic do you want to implement?",
    options: epics.map((e) => ({
      value: e.name,
      label: `${e.date} - ${e.epicName}`,
    })),
  });

  if (p.isCancel(epicChoice)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  return getEpic(epicChoice as string)!;
}

async function configureBranch(args: CliArgs): Promise<{
  createBranch: boolean;
  branchFrom: string;
  bringChanges: boolean;
}> {
  const currentBranch = getCurrentBranch() || "main";

  // Create branch?
  let createBranch = parseYesNo(args.branch);
  if (createBranch === undefined) {
    const answer = await p.confirm({
      message: "Do you want to create a new branch to work from?",
      initialValue: true,
    });
    if (p.isCancel(answer)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    createBranch = answer;
  }

  if (!createBranch) {
    return { createBranch: false, branchFrom: currentBranch, bringChanges: false };
  }

  // Branch from?
  let branchFrom = args.branchFrom;
  if (!branchFrom) {
    fetch(); // Fetch to get latest remote branches
    const branches = getAllBranches();
    const branchChoice = await p.select({
      message: "Which branch do you want to branch from?",
      options: [
        { value: currentBranch, label: `${currentBranch} (current)` },
        ...branches
          .filter((b) => b !== currentBranch)
          .map((b) => ({ value: b, label: b })),
      ],
    });
    if (p.isCancel(branchChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    branchFrom = branchChoice as string;
  }

  // Check for uncommitted changes
  let bringChanges = parseYesNo(args.bringChanges);
  if (hasUncommittedChanges()) {
    const files = getUncommittedFiles();
    p.log.warn(`You have ${files.length} uncommitted file(s):`);
    files.slice(0, 5).forEach((f) => p.log.message(`  - ${f}`));
    if (files.length > 5) {
      p.log.message(`  ... and ${files.length - 5} more`);
    }

    if (bringChanges === undefined) {
      const answer = await p.confirm({
        message: "Do you want to bring these changes to the new branch?",
        initialValue: true,
      });
      if (p.isCancel(answer)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      bringChanges = answer;
    }

    if (!bringChanges) {
      p.log.error("Cannot proceed with uncommitted changes.");
      p.log.info("Please commit or stash your changes before continuing:");
      p.log.message("  git stash push -m 'before epic implementation'");
      p.log.message("  # or");
      p.log.message("  git commit -am 'WIP'");
      process.exit(1);
    }
  } else {
    bringChanges = false;
  }

  return { createBranch, branchFrom, bringChanges };
}

async function configurePR(args: CliArgs, epic: Epic): Promise<{
  openPR: boolean;
  prTarget: string;
}> {
  const defaultBranch = getDefaultBranch();

  // PR target
  let prTarget = args.prTarget || defaultBranch;
  if (!args.prTarget) {
    const targetChoice = await p.select({
      message: "Which branch should the PR target?",
      options: [
        { value: defaultBranch, label: `${defaultBranch} (default)` },
        ...getAllBranches()
          .filter((b) => b !== defaultBranch)
          .slice(0, 10)
          .map((b) => ({ value: b, label: b })),
      ],
    });
    if (p.isCancel(targetChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    prTarget = targetChoice as string;
  }

  // Open PR?
  let openPR = parseYesNo(args.openPr);
  if (openPR === undefined) {
    const answer = await p.confirm({
      message: `Do you want to open a draft PR to ${prTarget}?`,
      initialValue: true,
    });
    if (p.isCancel(answer)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    openPR = answer;
  }

  if (openPR && !isGhAvailable()) {
    p.log.warn("GitHub CLI (gh) is not available or not authenticated.");
    p.log.info("Run: gh auth login");
    openPR = false;
  }

  return { openPR, prTarget };
}

async function configureCommits(args: CliArgs): Promise<boolean> {
  let commitEach = parseYesNo(args.commitEach);
  if (commitEach === undefined) {
    const answer = await p.confirm({
      message: "Do you want to commit after each step completes?",
      initialValue: true,
    });
    if (p.isCancel(answer)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    commitEach = answer;
  }
  return commitEach;
}

async function selectRuntime(
  args: CliArgs,
  purpose: "planning" | "implementation"
): Promise<{ runtime: LLMRuntime; model: string }> {
  const runtimeArg =
    purpose === "planning" ? args.planningRuntime : args.implRuntime;
  const modelArg =
    purpose === "planning" ? args.planningModel : args.implModel;

  const availableRuntimes = await getAvailableRuntimes();

  if (availableRuntimes.length === 0) {
    p.log.error("No LLM runtimes available.");
    p.log.info("Install one of: claude, cursor, opencode");
    process.exit(1);
  }

  // Select runtime
  let runtime: LLMRuntime;
  if (runtimeArg) {
    runtime = getRuntime(runtimeArg as RuntimeName);
    if (!runtime || !(await runtime.isAvailable())) {
      p.log.error(`Runtime not available: ${runtimeArg}`);
      process.exit(1);
    }
  } else {
    const runtimeChoice = await p.select({
      message: `Select runtime for ${purpose}:`,
      options: availableRuntimes.map((r) => ({
        value: r.name,
        label: r.displayName,
      })),
    });
    if (p.isCancel(runtimeChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    runtime = getRuntime(runtimeChoice as RuntimeName);
  }

  // Select model
  let model: string;
  if (modelArg) {
    model = modelArg;
  } else {
    const models = await runtime.listModels();
    const modelChoice = await p.select({
      message: `Select model for ${purpose} (${runtime.displayName}):`,
      options: models.map((m) => ({
        value: m.id,
        label: m.name,
        hint: m.description,
      })),
    });
    if (p.isCancel(modelChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    model = modelChoice as string;
  }

  return { runtime, model };
}

async function phase1Configure(args: CliArgs): Promise<Config> {
  p.intro("implement-epic");

  // Epic selection
  const epic = await selectEpic(args);
  p.log.success(`Selected epic: ${epic.name}`);

  // Branch configuration
  const { createBranch: doBranch, branchFrom, bringChanges } =
    await configureBranch(args);

  // PR configuration (only if branching)
  let openPR = false;
  let prTarget = getDefaultBranch();
  if (doBranch) {
    const prConfig = await configurePR(args, epic);
    openPR = prConfig.openPR;
    prTarget = prConfig.prTarget;
  }

  // Commit configuration
  const commitEach = await configureCommits(args);

  // Runtime/model selection
  p.log.step("Configuring runtimes...");
  const { runtime: planningRuntime, model: planningModel } =
    await selectRuntime(args, "planning");
  const { runtime: implRuntime, model: implModel } =
    await selectRuntime(args, "implementation");

  return {
    epic,
    createBranch: doBranch,
    branchFrom,
    bringChanges,
    openPR,
    prTarget,
    commitEach,
    planningRuntime,
    planningModel,
    implRuntime,
    implModel,
    verbose: args.verbose || false,
  };
}

// ============================================================================
// Phase 2: Setup (Branch + PR)
// ============================================================================

async function phase2Setup(): Promise<void> {
  p.log.step("Setting up git branch...");

  if (!config.createBranch) {
    p.log.info(`Working on current branch: ${getCurrentBranch()}`);
    return;
  }

  // Generate and create branch
  const { branchName, suffix } = generateEpicBranchName(config.epic.epicName);
  config.branchName = branchName;
  config.branchSuffix = suffix;

  const result = createBranch(branchName, config.branchFrom);
  if (!result.success) {
    p.log.error(`Failed to create branch: ${result.stderr}`);
    process.exit(1);
  }

  p.log.success(`Created and checked out branch: ${branchName}`);

  // Push branch and create PR if configured
  if (config.openPR) {
    p.log.step("Creating draft PR...");

    // Push the branch first
    const pushResult = pushBranch(branchName, true);
    if (!pushResult.success) {
      p.log.error(`Failed to push branch: ${pushResult.stderr}`);
      process.exit(1);
    }

    // Create draft PR
    const prTitle = `feat: ${config.epic.epicName} (${suffix})`;
    const prResult = createDraftPR(prTitle, config.prTarget);

    if (prResult.success) {
      const prUrl = getPRUrl();
      p.log.success(`Created draft PR: ${prUrl}`);
    } else {
      p.log.warn(`Failed to create PR: ${prResult.stderr}`);
    }
  }
}

// ============================================================================
// Phase 3: Create Features
// ============================================================================

async function phase3CreateFeatures(): Promise<void> {
  p.log.step("Phase 3: Create Features");

  const prompt = `Run the prompt at ouroboros/prompts/create-features.md with the epic path: ${config.epic.path}

Complete all phases without stopping for confirmation. When features-index.yml and feature PRDs are created, you're done.`;

  await runPrompt(
    config.planningRuntime,
    config.planningModel,
    prompt,
    "Create Features"
  );

  // Verify files were created
  const featuresIndex = readFeaturesIndex(config.epic.path);
  const features = discoverFeaturesFromDirectory(config.epic.path);

  if (!featuresIndex || features.length === 0) {
    p.log.error("Features were not created properly.");
    p.log.info("Check the output above for errors.");
    process.exit(1);
  }

  p.log.success(`Created ${features.length} feature(s)`);

  await maybeCommit(`docs: plan features for ${config.epic.epicName}`);
}

// ============================================================================
// Phase 4: Create Tasks
// ============================================================================

async function phase4CreateTasks(startIndex: number = 0): Promise<void> {
  p.log.step("Phase 4: Create Tasks");

  const features = discoverFeaturesFromDirectory(config.epic.path);

  for (let i = startIndex; i < features.length; i++) {
    const feature = features[i];

    if (feature.hasTasks) {
      verbose(`Skipping ${feature.folderName} - already has tasks.md`);
      continue;
    }

    p.log.info(`Creating tasks for feature: ${feature.folderName}`);

    const prompt = `Run the prompt at ouroboros/prompts/create-tasks.md with the feature path: ${feature.path}

Complete all phases without stopping for confirmation. When tasks.md is created, you're done.`;

    await runPrompt(
      config.planningRuntime,
      config.planningModel,
      prompt,
      `Create Tasks: ${feature.name}`
    );

    // Verify tasks.md was created
    if (!existsSync(join(feature.path, "tasks.md"))) {
      p.log.error(`tasks.md was not created for ${feature.folderName}`);
      process.exit(1);
    }

    await maybeCommit(`docs: plan tasks for ${feature.name}`);
  }

  p.log.success("All tasks created");
}

// ============================================================================
// Phase 5: Create Task Prompts
// ============================================================================

async function phase5CreateTaskPrompts(startIndex: number = 0): Promise<void> {
  p.log.step("Phase 5: Create Task Prompts");

  const features = discoverFeaturesFromDirectory(config.epic.path);

  for (let i = startIndex; i < features.length; i++) {
    const feature = features[i];

    if (feature.hasPrompts) {
      verbose(`Skipping ${feature.folderName} - already has prompts`);
      continue;
    }

    p.log.info(`Creating task prompts for feature: ${feature.folderName}`);

    const prompt = `Run the prompt at ouroboros/prompts/create-task-prompts.md with the feature path: ${feature.path}

Complete all phases without stopping for confirmation. When progress.yml and prompt files are created, you're done.`;

    await runPrompt(
      config.planningRuntime,
      config.planningModel,
      prompt,
      `Create Task Prompts: ${feature.name}`
    );

    // Verify prompts were created
    const progress = readProgressYml(feature.path);
    if (!progress) {
      p.log.error(`progress.yml was not created for ${feature.folderName}`);
      process.exit(1);
    }

    await maybeCommit(`docs: create task prompts for ${feature.name}`);
  }

  p.log.success("All task prompts created");
}

// ============================================================================
// Phase 6: Implementation
// ============================================================================

async function phase6Implement(
  startFeatureIndex: number = 0,
  startTaskGroupIndex: number = 0
): Promise<void> {
  p.log.step("Phase 6: Implementation");

  const features = discoverFeaturesFromDirectory(config.epic.path);

  for (let fi = startFeatureIndex; fi < features.length; fi++) {
    const feature = features[fi];
    const progress = readProgressYml(feature.path);

    if (!progress) {
      p.log.error(`No progress.yml found for ${feature.folderName}`);
      process.exit(1);
    }

    p.log.info(`Implementing feature: ${feature.folderName}`);

    const startTg = fi === startFeatureIndex ? startTaskGroupIndex : 0;

    for (let tgi = startTg; tgi < progress.task_groups.length; tgi++) {
      const taskGroup = progress.task_groups[tgi];

      if (taskGroup.completed) {
        verbose(`Skipping ${taskGroup.name} - already completed`);
        continue;
      }

      p.log.info(`  Task group: ${taskGroup.name}`);

      // Find the prompt file
      const promptFile = findTaskPromptFile(feature.path, tgi, taskGroup.name);
      if (!promptFile) {
        p.log.error(`Prompt file not found for task group: ${taskGroup.name}`);
        process.exit(1);
      }

      const prompt = `Execute the instructions in @${promptFile}

Complete all tasks in this task group. Update progress.yml when done.`;

      await runPrompt(
        config.implRuntime,
        config.implModel,
        prompt,
        `${feature.name}: ${taskGroup.name}`
      );

      // Verify progress.yml was updated
      const updatedProgress = readProgressYml(feature.path);
      if (!updatedProgress) {
        p.log.error("Failed to read progress.yml after execution");
        process.exit(1);
      }

      const updatedTaskGroup = updatedProgress.task_groups[tgi];
      if (!updatedTaskGroup.completed) {
        p.log.warn(
          `Task group ${taskGroup.name} was not marked as completed in progress.yml`
        );
        p.log.info("The implementation may be incomplete. Continuing anyway...");
      }

      // Commit with appropriate message
      const isLast = isLastTaskGroup(feature.path, tgi);
      const commitPrefix = isLast ? "feat" : "wip";
      await maybeCommit(`${commitPrefix}: ${feature.name} - ${taskGroup.name}`);
    }

    p.log.success(`Feature complete: ${feature.folderName}`);
  }

  p.log.success("All features implemented");
}

// ============================================================================
// Phase 7: Create Verification Guide
// ============================================================================

async function phase7CreateVerificationGuide(): Promise<void> {
  p.log.step("Phase 7: Create Verification Guide");

  const prompt = `Run the prompt at ouroboros/prompts/create-verification-guide.md with the epic path: ${config.epic.path}

Complete all phases. When verification-guide.md is created at the epic root, you're done.`;

  await runPrompt(
    config.planningRuntime,
    config.planningModel,
    prompt,
    "Create Verification Guide"
  );

  // Verify file was created
  if (!existsSync(join(config.epic.path, "verification-guide.md"))) {
    p.log.warn("verification-guide.md was not created");
  } else {
    p.log.success("Created verification-guide.md");
  }

  await maybeCommit(`docs: add verification guide for ${config.epic.epicName}`);
}

// ============================================================================
// Final Steps
// ============================================================================

async function finalize(): Promise<void> {
  // Mark PR as ready if we created one
  if (config.openPR && config.branchName) {
    p.log.step("Finalizing PR...");

    // Push any remaining commits
    pushBranch(config.branchName, false);

    // Remove draft status
    const result = markPRReady();
    if (result.success) {
      const prUrl = getPRUrl();
      p.log.success(`PR marked as ready: ${prUrl}`);
    } else {
      p.log.warn(`Failed to mark PR as ready: ${result.stderr}`);
    }
  }

  // Display token usage summary
  console.log();
  p.log.step("Token Usage Summary");
  console.log();
  console.log(`  Total steps:       ${tokenStats.stepCount}`);
  console.log(`  Total duration:    ${formatDuration(tokenStats.totalDurationMs)}`);

  if (tokenStats.totalInputTokens > 0) {
    console.log(`  Input tokens:      ${formatNumber(tokenStats.totalInputTokens)}`);
    console.log(`  Output tokens:     ${formatNumber(tokenStats.totalOutputTokens)}`);
    if (tokenStats.totalCacheReadTokens > 0) {
      console.log(`  Cache read:        ${formatNumber(tokenStats.totalCacheReadTokens)}`);
    }
    if (tokenStats.totalCacheCreationTokens > 0) {
      console.log(`  Cache creation:    ${formatNumber(tokenStats.totalCacheCreationTokens)}`);
    }
    console.log(`  Total cost:        ${formatCost(tokenStats.totalCostUsd)}`);
  }

  console.log();
  p.outro("Epic implementation complete!");
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  try {
    // Phase 1: Configuration
    config = await phase1Configure(args);

    // Detect progress
    p.log.step("Detecting progress...");
    const progress = detectProgress(config.epic.path);
    p.log.info(progress.description);

    // Phase 2: Setup (Branch + PR)
    await phase2Setup();

    // Execute phases based on progress
    if (progress.phase <= 3) {
      await phase3CreateFeatures();
      // Refresh features for subsequent phases
    }

    if (progress.phase <= 4) {
      const startIndex = progress.phase === 4 ? progress.resumeFeatureIndex || 0 : 0;
      await phase4CreateTasks(startIndex);
    }

    if (progress.phase <= 5) {
      const startIndex = progress.phase === 5 ? progress.resumeFeatureIndex || 0 : 0;
      await phase5CreateTaskPrompts(startIndex);
    }

    if (progress.phase <= 6) {
      const startFeature = progress.resumeTaskGroup?.featureIndex || 0;
      const startTaskGroup = progress.resumeTaskGroup?.taskGroupIndex || 0;
      await phase6Implement(startFeature, startTaskGroup);
    }

    if (progress.phase <= 7) {
      await phase7CreateVerificationGuide();
    }

    // Finalize
    await finalize();
  } catch (error) {
    const err = error as Error;
    p.log.error(`Error: ${err.message}`);

    if (config?.verbose) {
      console.error(err.stack);
    }

    // Provide specific guidance for loop detection
    if (err instanceof LoopDetectedError) {
      p.log.info("The agent got stuck in a loop making repeated failing tool calls.");
      p.log.info("This usually happens when the agent can't figure out how to proceed.");
      if (config?.commitEach) {
        p.log.info("Changes have been reset to the last commit.");
      }
      p.log.info("Suggestions:");
      p.log.message("  1. Review the step that failed and simplify the task");
      p.log.message("  2. Try a different model (e.g., claude-opus-4 for complex tasks)");
      p.log.message("  3. Break down the task into smaller steps manually");
    }

    p.log.info("You can resume by running the script again.");
    process.exit(1);
  }
}

main();
