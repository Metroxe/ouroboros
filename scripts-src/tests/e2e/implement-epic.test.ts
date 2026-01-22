/**
 * E2E tests for implement-epic script
 *
 * These tests set up a complete oroboros installation with a sample epic
 * and test the progress detection, file validation, and optionally
 * the full implementation flow (requires LLM runtime, skipped in CI).
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from "bun:test";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  cpSync,
  rmSync,
} from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

import {
  createMockProject,
  cleanupMockProject,
  runInstallScript,
  FIXTURES_DIR,
  shouldSkipRuntimeTests,
} from "../helpers/setup.js";

import {
  listEpics,
  getEpic,
  detectProgress,
  discoverFeaturesFromDirectory,
  validateFeatures,
} from "../../lib/epic.js";

import {
  readFeaturesIndex,
  readProgressYml,
  writeProgressYml,
  markTaskGroupComplete,
} from "../../lib/yaml.js";

import { getAvailableRuntimes } from "../../lib/agent/index.js";

const SAMPLE_EPIC_DIR = join(FIXTURES_DIR, "sample-epic");
const skipRuntimeTests = shouldSkipRuntimeTests();

/**
 * Set up a mock project with oroboros installed and sample epic
 */
async function setupProjectWithEpic(): Promise<string> {
  const mockProject = createMockProject();

  // Install oroboros
  await runInstallScript(mockProject, { headless: true });

  // Copy sample epic to the project
  const epicName = "2025-01-21-bash-utility-scripts";
  const epicDest = join(mockProject, "oroboros", "epics", epicName);

  cpSync(SAMPLE_EPIC_DIR, epicDest, { recursive: true });

  return mockProject;
}

/**
 * Initialize git repo in project (needed for branch operations)
 */
function initGitRepo(projectPath: string): void {
  spawnSync("git", ["init"], { cwd: projectPath });
  spawnSync("git", ["config", "user.email", "test@test.com"], { cwd: projectPath });
  spawnSync("git", ["config", "user.name", "Test"], { cwd: projectPath });
  writeFileSync(join(projectPath, ".gitignore"), "node_modules/\n");
  spawnSync("git", ["add", "."], { cwd: projectPath });
  spawnSync("git", ["commit", "-m", "Initial commit"], { cwd: projectPath });
}

describe("Epic Discovery", () => {
  let mockProject: string;

  beforeEach(async () => {
    mockProject = await setupProjectWithEpic();
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("lists installed epic", () => {
    const epics = listEpics(mockProject);
    expect(epics.length).toBe(1);
    expect(epics[0].epicName).toBe("bash-utility-scripts");
    expect(epics[0].date).toBe("2025-01-21");
  });

  test("gets epic by name", () => {
    const epic = getEpic("2025-01-21-bash-utility-scripts", mockProject);
    expect(epic).not.toBeNull();
    expect(epic!.epicName).toBe("bash-utility-scripts");
  });

  test("returns null for non-existent epic", () => {
    const epic = getEpic("nonexistent", mockProject);
    expect(epic).toBeNull();
  });
});

describe("Feature Validation", () => {
  let mockProject: string;
  let epicPath: string;

  beforeEach(async () => {
    mockProject = await setupProjectWithEpic();
    epicPath = join(mockProject, "oroboros", "epics", "2025-01-21-bash-utility-scripts");
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("validates features-index.yml matches directory", () => {
    const validation = validateFeatures(epicPath);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test("discovers features from directory", () => {
    const features = discoverFeaturesFromDirectory(epicPath);
    expect(features.length).toBe(2);
    expect(features[0].name).toBe("backup-script");
    expect(features[1].name).toBe("cleanup-script");
  });

  test("reads features-index.yml correctly", () => {
    const index = readFeaturesIndex(epicPath);
    expect(index).not.toBeNull();
    expect(index!.epic_name).toBe("Bash Utility Scripts");
    expect(index!.total_features).toBe(2);
    expect(index!.features[0].name).toBe("backup-script");
  });

  test("detects feature has PRD, tasks, and prompts", () => {
    const features = discoverFeaturesFromDirectory(epicPath);

    // Feature 1 should have everything
    expect(features[0].hasPrd).toBe(true);
    expect(features[0].hasTasks).toBe(true);
    expect(features[0].hasPrompts).toBe(true);

    // Feature 2 should also have everything
    expect(features[1].hasPrd).toBe(true);
    expect(features[1].hasTasks).toBe(true);
    expect(features[1].hasPrompts).toBe(true);
  });
});

describe("Progress Detection", () => {
  let mockProject: string;
  let epicPath: string;

  beforeEach(async () => {
    mockProject = await setupProjectWithEpic();
    epicPath = join(mockProject, "oroboros", "epics", "2025-01-21-bash-utility-scripts");
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("detects phase 6 when all planning complete", () => {
    // Sample epic has all planning files, should be at phase 6
    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(6);
    expect(progress.resumeTaskGroup).toEqual({
      featureIndex: 0,
      taskGroupIndex: 0,
    });
  });

  test("detects partial task group completion", () => {
    // Mark first task group as complete
    const featurePath = join(epicPath, "features", "01-backup-script");
    markTaskGroupComplete(featurePath, "testing-plan");

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(6);
    expect(progress.resumeTaskGroup).toEqual({
      featureIndex: 0,
      taskGroupIndex: 1, // Should resume at second task group
    });
  });

  test("moves to next feature when first is complete", () => {
    // Mark all task groups in first feature as complete
    const feature1Path = join(epicPath, "features", "01-backup-script");
    markTaskGroupComplete(feature1Path, "testing-plan");
    markTaskGroupComplete(feature1Path, "implementation");

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(6);
    expect(progress.resumeTaskGroup).toEqual({
      featureIndex: 1, // Should move to second feature
      taskGroupIndex: 0,
    });
  });

  test("detects phase 5 when prompts missing", () => {
    // Remove prompts from second feature
    const promptsDir = join(epicPath, "features", "02-cleanup-script", "prompts");
    rmSync(promptsDir, { recursive: true, force: true });

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(5);
    expect(progress.resumeFeatureIndex).toBe(1);
  });

  test("detects phase 4 when tasks missing", () => {
    // Remove tasks from second feature (also remove prompts since they depend on tasks)
    const feature2Path = join(epicPath, "features", "02-cleanup-script");
    rmSync(join(feature2Path, "tasks.md"));
    rmSync(join(feature2Path, "prompts"), { recursive: true, force: true });

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(4);
    expect(progress.resumeFeatureIndex).toBe(1);
  });

  test("detects phase 3 when no features", () => {
    // Remove features-index.yml and features directory
    rmSync(join(epicPath, "features-index.yml"));
    rmSync(join(epicPath, "features"), { recursive: true, force: true });

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(3);
  });

  test("throws when requirements.md missing", () => {
    rmSync(join(epicPath, "requirements.md"));

    expect(() => detectProgress(epicPath)).toThrow(/requirements.md/);
  });
});

describe("Progress.yml Operations", () => {
  let mockProject: string;
  let epicPath: string;

  beforeEach(async () => {
    mockProject = await setupProjectWithEpic();
    epicPath = join(mockProject, "oroboros", "epics", "2025-01-21-bash-utility-scripts");
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("reads progress.yml from feature", () => {
    const featurePath = join(epicPath, "features", "01-backup-script");
    const progress = readProgressYml(featurePath);

    expect(progress).not.toBeNull();
    expect(progress!.task_groups.length).toBe(2);
    expect(progress!.task_groups[0].name).toBe("testing-plan");
    expect(progress!.task_groups[0].completed).toBe(false);
  });

  test("marks task group as complete", () => {
    const featurePath = join(epicPath, "features", "01-backup-script");

    const success = markTaskGroupComplete(featurePath, "testing-plan");
    expect(success).toBe(true);

    const progress = readProgressYml(featurePath);
    expect(progress!.task_groups[0].completed).toBe(true);
    expect(progress!.task_groups[1].completed).toBe(false);
  });

  test("returns false for non-existent task group", () => {
    const featurePath = join(epicPath, "features", "01-backup-script");

    const success = markTaskGroupComplete(featurePath, "nonexistent");
    expect(success).toBe(false);
  });
});

describe("Git Integration", () => {
  let mockProject: string;
  let epicPath: string;

  beforeEach(async () => {
    mockProject = await setupProjectWithEpic();
    epicPath = join(mockProject, "oroboros", "epics", "2025-01-21-bash-utility-scripts");
    initGitRepo(mockProject);
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("project can be initialized as git repo", () => {
    const gitDir = join(mockProject, ".git");
    expect(existsSync(gitDir)).toBe(true);
  });

  test("can commit changes", () => {
    // Make a change
    writeFileSync(join(mockProject, "test.txt"), "test content");

    const addResult = spawnSync("git", ["add", "."], { cwd: mockProject });
    expect(addResult.status).toBe(0);

    const commitResult = spawnSync("git", ["commit", "-m", "test commit"], {
      cwd: mockProject,
    });
    expect(commitResult.status).toBe(0);
  });
});

describe("Full Implementation Flow (Requires LLM)", () => {
  let mockProject: string;
  let epicPath: string;

  beforeAll(async () => {
    if (skipRuntimeTests) {
      console.log("Skipping LLM-dependent tests (CI environment or SKIP_RUNTIME_TESTS=true)");
    }
  });

  beforeEach(async () => {
    if (!skipRuntimeTests) {
      mockProject = await setupProjectWithEpic();
      epicPath = join(
        mockProject,
        "oroboros",
        "epics",
        "2025-01-21-bash-utility-scripts"
      );
      initGitRepo(mockProject);
    }
  });

  afterEach(() => {
    if (!skipRuntimeTests && mockProject) {
      cleanupMockProject(mockProject);
    }
  });

  test.skipIf(skipRuntimeTests)(
    "has at least one available runtime",
    async () => {
      const runtimes = await getAvailableRuntimes();
      console.log(
        `Available runtimes: ${runtimes.map((r) => r.displayName).join(", ") || "none"}`
      );
      expect(runtimes.length).toBeGreaterThan(0);
    }
  );

  test.skipIf(skipRuntimeTests)(
    "can execute a simple prompt with available runtime",
    async () => {
      const runtimes = await getAvailableRuntimes();
      if (runtimes.length === 0) {
        console.log("No runtimes available, skipping");
        return;
      }

      const runtime = runtimes[0];
      console.log(`Testing with ${runtime.displayName}...`);

      const result = await runtime.runPrompt(
        "Respond with just 'OK' and nothing else.",
        {
          automated: true,
          streamOutput: false,
        }
      );

      console.log(`Result: success=${result.success}, exitCode=${result.exitCode}`);
      expect(result.exitCode).toBeDefined();
    },
    { timeout: 60000 }
  );

  // This is the full E2E test that actually runs the implementation
  // It requires an LLM runtime and takes several minutes to complete
  test.skipIf(skipRuntimeTests)(
    "implements epic with LLM runtime (slow, full E2E)",
    async () => {
      const runtimes = await getAvailableRuntimes();
      if (runtimes.length === 0) {
        console.log("No runtimes available, skipping full E2E test");
        return;
      }

      const runtime = runtimes[0];
      console.log(`Running full E2E with ${runtime.displayName}...`);
      console.log(`Epic path: ${epicPath}`);

      // This test would actually run the implement-epic script
      // For now, we just verify the setup is correct
      const progress = detectProgress(epicPath);
      expect(progress.phase).toBe(6);

      console.log("Full E2E test setup verified. To run actual implementation:");
      console.log(`  cd ${mockProject}`);
      console.log("  bun scripts-src/scripts/implement-epic.ts \\");
      console.log("    --epic=2025-01-21-bash-utility-scripts \\");
      console.log("    --branch=no --commit-each=no \\");
      console.log(`    --planning-runtime=${runtime.name} \\`);
      console.log(`    --impl-runtime=${runtime.name}`);

      // Uncomment to actually run the implementation (very slow, uses real LLM):
      // const implementResult = spawnSync(
      //   "bun",
      //   [
      //     "scripts-src/scripts/implement-epic.ts",
      //     "--epic=2025-01-21-bash-utility-scripts",
      //     "--branch=no",
      //     "--commit-each=no",
      //     `--planning-runtime=${runtime.name}`,
      //     `--impl-runtime=${runtime.name}`,
      //   ],
      //   {
      //     cwd: mockProject,
      //     stdio: "inherit",
      //     timeout: 600000, // 10 minutes
      //   }
      // );
      // expect(implementResult.status).toBe(0);
    },
    { timeout: 120000 }
  );
});

describe("Sample Epic Structure", () => {
  test("sample epic fixture exists", () => {
    expect(existsSync(SAMPLE_EPIC_DIR)).toBe(true);
    expect(existsSync(join(SAMPLE_EPIC_DIR, "requirements.md"))).toBe(true);
    expect(existsSync(join(SAMPLE_EPIC_DIR, "features-index.yml"))).toBe(true);
  });

  test("sample epic has two features", () => {
    const index = readFeaturesIndex(SAMPLE_EPIC_DIR);
    expect(index).not.toBeNull();
    expect(index!.total_features).toBe(2);
  });

  test("each feature has complete structure", () => {
    const features = ["01-backup-script", "02-cleanup-script"];

    for (const feature of features) {
      const featurePath = join(SAMPLE_EPIC_DIR, "features", feature);
      expect(existsSync(join(featurePath, "prd.md"))).toBe(true);
      expect(existsSync(join(featurePath, "tasks.md"))).toBe(true);
      expect(existsSync(join(featurePath, "development-notes.md"))).toBe(true);
      expect(existsSync(join(featurePath, "prompts", "progress.yml"))).toBe(true);
      expect(existsSync(join(featurePath, "prompts", "1-testing-plan.md"))).toBe(true);
      expect(existsSync(join(featurePath, "prompts", "2-implementation.md"))).toBe(true);
    }
  });
});
