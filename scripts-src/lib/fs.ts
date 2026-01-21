/**
 * File system utilities
 * 
 * Safe file operations for install/update scripts.
 */

import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from "fs";
import { join, dirname } from "path";

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Check if a file or directory exists
 */
export function exists(path: string): boolean {
  return existsSync(path);
}

/**
 * Check if path is a directory
 */
export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/**
 * Options for safe copy operations
 */
export interface SafeCopyOptions {
  /** Overwrite existing files (default: false) */
  overwrite?: boolean;
  /** Only copy if destination doesn't exist (default: false) */
  skipExisting?: boolean;
}

/**
 * Safely copy a file or directory
 * Returns true if copy occurred, false if skipped
 */
export function safeCopy(
  src: string,
  dest: string,
  options: SafeCopyOptions = {}
): boolean {
  const { overwrite = false, skipExisting = false } = options;

  if (existsSync(dest)) {
    if (skipExisting) {
      return false;
    }
    if (!overwrite) {
      throw new Error(`Destination already exists: ${dest}`);
    }
  }

  // Ensure parent directory exists
  ensureDir(dirname(dest));

  cpSync(src, dest, { recursive: true });
  return true;
}

/**
 * Copy directory contents, not the directory itself
 */
export function copyDirContents(
  srcDir: string,
  destDir: string,
  options: SafeCopyOptions = {}
): { copied: string[]; skipped: string[] } {
  ensureDir(destDir);
  
  const copied: string[] = [];
  const skipped: string[] = [];

  const entries = readdirSync(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    
    const wasCopied = safeCopy(srcPath, destPath, options);
    if (wasCopied) {
      copied.push(entry.name);
    } else {
      skipped.push(entry.name);
    }
  }

  return { copied, skipped };
}

/**
 * Remove a file or directory
 */
export function remove(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

/**
 * List files in a directory (non-recursive)
 */
export function listDir(path: string): string[] {
  if (!existsSync(path)) {
    return [];
  }
  return readdirSync(path);
}
