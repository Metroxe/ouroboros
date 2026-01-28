/**
 * Version utilities
 * 
 * Semver parsing and comparison for install/update logic.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * Parse a semver string into components
 */
export function parseVersion(version: string): SemVer | null {
  // Remove 'v' prefix if present
  const cleaned = version.trim().replace(/^v/, "");
  
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

/**
 * Format a SemVer object back to string
 */
export function formatVersion(version: SemVer): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease ? `${base}-${version.prerelease}` : base;
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  if (!vA || !vB) {
    // Fallback to string comparison if parsing fails
    return a < b ? -1 : a > b ? 1 : 0;
  }

  if (vA.major !== vB.major) return vA.major < vB.major ? -1 : 1;
  if (vA.minor !== vB.minor) return vA.minor < vB.minor ? -1 : 1;
  if (vA.patch !== vB.patch) return vA.patch < vB.patch ? -1 : 1;

  // Handle prerelease: no prerelease > prerelease
  if (!vA.prerelease && vB.prerelease) return 1;
  if (vA.prerelease && !vB.prerelease) return -1;
  if (vA.prerelease && vB.prerelease) {
    return vA.prerelease < vB.prerelease ? -1 : vA.prerelease > vB.prerelease ? 1 : 0;
  }

  return 0;
}

/**
 * Read the installed version from an ouroboros directory
 * Supports both "0.1.0" and "version: 0.1.0" formats
 */
export function readInstalledVersion(ouroborosDir: string): string | null {
  const versionFile = join(ouroborosDir, ".version");
  
  if (!existsSync(versionFile)) {
    return null;
  }

  try {
    const content = readFileSync(versionFile, "utf-8").trim();
    // Handle "version: X.X.X" format
    const match = content.match(/^(?:version:\s*)?(.+)$/);
    return match ? match[1].trim() : content;
  } catch {
    return null;
  }
}

/**
 * Write version to an ouroboros directory
 * Uses "version: X.X.X" format for release-please compatibility
 */
export function writeVersion(ouroborosDir: string, version: string): void {
  const versionFile = join(ouroborosDir, ".version");
  writeFileSync(versionFile, `version: ${version.trim()}\n`, "utf-8");
}

/**
 * Check if an update is available
 */
export function isUpdateAvailable(
  installedVersion: string,
  latestVersion: string
): boolean {
  return compareVersions(installedVersion, latestVersion) < 0;
}
