/**
 * LLM runtime abstraction
 *
 * Provides:
 * - LLMRuntime interface for Claude Code, Cursor, and OpenCode
 * - Unified interface for executing prompts
 */

import { claudeRuntime } from "./claude.js";
import { copilotRuntime } from "./copilot.js";
import { cursorRuntime } from "./cursor.js";
import { opencodeRuntime } from "./opencode.js";
import type { LLMRuntime, RuntimeName } from "./types.js";

// Re-export types
export type {
  LLMRuntime,
  Model,
  PromptOptions,
  PromptResult,
  RuntimeName,
  TokenUsage,
} from "./types.js";

// Export individual runtimes
export { claudeRuntime } from "./claude.js";
export { copilotRuntime } from "./copilot.js";
export { cursorRuntime } from "./cursor.js";
export { opencodeRuntime } from "./opencode.js";

// Export formatting helpers
export {
  formatToolUse,
  formatToolResult,
  formatToolCallInline,
} from "./formatting.js";

/**
 * Map of runtime names to implementations
 */
const runtimes: Record<RuntimeName, LLMRuntime> = {
  claude: claudeRuntime,
  copilot: copilotRuntime,
  cursor: cursorRuntime,
  opencode: opencodeRuntime,
};

/**
 * Get all available runtimes
 */
export function getAllRuntimes(): LLMRuntime[] {
  return Object.values(runtimes);
}

/**
 * Get a runtime by name
 */
export function getRuntime(name: RuntimeName): LLMRuntime {
  return runtimes[name];
}

/**
 * Get the default runtime (Claude Code)
 */
export function getDefaultRuntime(): LLMRuntime {
  return claudeRuntime;
}

/**
 * Check which runtimes are available on this system
 */
export async function getAvailableRuntimes(): Promise<LLMRuntime[]> {
  const allRuntimes = getAllRuntimes();
  const availabilityChecks = await Promise.all(
    allRuntimes.map(async (runtime) => ({
      runtime,
      available: await runtime.isAvailable(),
    }))
  );

  return availabilityChecks
    .filter((check) => check.available)
    .map((check) => check.runtime);
}
