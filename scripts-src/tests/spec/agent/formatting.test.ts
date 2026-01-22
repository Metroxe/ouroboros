/**
 * Tests for formatting helpers
 */

import { describe, test, expect } from "bun:test";
import {
  formatToolUse,
  formatToolResult,
  formatToolCallInline,
} from "../../../lib/agent/formatting.js";

describe("formatToolUse", () => {
  test("formats Read tool with path", () => {
    const result = formatToolUse("Read", { path: "/src/index.ts" });
    expect(result).toBe("Reading /src/index.ts");
  });

  test("formats Read tool with file_path", () => {
    const result = formatToolUse("Read", { file_path: "/src/lib.ts" });
    expect(result).toBe("Reading /src/lib.ts");
  });

  test("formats Write tool with path", () => {
    const result = formatToolUse("Write", { path: "/src/new-file.ts" });
    expect(result).toBe("Writing /src/new-file.ts");
  });

  test("formats Edit/StrReplace tool", () => {
    const result = formatToolUse("StrReplace", { path: "/src/edit.ts" });
    expect(result).toBe("Editing /src/edit.ts");
  });

  test("formats Grep tool with pattern and path", () => {
    const result = formatToolUse("Grep", {
      pattern: "function test",
      path: "/src",
    });
    expect(result).toContain("Searching");
    expect(result).toContain("function test");
    expect(result).toContain("/src");
  });

  test("truncates long grep patterns", () => {
    const longPattern = "a".repeat(50);
    const result = formatToolUse("Grep", { pattern: longPattern });
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(100);
  });

  test("formats Shell/Bash tool with command", () => {
    const result = formatToolUse("Shell", { command: "npm test" });
    expect(result).toBe("Running: npm test");
  });

  test("truncates long shell commands", () => {
    const longCommand = "npm run test -- --coverage --verbose --watch " + "a".repeat(50);
    const result = formatToolUse("Shell", { command: longCommand });
    expect(result).toContain("...");
  });

  test("formats LS tool with directory", () => {
    const result = formatToolUse("LS", { target_directory: "/src/lib" });
    expect(result).toBe("Listing /src/lib");
  });

  test("formats Glob tool with pattern", () => {
    const result = formatToolUse("Glob", { glob_pattern: "*.ts" });
    expect(result).toBe("Finding files: *.ts");
  });

  test("formats WebSearch tool", () => {
    const result = formatToolUse("WebSearch", { search_term: "typescript docs" });
    expect(result).toBe("Searching web: typescript docs");
  });

  test("formats SemanticSearch tool", () => {
    const result = formatToolUse("SemanticSearch", { query: "how to handle errors" });
    expect(result).toContain("Semantic search");
    expect(result).toContain("how to handle errors");
  });

  test("formats TodoWrite tool", () => {
    const result = formatToolUse("TodoWrite", {});
    expect(result).toBe("Updating todo list");
  });

  test("formats unknown tool with first string arg", () => {
    const result = formatToolUse("CustomTool", { myArg: "some value" });
    expect(result).toBe("CustomTool: some value");
  });

  test("returns tool name for unknown tool with no string args", () => {
    const result = formatToolUse("CustomTool", { count: 42 });
    expect(result).toBe("CustomTool");
  });

  test("handles string input (JSON)", () => {
    const result = formatToolUse("Read", '{"path": "/test.ts"}');
    expect(result).toBe("Reading /test.ts");
  });

  test("handles invalid JSON string input", () => {
    const result = formatToolUse("SomeTool", "not valid json");
    expect(result).toBe("SomeTool");
  });
});

describe("formatToolResult", () => {
  test("formats simple string content", () => {
    const result = formatToolResult("hello world");
    expect(result).toContain("hello world");
    expect(result).toContain("|"); // Line prefix
  });

  test("truncates long content", () => {
    const longContent = Array(20).fill("line").join("\n");
    const result = formatToolResult(longContent, undefined, 5);
    expect(result).toContain("more lines");
  });

  test("returns empty string for empty content", () => {
    const result = formatToolResult("");
    expect(result).toBe("");
  });

  test("returns empty string for null content", () => {
    const result = formatToolResult(null);
    expect(result).toBe("");
  });

  test("formats shell result with stdout", () => {
    const result = formatToolResult(
      { stdout: "command output", exitCode: 0 },
      "Shell"
    );
    expect(result).toContain("command output");
  });

  test("formats shell result with non-zero exit code", () => {
    const result = formatToolResult(
      { stdout: "", exitCode: 1 },
      "Shell"
    );
    expect(result).toContain("Exit code: 1");
  });

  test("formats read result with content", () => {
    const result = formatToolResult(
      { content: "file contents", isEmpty: false },
      "Read"
    );
    expect(result).toContain("file contents");
  });

  test("handles success wrapper", () => {
    const result = formatToolResult({
      success: { content: "wrapped content", isEmpty: false },
    });
    expect(result).toContain("wrapped content");
  });
});

describe("formatToolCallInline", () => {
  test("formats tool call with cyan color marker", () => {
    const result = formatToolCallInline("Read", { path: "/test.ts" });
    // Should contain the description
    expect(result).toContain("Reading /test.ts");
    // Should have the arrow prefix (may have ANSI codes)
    expect(result).toContain(">");
  });
});
