/**
 * YAML utilities
 *
 * Provides parsing and serialization for YAML files used in ouroboros,
 * specifically features-index.yml and progress.yml.
 */

import { parse, stringify } from "yaml";
import { readFileSync, writeFileSync, existsSync } from "fs";

/**
 * Feature entry in features-index.yml
 */
export interface FeatureIndexEntry {
  number: string;
  name: string;
  path: string;
  description: string;
  completed: boolean;
}

/**
 * Structure of features-index.yml
 */
export interface FeaturesIndex {
  epic_name: string;
  epic_path: string;
  generated: string;
  total_features: number;
  features: FeatureIndexEntry[];
  technical_overview?: {
    shared_patterns?: string[];
    key_integration_points?: string[];
    reusable_components?: string[];
  };
  notes?: string;
}

/**
 * Task group entry in progress.yml
 */
export interface TaskGroupEntry {
  name: string;
  completed: boolean;
}

/**
 * Structure of progress.yml
 */
export interface ProgressYml {
  task_groups: TaskGroupEntry[];
}

/**
 * Parse a YAML file and return its contents
 */
export function parseYamlFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    return parse(content) as T;
  } catch (error) {
    return null;
  }
}

/**
 * Write an object to a YAML file
 */
export function writeYamlFile<T>(filePath: string, data: T): void {
  const content = stringify(data, { lineWidth: 0 });
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Read features-index.yml from an epic path
 */
export function readFeaturesIndex(epicPath: string): FeaturesIndex | null {
  return parseYamlFile<FeaturesIndex>(`${epicPath}/features-index.yml`);
}

/**
 * Write features-index.yml to an epic path
 */
export function writeFeaturesIndex(
  epicPath: string,
  data: FeaturesIndex
): void {
  writeYamlFile(`${epicPath}/features-index.yml`, data);
}

/**
 * Read progress.yml from a feature path
 */
export function readProgressYml(featurePath: string): ProgressYml | null {
  return parseYamlFile<ProgressYml>(`${featurePath}/prompts/progress.yml`);
}

/**
 * Write progress.yml to a feature path
 */
export function writeProgressYml(
  featurePath: string,
  data: ProgressYml
): void {
  writeYamlFile(`${featurePath}/prompts/progress.yml`, data);
}

/**
 * Get the first incomplete task group from progress.yml
 * Returns the index (0-based) or -1 if all are complete
 */
export function getFirstIncompleteTaskGroup(progress: ProgressYml): number {
  return progress.task_groups.findIndex((tg) => !tg.completed);
}

/**
 * Check if all task groups are complete
 */
export function allTaskGroupsComplete(progress: ProgressYml): boolean {
  return progress.task_groups.every((tg) => tg.completed);
}

/**
 * Mark a task group as complete in progress.yml
 */
export function markTaskGroupComplete(
  featurePath: string,
  taskGroupName: string
): boolean {
  const progress = readProgressYml(featurePath);
  if (!progress) {
    return false;
  }

  const taskGroup = progress.task_groups.find((tg) => tg.name === taskGroupName);
  if (!taskGroup) {
    return false;
  }

  taskGroup.completed = true;
  writeProgressYml(featurePath, progress);
  return true;
}

/**
 * Mark a feature as complete in features-index.yml
 */
export function markFeatureComplete(
  epicPath: string,
  featureNumber: string
): boolean {
  const index = readFeaturesIndex(epicPath);
  if (!index) {
    return false;
  }

  const feature = index.features.find((f) => f.number === featureNumber);
  if (!feature) {
    return false;
  }

  feature.completed = true;
  writeFeaturesIndex(epicPath, index);
  return true;
}
