/**
 * Tests for Epic utilities
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  listEpics,
  getEpic,
  hasRequirements,
  hasFeaturesIndex,
  discoverFeaturesFromDirectory,
  validateFeatures,
  detectProgress,
  getTaskPromptPath,
  findTaskPromptFile,
  countPromptFiles,
  isFeatureComplete,
  getTaskGroupCount,
  isLastTaskGroup,
} from "../../lib/epic.js";
import { writeFeaturesIndex, writeProgressYml } from "../../lib/yaml.js";

/**
 * Create a mock ouroboros structure in a temp directory
 */
function createMockOuroboros(basePath: string): string {
  const ouroborosPath = join(basePath, "ouroboros");
  mkdirSync(join(ouroborosPath, "epics"), { recursive: true });
  return ouroborosPath;
}

/**
 * Create a mock epic
 */
function createMockEpic(
  ouroborosPath: string,
  name: string,
  options: {
    hasRequirements?: boolean;
    features?: Array<{
      name: string;
      hasPrd?: boolean;
      hasTasks?: boolean;
      hasPrompts?: boolean;
      taskGroups?: Array<{ name: string; completed: boolean }>;
    }>;
  } = {}
): string {
  const epicPath = join(ouroborosPath, "epics", name);
  mkdirSync(epicPath, { recursive: true });

  if (options.hasRequirements !== false) {
    writeFileSync(join(epicPath, "requirements.md"), "# Requirements");
  }

  if (options.features) {
    mkdirSync(join(epicPath, "features"), { recursive: true });

    const featuresIndex = {
      epic_name: name,
      epic_path: epicPath,
      generated: "2025-01-21",
      total_features: options.features.length,
      features: options.features.map((f, i) => ({
        number: String(i + 1).padStart(2, "0"),
        name: f.name,
        path: `features/${String(i + 1).padStart(2, "0")}-${f.name}/prd.md`,
        description: `Feature ${f.name}`,
        completed: false,
      })),
    };

    writeFeaturesIndex(epicPath, featuresIndex);

    for (let i = 0; i < options.features.length; i++) {
      const feature = options.features[i];
      const featureNum = String(i + 1).padStart(2, "0");
      const featurePath = join(epicPath, "features", `${featureNum}-${feature.name}`);
      mkdirSync(featurePath, { recursive: true });

      if (feature.hasPrd !== false) {
        writeFileSync(join(featurePath, "prd.md"), "# PRD");
      }

      if (feature.hasTasks) {
        writeFileSync(join(featurePath, "tasks.md"), "# Tasks");
      }

      if (feature.hasPrompts || feature.taskGroups) {
        mkdirSync(join(featurePath, "prompts"), { recursive: true });

        const taskGroups = feature.taskGroups || [
          { name: "testing-plan", completed: false },
          { name: "implementation", completed: false },
        ];

        writeProgressYml(featurePath, { task_groups: taskGroups });

        // Create prompt files
        taskGroups.forEach((tg, idx) => {
          writeFileSync(
            join(featurePath, "prompts", `${idx + 1}-${tg.name}.md`),
            `# Task Group ${idx + 1}: ${tg.name}`
          );
        });
      }
    }
  }

  return epicPath;
}

describe("listEpics", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns empty array when no epics", () => {
    createMockOuroboros(tempDir);
    const epics = listEpics(tempDir);
    expect(epics).toEqual([]);
  });

  test("lists epics sorted by date (newest first)", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    createMockEpic(ouroborosPath, "2025-01-15-older-epic");
    createMockEpic(ouroborosPath, "2025-01-20-newer-epic");
    createMockEpic(ouroborosPath, "2025-01-10-oldest-epic");

    const epics = listEpics(tempDir);
    expect(epics.length).toBe(3);
    expect(epics[0].name).toBe("2025-01-20-newer-epic");
    expect(epics[1].name).toBe("2025-01-15-older-epic");
    expect(epics[2].name).toBe("2025-01-10-oldest-epic");
  });

  test("parses epic name correctly", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    createMockEpic(ouroborosPath, "2025-01-21-user-authentication");

    const epics = listEpics(tempDir);
    expect(epics[0].date).toBe("2025-01-21");
    expect(epics[0].epicName).toBe("user-authentication");
  });

  test("ignores invalid folder names", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    createMockEpic(ouroborosPath, "2025-01-21-valid-epic");
    mkdirSync(join(ouroborosPath, "epics", "invalid-no-date"), { recursive: true });
    mkdirSync(join(ouroborosPath, "epics", ".hidden"), { recursive: true });

    const epics = listEpics(tempDir);
    expect(epics.length).toBe(1);
    expect(epics[0].name).toBe("2025-01-21-valid-epic");
  });
});

describe("getEpic", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns epic by name", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    createMockEpic(ouroborosPath, "2025-01-21-my-epic");

    const epic = getEpic("2025-01-21-my-epic", tempDir);
    expect(epic).not.toBeNull();
    expect(epic!.epicName).toBe("my-epic");
  });

  test("returns null for non-existent epic", () => {
    createMockOuroboros(tempDir);
    const epic = getEpic("nonexistent", tempDir);
    expect(epic).toBeNull();
  });
});

describe("hasRequirements", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns true when requirements.md exists", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      hasRequirements: true,
    });

    expect(hasRequirements(epicPath)).toBe(true);
  });

  test("returns false when requirements.md missing", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      hasRequirements: false,
    });

    expect(hasRequirements(epicPath)).toBe(false);
  });
});

describe("discoverFeaturesFromDirectory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("discovers features from directory", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        { name: "feature-one", hasTasks: true, hasPrompts: true },
        { name: "feature-two", hasTasks: false },
      ],
    });

    const features = discoverFeaturesFromDirectory(epicPath);
    expect(features.length).toBe(2);
    expect(features[0].name).toBe("feature-one");
    expect(features[0].number).toBe("01");
    expect(features[0].hasPrd).toBe(true);
    expect(features[0].hasTasks).toBe(true);
    expect(features[0].hasPrompts).toBe(true);

    expect(features[1].name).toBe("feature-two");
    expect(features[1].hasTasks).toBe(false);
    expect(features[1].hasPrompts).toBe(false);
  });

  test("returns features sorted by number", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        { name: "third" },
        { name: "first" },
        { name: "second" },
      ],
    });

    const features = discoverFeaturesFromDirectory(epicPath);
    expect(features[0].number).toBe("01");
    expect(features[1].number).toBe("02");
    expect(features[2].number).toBe("03");
  });
});

describe("validateFeatures", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("valid when index matches directory", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [{ name: "feature-one" }, { name: "feature-two" }],
    });

    const validation = validateFeatures(epicPath);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test("invalid when features-index.yml missing", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = join(ouroborosPath, "epics", "2025-01-21-test");
    mkdirSync(epicPath, { recursive: true });

    const validation = validateFeatures(epicPath);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("features-index.yml not found");
  });
});

describe("detectProgress", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("throws when requirements.md missing", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      hasRequirements: false,
    });

    expect(() => detectProgress(epicPath)).toThrow(/requirements.md/);
  });

  test("returns phase 3 when no features", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test");

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(3);
  });

  test("returns phase 4 when features exist but missing tasks", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        { name: "feature-one", hasTasks: true },
        { name: "feature-two", hasTasks: false },
      ],
    });

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(4);
    expect(progress.resumeFeatureIndex).toBe(1);
  });

  test("returns phase 5 when tasks exist but missing prompts", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        { name: "feature-one", hasTasks: true, hasPrompts: true },
        { name: "feature-two", hasTasks: true, hasPrompts: false },
      ],
    });

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(5);
    expect(progress.resumeFeatureIndex).toBe(1);
  });

  test("returns phase 6 with resume info when partially implemented", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [
            { name: "testing", completed: true },
            { name: "implementation", completed: false },
          ],
        },
      ],
    });

    const progress = detectProgress(epicPath);
    expect(progress.phase).toBe(6);
    expect(progress.resumeTaskGroup).toEqual({
      featureIndex: 0,
      taskGroupIndex: 1,
    });
  });
});

describe("prompt file utilities", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("getTaskPromptPath returns correct path", () => {
    const path = getTaskPromptPath("/path/to/feature", 0, "testing-plan");
    expect(path).toBe("/path/to/feature/prompts/1-testing-plan.md");
  });

  test("findTaskPromptFile finds existing prompt", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [{ name: "testing", completed: false }],
        },
      ],
    });

    const featurePath = join(epicPath, "features", "01-feature-one");
    const promptFile = findTaskPromptFile(featurePath, 0, "testing");
    expect(promptFile).not.toBeNull();
    expect(promptFile).toContain("1-testing.md");
  });

  test("countPromptFiles returns correct count", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [
            { name: "testing", completed: false },
            { name: "impl", completed: false },
            { name: "verify", completed: false },
          ],
        },
      ],
    });

    const featurePath = join(epicPath, "features", "01-feature-one");
    const count = countPromptFiles(featurePath);
    expect(count).toBe(3);
  });
});

describe("feature completion utilities", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "epic-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("isFeatureComplete returns false when tasks incomplete", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [
            { name: "testing", completed: true },
            { name: "impl", completed: false },
          ],
        },
      ],
    });

    const featurePath = join(epicPath, "features", "01-feature-one");
    expect(isFeatureComplete(featurePath)).toBe(false);
  });

  test("isFeatureComplete returns true when all tasks complete", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [
            { name: "testing", completed: true },
            { name: "impl", completed: true },
          ],
        },
      ],
    });

    const featurePath = join(epicPath, "features", "01-feature-one");
    expect(isFeatureComplete(featurePath)).toBe(true);
  });

  test("getTaskGroupCount returns correct count", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [
            { name: "one", completed: false },
            { name: "two", completed: false },
            { name: "three", completed: false },
          ],
        },
      ],
    });

    const featurePath = join(epicPath, "features", "01-feature-one");
    expect(getTaskGroupCount(featurePath)).toBe(3);
  });

  test("isLastTaskGroup returns true for last group", () => {
    const ouroborosPath = createMockOuroboros(tempDir);
    const epicPath = createMockEpic(ouroborosPath, "2025-01-21-test", {
      features: [
        {
          name: "feature-one",
          hasTasks: true,
          taskGroups: [
            { name: "one", completed: false },
            { name: "two", completed: false },
          ],
        },
      ],
    });

    const featurePath = join(epicPath, "features", "01-feature-one");
    expect(isLastTaskGroup(featurePath, 0)).toBe(false);
    expect(isLastTaskGroup(featurePath, 1)).toBe(true);
  });
});
