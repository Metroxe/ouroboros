#!/usr/bin/env bun
/**
 * Oroboros Install Script
 * 
 * Handles both fresh installations and updates of oroboros.
 * 
 * Usage:
 *   ./install [target-directory]
 *   
 * If no target directory is specified, installs to current directory.
 * 
 * File Categories:
 * - Framework files (always overwrite): prompts/*, scripts/*, .version
 * - User-generated (never touch): epics/*, reference/product-description.md, reference/tech-stack.md
 * - Scaffold files (create if missing): reference/epic-index.md, reference/gotchas.md
 */

import { join, resolve } from "path";
import {
  header,
  footer,
  confirmWithDefault,
  isHeadless,
  log,
  spinner,
  isCancel,
  cancel,
} from "../lib/cli.js";
import {
  exists,
  ensureDir,
  safeCopy,
  copyDirContents,
  isDirectory,
} from "../lib/fs.js";
import {
  readInstalledVersion,
  writeVersion,
  isUpdateAvailable,
  compareVersions,
} from "../lib/version.js";

// Determine the source oroboros directory (where this script lives)
// When compiled, this will be in oroboros/scripts/install
// The source files are in the parent oroboros/ directory
function getSourceDir(): string {
  // For compiled Bun binaries, process.execPath gives the actual executable path
  // This works both for compiled binaries and when running with `bun run`
  const scriptPath = process.execPath;
  
  // Go up from scripts/ to oroboros/
  const oroborosDir = resolve(join(scriptPath, "..", ".."));
  
  return oroborosDir;
}

// Get the version from the source .version file
function getSourceVersion(): string {
  const version = readInstalledVersion(getSourceDir());
  return version || "0.0.0";
}

// Framework files that are always overwritten on update
const FRAMEWORK_DIRS = ["prompts", "scripts"];

// Scaffold files that are only created if missing
const SCAFFOLD_FILES = [
  "reference/epic-index.md",
  "reference/gotchas.md",
];

// User-generated paths that are never touched
const USER_PATHS = [
  "epics",
  "reference/product-description.md",
  "reference/tech-stack.md",
];

interface InstallOptions {
  targetDir: string;
  sourceDir: string;
  version: string;
  isUpdate: boolean;
  installedVersion: string | null;
}

async function performInstall(options: InstallOptions): Promise<void> {
  const { targetDir, sourceDir, version, isUpdate, installedVersion } = options;
  const oroborosTarget = join(targetDir, "oroboros");
  
  const s = spinner();
  
  // Step 1: Create base directory structure
  s.start("Creating directory structure...");
  ensureDir(oroborosTarget);
  ensureDir(join(oroborosTarget, "epics"));
  ensureDir(join(oroborosTarget, "prompts"));
  ensureDir(join(oroborosTarget, "reference"));
  ensureDir(join(oroborosTarget, "scripts"));
  s.stop("Directory structure ready");

  // Step 2: Copy framework files (always overwrite)
  s.start("Installing framework files...");
  for (const dir of FRAMEWORK_DIRS) {
    const srcDir = join(sourceDir, dir);
    const destDir = join(oroborosTarget, dir);
    
    if (exists(srcDir) && isDirectory(srcDir)) {
      const { copied } = copyDirContents(srcDir, destDir, { overwrite: true });
      if (copied.length > 0) {
        log.info(`  Updated ${dir}/: ${copied.join(", ")}`);
      }
    }
  }
  s.stop("Framework files installed");

  // Step 3: Copy scaffold files (only if missing)
  s.start("Setting up scaffold files...");
  for (const file of SCAFFOLD_FILES) {
    const srcPath = join(sourceDir, file);
    const destPath = join(oroborosTarget, file);
    
    if (exists(srcPath) && !exists(destPath)) {
      safeCopy(srcPath, destPath);
      log.info(`  Created ${file}`);
    }
  }
  
  // Create .gitkeep in epics if empty
  const epicsDir = join(oroborosTarget, "epics");
  const gitkeep = join(epicsDir, ".gitkeep");
  if (!exists(gitkeep)) {
    Bun.write(gitkeep, "");
  }
  s.stop("Scaffold files ready");

  // Step 4: Write version
  writeVersion(oroborosTarget, version);

  // Summary
  console.log();
  if (isUpdate) {
    log.success(`Updated oroboros from ${installedVersion} to ${version}`);
  } else {
    log.success(`Installed oroboros ${version}`);
  }
  
  console.log();
  log.info("Protected paths (not modified):");
  for (const path of USER_PATHS) {
    log.message(`  - oroboros/${path}`);
  }
}

async function main(): Promise<void> {
  const version = getSourceVersion();
  const sourceDir = getSourceDir();
  
  // Parse target directory from args, default to current directory
  const targetDir = resolve(process.argv[2] || ".");
  
  header("oroboros", version);
  
  const oroborosTarget = join(targetDir, "oroboros");
  const installedVersion = exists(oroborosTarget) 
    ? readInstalledVersion(oroborosTarget) 
    : null;
  
  const isUpdate = installedVersion !== null;
  
  if (isUpdate) {
    log.info(`Found existing installation: v${installedVersion}`);
    log.info(`Available version: v${version}`);
    
    const comparison = compareVersions(installedVersion, version);
    
    if (comparison === 0) {
      log.warn("You already have the latest version.");
      
      const reinstall = await confirmWithDefault(
        "Reinstall anyway?",
        false
      );
      
      if (!reinstall) {
        footer("No changes made.");
        return;
      }
    } else if (comparison > 0) {
      log.warn(`Installed version (${installedVersion}) is newer than source (${version}).`);
      
      const downgrade = await confirmWithDefault(
        "Downgrade to older version?",
        false
      );
      
      if (!downgrade) {
        footer("No changes made.");
        return;
      }
    } else {
      // Normal update
      const proceed = await confirmWithDefault(
        `Update from ${installedVersion} to ${version}?`,
        true
      );
      
      if (!proceed) {
        footer("Update cancelled.");
        return;
      }
    }
    
    console.log();
    log.info("Your epics and reference files will not be modified.");
  } else {
    log.info(`Installing to: ${oroborosTarget}`);
    
    if (!isHeadless()) {
      const proceed = await confirmWithDefault("Continue with installation?", true);
      
      if (!proceed) {
        footer("Installation cancelled.");
        return;
      }
    }
  }

  await performInstall({
    targetDir,
    sourceDir,
    version,
    isUpdate,
    installedVersion,
  });

  console.log();
  if (isUpdate) {
    footer("Update complete!");
  } else {
    footer("Done! Run oroboros/prompts/create-mission.md to get started.");
  }
}

// Run
main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
