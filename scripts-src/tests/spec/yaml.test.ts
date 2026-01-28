/**
 * Tests for YAML utilities
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  parseYamlFile,
  writeYamlFile,
  readFeaturesIndex,
  writeFeaturesIndex,
  readProgressYml,
  writeProgressYml,
  getFirstIncompleteTaskGroup,
  allTaskGroupsComplete,
  markTaskGroupComplete,
  markFeatureComplete,
  type FeaturesIndex,
  type ProgressYml,
} from "../../lib/yaml.js";

describe("parseYamlFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yaml-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("parses valid YAML file", () => {
    const filePath = join(tempDir, "test.yml");
    writeFileSync(
      filePath,
      `
name: test
value: 123
items:
  - one
  - two
`
    );

    const result = parseYamlFile<{ name: string; value: number; items: string[] }>(filePath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("test");
    expect(result!.value).toBe(123);
    expect(result!.items).toEqual(["one", "two"]);
  });

  test("returns null for non-existent file", () => {
    const result = parseYamlFile(join(tempDir, "nonexistent.yml"));
    expect(result).toBeNull();
  });

  test("returns null for invalid YAML", () => {
    const filePath = join(tempDir, "invalid.yml");
    writeFileSync(filePath, "{ invalid yaml: [");

    const result = parseYamlFile(filePath);
    expect(result).toBeNull();
  });
});

describe("writeYamlFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yaml-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("writes object to YAML file", () => {
    const filePath = join(tempDir, "output.yml");
    const data = { name: "test", count: 5, enabled: true };

    writeYamlFile(filePath, data);

    expect(existsSync(filePath)).toBe(true);
    const parsed = parseYamlFile<typeof data>(filePath);
    expect(parsed).toEqual(data);
  });

  test("writes arrays correctly", () => {
    const filePath = join(tempDir, "array.yml");
    const data = { items: ["a", "b", "c"] };

    writeYamlFile(filePath, data);

    const parsed = parseYamlFile<typeof data>(filePath);
    expect(parsed!.items).toEqual(["a", "b", "c"]);
  });
});

describe("FeaturesIndex operations", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yaml-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const sampleFeaturesIndex: FeaturesIndex = {
    epic_name: "Test Epic",
    epic_path: "ouroboros/epics/2025-01-21-test-epic",
    generated: "2025-01-21",
    total_features: 2,
    features: [
      {
        number: "01",
        name: "feature-one",
        path: "features/01-feature-one/prd.md",
        description: "First feature",
        completed: false,
      },
      {
        number: "02",
        name: "feature-two",
        path: "features/02-feature-two/prd.md",
        description: "Second feature",
        completed: false,
      },
    ],
  };

  test("reads features-index.yml", () => {
    writeFileSync(
      join(tempDir, "features-index.yml"),
      `
epic_name: Test Epic
epic_path: ouroboros/epics/2025-01-21-test-epic
generated: "2025-01-21"
total_features: 2
features:
  - number: "01"
    name: feature-one
    path: features/01-feature-one/prd.md
    description: First feature
    completed: false
  - number: "02"
    name: feature-two
    path: features/02-feature-two/prd.md
    description: Second feature
    completed: false
`
    );

    const result = readFeaturesIndex(tempDir);
    expect(result).not.toBeNull();
    expect(result!.epic_name).toBe("Test Epic");
    expect(result!.features.length).toBe(2);
    expect(result!.features[0].name).toBe("feature-one");
  });

  test("writes features-index.yml", () => {
    writeFeaturesIndex(tempDir, sampleFeaturesIndex);

    const result = readFeaturesIndex(tempDir);
    expect(result).not.toBeNull();
    expect(result!.epic_name).toBe("Test Epic");
    expect(result!.features.length).toBe(2);
  });

  test("marks feature as complete", () => {
    writeFeaturesIndex(tempDir, sampleFeaturesIndex);

    const success = markFeatureComplete(tempDir, "01");
    expect(success).toBe(true);

    const result = readFeaturesIndex(tempDir);
    expect(result!.features[0].completed).toBe(true);
    expect(result!.features[1].completed).toBe(false);
  });

  test("returns false for non-existent feature", () => {
    writeFeaturesIndex(tempDir, sampleFeaturesIndex);

    const success = markFeatureComplete(tempDir, "99");
    expect(success).toBe(false);
  });
});

describe("ProgressYml operations", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yaml-test-"));
    mkdirSync(join(tempDir, "prompts"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const sampleProgress: ProgressYml = {
    task_groups: [
      { name: "testing-plan", completed: false },
      { name: "data-layer", completed: false },
      { name: "api-layer", completed: false },
    ],
  };

  test("reads progress.yml", () => {
    writeFileSync(
      join(tempDir, "prompts", "progress.yml"),
      `
task_groups:
  - name: testing-plan
    completed: false
  - name: data-layer
    completed: false
`
    );

    const result = readProgressYml(tempDir);
    expect(result).not.toBeNull();
    expect(result!.task_groups.length).toBe(2);
    expect(result!.task_groups[0].name).toBe("testing-plan");
  });

  test("writes progress.yml", () => {
    writeProgressYml(tempDir, sampleProgress);

    const result = readProgressYml(tempDir);
    expect(result).not.toBeNull();
    expect(result!.task_groups.length).toBe(3);
  });

  test("getFirstIncompleteTaskGroup finds first incomplete", () => {
    const progress: ProgressYml = {
      task_groups: [
        { name: "one", completed: true },
        { name: "two", completed: false },
        { name: "three", completed: false },
      ],
    };

    expect(getFirstIncompleteTaskGroup(progress)).toBe(1);
  });

  test("getFirstIncompleteTaskGroup returns -1 when all complete", () => {
    const progress: ProgressYml = {
      task_groups: [
        { name: "one", completed: true },
        { name: "two", completed: true },
      ],
    };

    expect(getFirstIncompleteTaskGroup(progress)).toBe(-1);
  });

  test("allTaskGroupsComplete returns true when all complete", () => {
    const progress: ProgressYml = {
      task_groups: [
        { name: "one", completed: true },
        { name: "two", completed: true },
      ],
    };

    expect(allTaskGroupsComplete(progress)).toBe(true);
  });

  test("allTaskGroupsComplete returns false when any incomplete", () => {
    const progress: ProgressYml = {
      task_groups: [
        { name: "one", completed: true },
        { name: "two", completed: false },
      ],
    };

    expect(allTaskGroupsComplete(progress)).toBe(false);
  });

  test("marks task group as complete", () => {
    writeProgressYml(tempDir, sampleProgress);

    const success = markTaskGroupComplete(tempDir, "data-layer");
    expect(success).toBe(true);

    const result = readProgressYml(tempDir);
    expect(result!.task_groups[0].completed).toBe(false);
    expect(result!.task_groups[1].completed).toBe(true);
    expect(result!.task_groups[2].completed).toBe(false);
  });
});
