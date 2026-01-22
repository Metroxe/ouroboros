/**
 * Test helpers and utilities
 *
 * Provides shared utilities for spec and E2E tests.
 */

import { mkdtempSync, cpSync, rmSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import {
  ensureDir,
  exists,
  isDirectory,
  safeCopy,
  copyDirContents,
} from "../../lib/fs.js";
import { readInstalledVersion, writeVersion } from "../../lib/version.js";

/**
 * Path to the scripts-src directory
 */
export const SCRIPTS_SRC_DIR = resolve(import.meta.dir, "../..");

/**
 * Path to the oroboros source directory
 */
export const OROBOROS_SRC_DIR = resolve(SCRIPTS_SRC_DIR, "../oroboros");

/**
 * Path to the fixtures directory
 */
export const FIXTURES_DIR = resolve(import.meta.dir, "../fixtures");

/**
 * Create a temporary mock project directory
 * @returns Path to the created mock project
 */
export function createMockProject(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "oroboros-test-"));
  const mockProjectSrc = join(FIXTURES_DIR, "mock-project");

  if (existsSync(mockProjectSrc)) {
    cpSync(mockProjectSrc, tempDir, { recursive: true });
  }

  return tempDir;
}

/**
 * Clean up a mock project directory
 */
export function cleanupMockProject(projectPath: string): void {
  if (existsSync(projectPath) && projectPath.includes("oroboros-test-")) {
    rmSync(projectPath, { recursive: true, force: true });
  }
}

// Framework files that are always overwritten on update
const FRAMEWORK_DIRS = ["prompts", "scripts"];

// Scaffold files that are only created if missing
const SCAFFOLD_FILES = [
  ".gitignore",
  "reference/epic-index.md",
  "reference/gotchas.md",
];

/**
 * Run the install logic directly (not via subprocess)
 * This mimics what the compiled install script does, but uses the source oroboros directory.
 */
export async function runInstallScript(
  targetDir: string,
  options: { headless?: boolean } = {}
): Promise<{ success: boolean; output: string }> {
  try {
    const sourceDir = OROBOROS_SRC_DIR;
    const version = readInstalledVersion(sourceDir) || "0.0.0";
    const oroborosTarget = join(targetDir, "oroboros");

    // Step 1: Create base directory structure
    ensureDir(oroborosTarget);
    ensureDir(join(oroborosTarget, "epics"));
    ensureDir(join(oroborosTarget, "prompts"));
    ensureDir(join(oroborosTarget, "reference"));
    ensureDir(join(oroborosTarget, "scripts"));

    // Step 2: Copy framework files (always overwrite)
    for (const dir of FRAMEWORK_DIRS) {
      const srcDir = join(sourceDir, dir);
      const destDir = join(oroborosTarget, dir);

      if (exists(srcDir) && isDirectory(srcDir)) {
        copyDirContents(srcDir, destDir, { overwrite: true });
      }
    }

    // Step 3: Copy scaffold files (only if missing)
    for (const file of SCAFFOLD_FILES) {
      const srcPath = join(sourceDir, file);
      const destPath = join(oroborosTarget, file);

      if (exists(srcPath) && !exists(destPath)) {
        // Ensure parent directory exists
        ensureDir(join(destPath, ".."));
        safeCopy(srcPath, destPath);
      }
    }

    // Create .gitkeep in epics if empty
    const epicsDir = join(oroborosTarget, "epics");
    const gitkeep = join(epicsDir, ".gitkeep");
    if (!exists(gitkeep)) {
      writeFileSync(gitkeep, "");
    }

    // Step 4: Write version
    writeVersion(oroborosTarget, version);

    return {
      success: true,
      output: `Installed oroboros ${version} to ${oroborosTarget}`,
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Expected structure of an oroboros installation
 */
export interface OroborosStructure {
  hasOroborosDir: boolean;
  hasPromptsDir: boolean;
  hasReferenceDir: boolean;
  hasScriptsDir: boolean;
  hasEpicsDir: boolean;
  hasVersionFile: boolean;
  prompts: string[];
  reference: string[];
}

/**
 * Assert that an oroboros installation has the expected structure
 */
export function getOroborosStructure(projectPath: string): OroborosStructure {
  const oroborosDir = join(projectPath, "oroboros");
  const promptsDir = join(oroborosDir, "prompts");
  const referenceDir = join(oroborosDir, "reference");
  const scriptsDir = join(oroborosDir, "scripts");
  const epicsDir = join(oroborosDir, "epics");
  const versionFile = join(oroborosDir, ".version");

  return {
    hasOroborosDir: existsSync(oroborosDir),
    hasPromptsDir: existsSync(promptsDir),
    hasReferenceDir: existsSync(referenceDir),
    hasScriptsDir: existsSync(scriptsDir),
    hasEpicsDir: existsSync(epicsDir),
    hasVersionFile: existsSync(versionFile),
    prompts: existsSync(promptsDir) ? readdirSync(promptsDir) : [],
    reference: existsSync(referenceDir) ? readdirSync(referenceDir) : [],
  };
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === "true";
}

/**
 * Check if runtime tests should be skipped
 */
export function shouldSkipRuntimeTests(): boolean {
  return isCI() || process.env.SKIP_RUNTIME_TESTS === "true";
}
