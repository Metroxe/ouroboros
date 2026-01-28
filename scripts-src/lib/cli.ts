/**
 * CLI utilities
 * 
 * Re-exports @clack/prompts and adds custom helpers for ouroboros scripts.
 */

import * as p from "@clack/prompts";

// Re-export everything from @clack/prompts
export * from "@clack/prompts";

/**
 * Display a styled header for the script
 */
export function header(title: string, version?: string): void {
  console.log();
  p.intro(version ? `${title} v${version}` : title);
}

/**
 * Display a styled footer
 */
export function footer(message: string): void {
  p.outro(message);
}

/**
 * Check if running in CI/headless mode
 */
export function isHeadless(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.HEADLESS === "1" ||
    process.env.HEADLESS === "true" ||
    !process.stdin.isTTY
  );
}

/**
 * Confirm with auto-yes in headless mode
 */
export async function confirmWithDefault(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  if (isHeadless()) {
    p.log.info(`${message} (auto: ${defaultValue ? "yes" : "no"})`);
    return defaultValue;
  }
  
  const result = await p.confirm({
    message,
    initialValue: defaultValue,
  });
  
  if (p.isCancel(result)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  
  return result;
}
