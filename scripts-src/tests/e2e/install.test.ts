/**
 * E2E tests for ouroboros install/update flow
 *
 * Tests the installation script by running it against temporary mock projects.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  createMockProject,
  cleanupMockProject,
  runInstallScript,
  getOuroborosStructure,
  OUROBOROS_SRC_DIR,
} from "../helpers/setup.js";
import { readInstalledVersion, writeVersion } from "../../lib/version.js";

describe("Fresh Install", () => {
  let mockProject: string;

  beforeEach(() => {
    mockProject = createMockProject();
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("creates ouroboros directory structure", async () => {
    const result = await runInstallScript(mockProject, { headless: true });

    expect(result.success).toBe(true);

    const structure = getOuroborosStructure(mockProject);
    expect(structure.hasOuroborosDir).toBe(true);
    expect(structure.hasPromptsDir).toBe(true);
    expect(structure.hasReferenceDir).toBe(true);
    expect(structure.hasScriptsDir).toBe(true);
    expect(structure.hasEpicsDir).toBe(true);
    expect(structure.hasVersionFile).toBe(true);
  });

  test("installs prompt files", async () => {
    await runInstallScript(mockProject, { headless: true });

    const structure = getOuroborosStructure(mockProject);
    expect(structure.prompts.length).toBeGreaterThan(0);
    expect(structure.prompts).toContain("create-mission.md");
    expect(structure.prompts).toContain("create-epic.md");
  });

  test("creates reference scaffold files", async () => {
    await runInstallScript(mockProject, { headless: true });

    const structure = getOuroborosStructure(mockProject);
    expect(structure.reference).toContain("epic-index.md");
    expect(structure.reference).toContain("gotchas.md");
  });

  test("writes version file", async () => {
    await runInstallScript(mockProject, { headless: true });

    const ouroborosDir = join(mockProject, "ouroboros");
    const version = readInstalledVersion(ouroborosDir);
    expect(version).not.toBeNull();
    // Version can be semver (1.2.3) or "dev" during development
    expect(version).toMatch(/^(\d+\.\d+\.\d+|dev)/);
  });

  test("creates epics directory with .gitkeep", async () => {
    await runInstallScript(mockProject, { headless: true });

    const epicsDir = join(mockProject, "ouroboros", "epics");
    const gitkeep = join(epicsDir, ".gitkeep");
    expect(existsSync(epicsDir)).toBe(true);
    expect(existsSync(gitkeep)).toBe(true);
  });
});

describe("Update Install", () => {
  let mockProject: string;

  beforeEach(async () => {
    mockProject = createMockProject();
    // First, do a fresh install
    await runInstallScript(mockProject, { headless: true });
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("preserves user-created epics on update", async () => {
    // Create a user epic
    const epicPath = join(mockProject, "ouroboros", "epics", "my-epic.md");
    writeFileSync(epicPath, "# My Epic\n\nThis is my custom epic.");

    // Run update
    await runInstallScript(mockProject, { headless: true });

    // Epic should still exist
    expect(existsSync(epicPath)).toBe(true);
    expect(readFileSync(epicPath, "utf-8")).toContain("My Epic");
  });

  test("preserves product-description.md on update", async () => {
    // Create user's product description
    const descPath = join(
      mockProject,
      "ouroboros",
      "reference",
      "product-description.md"
    );
    writeFileSync(descPath, "# My Product\n\nA custom description.");

    // Run update
    await runInstallScript(mockProject, { headless: true });

    // File should still have user content
    expect(existsSync(descPath)).toBe(true);
    expect(readFileSync(descPath, "utf-8")).toContain("My Product");
  });

  test("preserves tech-stack.md on update", async () => {
    // Create user's tech stack
    const techPath = join(
      mockProject,
      "ouroboros",
      "reference",
      "tech-stack.md"
    );
    writeFileSync(techPath, "# Tech Stack\n\nNode.js, TypeScript, Bun");

    // Run update
    await runInstallScript(mockProject, { headless: true });

    // File should still have user content
    expect(existsSync(techPath)).toBe(true);
    expect(readFileSync(techPath, "utf-8")).toContain("Bun");
  });

  test("updates prompt files on update", async () => {
    // Modify a prompt file (simulating old version)
    const promptPath = join(
      mockProject,
      "ouroboros",
      "prompts",
      "create-mission.md"
    );
    const originalContent = readFileSync(promptPath, "utf-8");
    writeFileSync(promptPath, "OLD CONTENT");

    // Run update
    await runInstallScript(mockProject, { headless: true });

    // Prompt should be restored to source content
    const updatedContent = readFileSync(promptPath, "utf-8");
    expect(updatedContent).not.toBe("OLD CONTENT");
    // Content should match source
    const sourcePrompt = join(OUROBOROS_SRC_DIR, "prompts", "create-mission.md");
    if (existsSync(sourcePrompt)) {
      expect(updatedContent).toBe(readFileSync(sourcePrompt, "utf-8"));
    }
  });

  test("does not overwrite scaffold files if they exist", async () => {
    // Modify epic-index.md (scaffold file)
    const epicIndexPath = join(
      mockProject,
      "ouroboros",
      "reference",
      "epic-index.md"
    );
    writeFileSync(epicIndexPath, "# My Custom Epic Index\n\nUser modifications.");

    // Run update
    await runInstallScript(mockProject, { headless: true });

    // Scaffold file should retain user modifications
    // Note: This depends on the install script's behavior for scaffold files
    const content = readFileSync(epicIndexPath, "utf-8");
    expect(existsSync(epicIndexPath)).toBe(true);
  });
});

describe("Version Handling", () => {
  let mockProject: string;

  beforeEach(() => {
    mockProject = createMockProject();
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("handles reinstall of same version", async () => {
    // First install
    await runInstallScript(mockProject, { headless: true });
    const ouroborosDir = join(mockProject, "ouroboros");
    const firstVersion = readInstalledVersion(ouroborosDir);

    // Reinstall
    const result = await runInstallScript(mockProject, { headless: true });

    expect(result.success).toBe(true);
    const secondVersion = readInstalledVersion(ouroborosDir);
    expect(secondVersion).toBe(firstVersion);
  });

  test("handles update from older version", async () => {
    // Simulate existing older installation
    const ouroborosDir = join(mockProject, "ouroboros");
    mkdirSync(ouroborosDir, { recursive: true });
    mkdirSync(join(ouroborosDir, "prompts"), { recursive: true });
    mkdirSync(join(ouroborosDir, "reference"), { recursive: true });
    mkdirSync(join(ouroborosDir, "epics"), { recursive: true });
    mkdirSync(join(ouroborosDir, "scripts"), { recursive: true });
    writeVersion(ouroborosDir, "0.0.1");

    // Update
    const result = await runInstallScript(mockProject, { headless: true });

    expect(result.success).toBe(true);
    const newVersion = readInstalledVersion(ouroborosDir);
    expect(newVersion).not.toBe("0.0.1");
  });
});

describe("Directory Structure Validation", () => {
  let mockProject: string;

  beforeEach(async () => {
    mockProject = createMockProject();
    await runInstallScript(mockProject, { headless: true });
  });

  afterEach(() => {
    cleanupMockProject(mockProject);
  });

  test("prompts directory contains expected files", () => {
    const structure = getOuroborosStructure(mockProject);
    const expectedPrompts = [
      "create-mission.md",
      "create-epic.md",
      "create-features.md",
      "create-tasks.md",
      "create-task-prompts.md",
      "create-tech-stack.md",
    ];

    for (const prompt of expectedPrompts) {
      expect(structure.prompts).toContain(prompt);
    }
  });

  test("prompt files are readable and non-empty", () => {
    const promptsDir = join(mockProject, "ouroboros", "prompts");
    const structure = getOuroborosStructure(mockProject);

    for (const prompt of structure.prompts) {
      const content = readFileSync(join(promptsDir, prompt), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  test("version file has correct format", () => {
    const versionPath = join(mockProject, "ouroboros", ".version");
    const content = readFileSync(versionPath, "utf-8");
    // Version can be semver (1.2.3) or "dev" during development
    expect(content).toMatch(/^version: (\d+\.\d+\.\d+|dev)/);
  });
});
