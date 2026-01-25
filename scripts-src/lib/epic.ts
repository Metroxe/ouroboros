/**
 * Epic utilities
 *
 * Provides epic and feature discovery, progress detection,
 * and workflow state management.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import {
  readFeaturesIndex,
  readProgressYml,
  getFirstIncompleteTaskGroup,
  type FeaturesIndex,
  type FeatureIndexEntry,
  type ProgressYml,
} from "./yaml.js";

/**
 * Epic metadata
 */
export interface Epic {
  /** Full folder name (e.g., "2025-01-21-user-authentication") */
  name: string;
  /** Parsed date from folder name */
  date: string;
  /** Epic name without date (e.g., "user-authentication") */
  epicName: string;
  /** Full path to the epic folder */
  path: string;
}

/**
 * Feature metadata
 */
export interface Feature {
  /** Full folder name (e.g., "01-create-user-model") */
  folderName: string;
  /** Feature number (e.g., "01") */
  number: string;
  /** Feature name without number (e.g., "create-user-model") */
  name: string;
  /** Full path to the feature folder */
  path: string;
  /** Whether prd.md exists */
  hasPrd: boolean;
  /** Whether tasks.md exists */
  hasTasks: boolean;
  /** Whether prompts/progress.yml exists */
  hasPrompts: boolean;
}

/**
 * Progress state for the epic workflow
 */
export interface EpicProgress {
  /** Current phase to resume from (3-7) */
  phase: 3 | 4 | 5 | 6 | 7;
  /** For phases 4-5: which feature index to resume from (0-based) */
  resumeFeatureIndex?: number;
  /** For phase 6: which feature and task group to resume from */
  resumeTaskGroup?: {
    featureIndex: number;
    taskGroupIndex: number;
  };
  /** Human-readable description of current state */
  description: string;
}

/**
 * Validation result for feature discovery
 */
export interface FeatureValidation {
  valid: boolean;
  errors: string[];
  /** Features from features-index.yml */
  indexFeatures: FeatureIndexEntry[];
  /** Features discovered from directory */
  directoryFeatures: Feature[];
}

/**
 * Get the oroboros directory path (assumes running from project root)
 */
export function getOroborosPath(projectRoot: string = "."): string {
  return join(projectRoot, "oroboros");
}

/**
 * Get the epics directory path
 */
export function getEpicsPath(projectRoot: string = "."): string {
  return join(getOroborosPath(projectRoot), "epics");
}

/**
 * List all epics in the epics directory, sorted by date (newest first)
 */
export function listEpics(projectRoot: string = "."): Epic[] {
  const epicsDir = getEpicsPath(projectRoot);

  if (!existsSync(epicsDir)) {
    return [];
  }

  const entries = readdirSync(epicsDir, { withFileTypes: true });
  const epics: Epic[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    // Parse folder name: YYYY-MM-DD-epic-name
    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    if (!match) continue;

    epics.push({
      name: entry.name,
      date: match[1],
      epicName: match[2],
      path: join(epicsDir, entry.name),
    });
  }

  // Sort by date, newest first
  epics.sort((a, b) => b.date.localeCompare(a.date));

  return epics;
}

/**
 * Get an epic by its folder name
 */
export function getEpic(
  epicName: string,
  projectRoot: string = "."
): Epic | null {
  const epics = listEpics(projectRoot);
  return epics.find((e) => e.name === epicName) || null;
}

/**
 * Check if an epic has requirements.md
 */
export function hasRequirements(epicPath: string): boolean {
  return existsSync(join(epicPath, "requirements.md"));
}

/**
 * Check if an epic has features-index.yml
 */
export function hasFeaturesIndex(epicPath: string): boolean {
  return existsSync(join(epicPath, "features-index.yml"));
}

/**
 * Discover features from the directory structure
 */
export function discoverFeaturesFromDirectory(epicPath: string): Feature[] {
  const featuresDir = join(epicPath, "features");

  if (!existsSync(featuresDir)) {
    return [];
  }

  const entries = readdirSync(featuresDir, { withFileTypes: true });
  const features: Feature[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    // Parse folder name: NN-feature-name
    const match = entry.name.match(/^(\d{2})-(.+)$/);
    if (!match) continue;

    const featurePath = join(featuresDir, entry.name);

    features.push({
      folderName: entry.name,
      number: match[1],
      name: match[2],
      path: featurePath,
      hasPrd: existsSync(join(featurePath, "prd.md")),
      hasTasks: existsSync(join(featurePath, "tasks.md")),
      hasPrompts: existsSync(join(featurePath, "prompts", "progress.yml")),
    });
  }

  // Sort by number
  features.sort((a, b) => a.number.localeCompare(b.number));

  return features;
}

/**
 * Validate that features-index.yml matches the directory structure
 */
export function validateFeatures(epicPath: string): FeatureValidation {
  const errors: string[] = [];
  const featuresIndex = readFeaturesIndex(epicPath);
  const directoryFeatures = discoverFeaturesFromDirectory(epicPath);

  if (!featuresIndex) {
    return {
      valid: false,
      errors: ["features-index.yml not found"],
      indexFeatures: [],
      directoryFeatures,
    };
  }

  const indexFeatures = featuresIndex.features;

  // Check that counts match
  if (indexFeatures.length !== directoryFeatures.length) {
    errors.push(
      `Feature count mismatch: features-index.yml has ${indexFeatures.length} features, ` +
        `but directory has ${directoryFeatures.length} folders`
    );
  }

  // Check that each index feature has a matching directory
  for (const indexFeature of indexFeatures) {
    const dirFeature = directoryFeatures.find(
      (f) => f.number === indexFeature.number && f.name === indexFeature.name
    );
    if (!dirFeature) {
      errors.push(
        `Feature ${indexFeature.number}-${indexFeature.name} in features-index.yml ` +
          `not found in features/ directory`
      );
    }
  }

  // Check that each directory feature is in the index
  for (const dirFeature of directoryFeatures) {
    const indexFeature = indexFeatures.find(
      (f) => f.number === dirFeature.number && f.name === dirFeature.name
    );
    if (!indexFeature) {
      errors.push(
        `Feature folder ${dirFeature.folderName} not found in features-index.yml`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    indexFeatures,
    directoryFeatures,
  };
}

/**
 * Detect the current progress state of an epic
 */
export function detectProgress(epicPath: string): EpicProgress {
  // Check requirements.md first
  if (!hasRequirements(epicPath)) {
    throw new Error(
      `Epic does not have requirements.md. Run oroboros/prompts/create-epic.md first.`
    );
  }

  // Check for features
  const featuresIndex = readFeaturesIndex(epicPath);
  const directoryFeatures = discoverFeaturesFromDirectory(epicPath);

  if (!featuresIndex || directoryFeatures.length === 0) {
    return {
      phase: 3,
      description: "Starting from Phase 3: Create Features",
    };
  }

  // Validate features match
  const validation = validateFeatures(epicPath);
  if (!validation.valid) {
    throw new Error(
      `Feature validation failed:\n${validation.errors.join("\n")}`
    );
  }

  // Check for tasks.md in each feature
  for (let i = 0; i < directoryFeatures.length; i++) {
    const feature = directoryFeatures[i];
    if (!feature.hasTasks) {
      return {
        phase: 4,
        resumeFeatureIndex: i,
        description: `Starting from Phase 4: Create Tasks (resuming at feature ${feature.folderName})`,
      };
    }
  }

  // Check for prompts/progress.yml in each feature
  for (let i = 0; i < directoryFeatures.length; i++) {
    const feature = directoryFeatures[i];
    if (!feature.hasPrompts) {
      return {
        phase: 5,
        resumeFeatureIndex: i,
        description: `Starting from Phase 5: Create Task Prompts (resuming at feature ${feature.folderName})`,
      };
    }
  }

  // All planning phases complete, check implementation progress
  for (let i = 0; i < directoryFeatures.length; i++) {
    const feature = directoryFeatures[i];
    const progress = readProgressYml(feature.path);

    if (!progress) {
      // This shouldn't happen if hasPrompts is true, but handle it
      return {
        phase: 5,
        resumeFeatureIndex: i,
        description: `Starting from Phase 5: Create Task Prompts (resuming at feature ${feature.folderName})`,
      };
    }

    const incompleteIndex = getFirstIncompleteTaskGroup(progress);
    if (incompleteIndex >= 0) {
      return {
        phase: 6,
        resumeTaskGroup: {
          featureIndex: i,
          taskGroupIndex: incompleteIndex,
        },
        description: `Starting from Phase 6: Implementation (resuming at feature ${feature.folderName}, task group ${progress.task_groups[incompleteIndex].name})`,
      };
    }
  }

  // Check for verification guide
  const verificationGuidePath = join(epicPath, "verification-guide.md");
  if (!existsSync(verificationGuidePath)) {
    return {
      phase: 7,
      description: "Starting from Phase 7: Create Verification Guide",
    };
  }

  // Everything is complete
  return {
    phase: 7,
    description: "All phases complete",
  };
}

/**
 * Get the prompt file path for a task group
 */
export function getTaskPromptPath(
  featurePath: string,
  taskGroupIndex: number,
  taskGroupName: string
): string {
  // Prompt files are named: {N}-{task-group-name}.md where N is 1-based
  const promptNumber = taskGroupIndex + 1;
  return join(featurePath, "prompts", `${promptNumber}-${taskGroupName}.md`);
}

/**
 * Find the prompt file for a task group (handles potential naming variations)
 */
export function findTaskPromptFile(
  featurePath: string,
  taskGroupIndex: number,
  taskGroupName: string
): string | null {
  const promptsDir = join(featurePath, "prompts");

  if (!existsSync(promptsDir)) {
    return null;
  }

  const promptNumber = taskGroupIndex + 1;
  const expectedPrefix = `${promptNumber}-`;

  const entries = readdirSync(promptsDir);
  for (const entry of entries) {
    if (entry.startsWith(expectedPrefix) && entry.endsWith(".md")) {
      return join(promptsDir, entry);
    }
  }

  return null;
}

/**
 * Count prompt files in a feature's prompts directory
 */
export function countPromptFiles(featurePath: string): number {
  const promptsDir = join(featurePath, "prompts");

  if (!existsSync(promptsDir)) {
    return 0;
  }

  const entries = readdirSync(promptsDir);
  return entries.filter(
    (e) => e.endsWith(".md") && /^\d+-/.test(e)
  ).length;
}

/**
 * Check if a feature is fully implemented (all task groups complete)
 */
export function isFeatureComplete(featurePath: string): boolean {
  const progress = readProgressYml(featurePath);
  if (!progress) {
    return false;
  }
  return progress.task_groups.every((tg) => tg.completed);
}

/**
 * Get the total number of task groups for a feature
 */
export function getTaskGroupCount(featurePath: string): number {
  const progress = readProgressYml(featurePath);
  if (!progress) {
    return 0;
  }
  return progress.task_groups.length;
}

/**
 * Check if a task group is the last one for a feature
 */
export function isLastTaskGroup(
  featurePath: string,
  taskGroupIndex: number
): boolean {
  const count = getTaskGroupCount(featurePath);
  return taskGroupIndex === count - 1;
}
