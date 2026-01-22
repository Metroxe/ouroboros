/**
 * Shared tool formatting helpers for LLM runtimes
 *
 * Provides consistent formatting for:
 * - Tool use blocks (display tool calls with name and arguments)
 * - Tool result blocks (display execution results with truncation)
 *
 * Used by both Claude and Cursor runtimes for streaming output
 */

import chalk from "chalk";

/**
 * Format tool use for display
 * Extracts meaningful information from tool calls to show progress
 *
 * @param toolName - Name of the tool being called
 * @param toolInput - Tool input arguments (string or object)
 * @returns Formatted string describing the tool call
 */
export function formatToolUse(
  toolName: string,
  toolInput: string | Record<string, unknown>
): string {
  try {
    const input =
      typeof toolInput === "string" ? JSON.parse(toolInput) : toolInput;

    switch (toolName) {
      case "Read":
        return `Reading ${input.file_path || input.path || "file"}`;
      case "Write":
        return `Writing ${input.file_path || input.path || "file"}`;
      case "Edit":
      case "StrReplace":
        return `Editing ${input.file_path || input.path || "file"}`;
      case "Grep":
      case "Search":
        const pattern = (input.pattern || input.query || "") as string;
        const searchPath = (input.path || input.directory || ".") as string;
        return `Searching "${pattern.substring(0, 40)}${
          pattern.length > 40 ? "..." : ""
        }" in ${searchPath}`;
      case "Glob":
        return `Finding files: ${input.pattern || input.glob_pattern || "*"}`;
      case "LS":
      case "ListDir":
        return `Listing ${input.path || input.directory || input.target_directory || "."}`;
      case "Bash":
      case "Shell":
        const cmd = (input.command || "") as string;
        return `Running: ${cmd.substring(0, 50)}${cmd.length > 50 ? "..." : ""}`;
      case "WebSearch":
        return `Searching web: ${input.query || input.search_term || ""}`;
      case "SemanticSearch":
        const query = (input.query || "") as string;
        return `Semantic search: ${query.substring(0, 40)}${query.length > 40 ? "..." : ""}`;
      case "TodoRead":
        return "Reading todo list";
      case "TodoWrite":
        return "Updating todo list";
      case "Task":
        const desc = (input.description || "") as string;
        return `Task: ${desc.substring(0, 40)}...`;
      case "ReadLints":
        return `Checking lints: ${input.paths?.join(", ") || "workspace"}`;
      default:
        // Try to extract something useful from the input
        const firstKey = Object.keys(input)[0];
        if (firstKey && typeof input[firstKey] === "string") {
          const val = input[firstKey] as string;
          return `${toolName}: ${val.substring(0, 40)}${
            val.length > 40 ? "..." : ""
          }`;
        }
        return toolName;
    }
  } catch {
    return toolName;
  }
}

/**
 * Format tool result for display (truncate if too long)
 * Shows a preview of the tool output with line-by-line formatting
 * Parses JSON structures to extract human-readable content
 *
 * @param content - Tool result content (string or object)
 * @param toolName - Optional tool name for smart parsing
 * @param maxLines - Maximum number of lines to show (default: 5)
 * @returns Formatted string with dimmed output and line prefixes
 */
export function formatToolResult(
  content: string | unknown,
  toolName?: string,
  maxLines = 5
): string {
  if (!content) return "";

  // Try to parse the content and extract meaningful data based on tool type
  const parsed = parseToolResult(content, toolName);

  // Format the parsed content with line prefixes
  return formatWithPrefix(parsed, maxLines);
}

/**
 * Parse tool result based on tool type and extract meaningful content
 */
function parseToolResult(content: string | unknown, toolName?: string): string {
  // If it's a string, try to parse as JSON first
  let data: unknown = content;
  if (typeof content === "string") {
    try {
      data = JSON.parse(content);
    } catch {
      // Not JSON, use as-is
      return content;
    }
  }

  // Handle success wrapper: { success: { ... } }
  if (isObject(data) && "success" in data && isObject(data.success)) {
    data = data.success;
  }

  // Route to specific formatter based on tool name or detect from structure
  const tool = toolName?.toLowerCase() || detectToolType(data);

  switch (tool) {
    case "read":
      return formatReadResult(data);
    case "ls":
    case "listdir":
      return formatLsResult(data);
    case "grep":
    case "search":
      return formatGrepResult(data);
    case "shell":
    case "bash":
      return formatShellResult(data);
    case "edit":
    case "strreplace":
      return formatEditResult(data);
    case "glob":
      return formatGlobResult(data);
    case "write":
      return formatWriteResult(data);
    default:
      // Fall back to JSON stringify for unknown types
      return typeof content === "string"
        ? content
        : JSON.stringify(content, null, 2);
  }
}

/**
 * Type guard for objects
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Detect tool type from result structure
 */
function detectToolType(data: unknown): string | undefined {
  if (!isObject(data)) return undefined;

  // Read: has content field
  if ("content" in data && typeof data.content === "string" && "isEmpty" in data) {
    return "read";
  }

  // LS: has directoryTreeRoot
  if ("directoryTreeRoot" in data) {
    return "ls";
  }

  // Grep: has pattern and matches or outputMode
  if ("pattern" in data && ("matches" in data || "outputMode" in data)) {
    return "grep";
  }

  // Shell: has stdout or stderr
  if ("stdout" in data || "stderr" in data) {
    return "shell";
  }

  // Edit: has diff or linesAdded/linesRemoved
  if ("diff" in data || ("linesAdded" in data && "linesRemoved" in data)) {
    return "edit";
  }

  // Glob: has files array
  if ("files" in data && Array.isArray(data.files)) {
    return "glob";
  }

  // Write: has bytesWritten or linesWritten
  if ("bytesWritten" in data || "linesWritten" in data) {
    return "write";
  }

  return undefined;
}

/**
 * Format Read tool result - extract content and show preview
 */
function formatReadResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const content = data.content;
  if (typeof content !== "string") {
    return JSON.stringify(data, null, 2);
  }

  return content;
}

/**
 * Format LS tool result - show simple directory listing
 */
function formatLsResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const tree = data.directoryTreeRoot;
  if (!isObject(tree)) {
    return JSON.stringify(data, null, 2);
  }

  const lines: string[] = [];
  formatDirectoryTree(tree, lines, 0);
  return lines.join("\n");
}

/**
 * Recursively format directory tree
 */
function formatDirectoryTree(
  node: Record<string, unknown>,
  lines: string[],
  depth: number
): void {
  const indent = "  ".repeat(depth);

  // Add child directories
  const childDirs = node.childrenDirs;
  if (Array.isArray(childDirs)) {
    for (const dir of childDirs) {
      if (isObject(dir)) {
        const absPath = dir.absPath;
        if (typeof absPath === "string") {
          const name = absPath.split("/").pop() || absPath;
          lines.push(`${indent}${name}/`);
          formatDirectoryTree(dir, lines, depth + 1);
        }
      }
    }
  }

  // Add child files
  const childFiles = node.childrenFiles;
  if (Array.isArray(childFiles)) {
    for (const file of childFiles) {
      if (typeof file === "string") {
        lines.push(`${indent}${file}`);
      }
    }
  }
}

/**
 * Format Grep tool result - show matched lines with file paths
 */
function formatGrepResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const matches = data.matches;
  if (!Array.isArray(matches)) {
    // Try to extract content if it's a different format
    if ("content" in data && typeof data.content === "string") {
      return data.content;
    }
    return JSON.stringify(data, null, 2);
  }

  const lines: string[] = [];
  for (const match of matches) {
    if (isObject(match)) {
      const file = match.file || match.path || "";
      const line = match.line || match.lineNumber || "";
      const content = match.content || match.text || "";
      lines.push(`${file}:${line}: ${content}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "No matches found";
}

/**
 * Format Shell tool result - show stdout/stderr and exit code if non-zero
 */
function formatShellResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const lines: string[] = [];

  // Show stdout
  const stdout = data.stdout;
  if (typeof stdout === "string" && stdout.trim()) {
    lines.push(stdout.trim());
  }

  // Show stderr if present
  const stderr = data.stderr;
  if (typeof stderr === "string" && stderr.trim()) {
    if (lines.length > 0) lines.push("");
    lines.push(chalk.yellow("stderr:"));
    lines.push(stderr.trim());
  }

  // Show exit code only if non-zero
  const exitCode = data.exitCode;
  if (typeof exitCode === "number" && exitCode !== 0) {
    if (lines.length > 0) lines.push("");
    lines.push(chalk.yellow(`Exit code: ${exitCode}`));
  }

  return lines.join("\n") || "(no output)";
}

/**
 * Format Edit/StrReplace tool result - show GitHub-style diff
 */
function formatEditResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const lines: string[] = [];

  // Show file path if available
  const path = data.path || data.file_path;
  if (typeof path === "string") {
    lines.push(chalk.bold(`Edited: ${path}`));
  }

  // Show diff if available
  const diff = data.diff;
  if (typeof diff === "string") {
    const diffLines = diff.split("\n");
    for (const line of diffLines) {
      if (line.startsWith("-") && !line.startsWith("---")) {
        lines.push(chalk.red(line));
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        lines.push(chalk.green(line));
      } else if (line.startsWith("@@")) {
        lines.push(chalk.cyan(line));
      } else {
        lines.push(line);
      }
    }
  } else {
    // No diff available, show summary
    const added = data.linesAdded;
    const removed = data.linesRemoved;
    if (typeof added === "number" || typeof removed === "number") {
      const addedStr = typeof added === "number" ? chalk.green(`+${added}`) : "";
      const removedStr = typeof removed === "number" ? chalk.red(`-${removed}`) : "";
      lines.push(`Changes: ${addedStr} ${removedStr}`.trim());
    }
  }

  return lines.join("\n") || "Edit completed";
}

/**
 * Format Glob tool result - show simple file list
 */
function formatGlobResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const files = data.files;
  if (!Array.isArray(files)) {
    return JSON.stringify(data, null, 2);
  }

  return files.join("\n") || "No files matched";
}

/**
 * Format Write tool result - show confirmation with line count
 */
function formatWriteResult(data: unknown): string {
  if (!isObject(data)) return String(data);

  const path = data.path || data.file_path;
  const lines = data.linesWritten;
  const bytes = data.bytesWritten;

  const parts: string[] = [];

  if (typeof path === "string") {
    parts.push(`Wrote: ${path}`);
  }

  if (typeof lines === "number") {
    parts.push(`(${lines} lines)`);
  } else if (typeof bytes === "number") {
    parts.push(`(${bytes} bytes)`);
  }

  return parts.join(" ") || "Write completed";
}

/**
 * Format content with line prefixes and truncation
 */
function formatWithPrefix(content: string, maxLines: number): string {
  if (!content) return "";

  const lines = content.split("\n");

  if (lines.length <= maxLines) {
    return lines.map((l) => chalk.dim(`    | `) + l).join("\n");
  }

  const shown = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;
  return (
    shown.map((l) => chalk.dim(`    | `) + l).join("\n") +
    chalk.dim(`\n    | ... (${remaining} more lines)`)
  );
}

/**
 * Format a tool call for inline display
 * Used during streaming to show what tool is being called
 *
 * @param toolName - Name of the tool
 * @param toolInput - Tool input arguments
 * @returns Formatted string with cyan color and arrow prefix
 */
export function formatToolCallInline(
  toolName: string,
  toolInput: string | Record<string, unknown>
): string {
  const description = formatToolUse(toolName, toolInput);
  return chalk.cyan(`  > ${description}`);
}
