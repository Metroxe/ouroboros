/**
 * LLM Runtime type definitions
 *
 * Provides standard interfaces for:
 * - LLMRuntime: Common interface for Claude Code, Cursor, and OpenCode
 * - PromptOptions: Configuration for prompt execution
 * - PromptResult: Response data from prompt execution
 * - Model: Metadata for available models
 */

/**
 * Available LLM runtime identifiers
 */
export type RuntimeName = "claude" | "cursor" | "opencode";

/**
 * Model metadata returned by listModels()
 */
export interface Model {
  /** Unique identifier for the model */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Optional description */
  description?: string;
}

/**
 * Options for prompt execution
 */
export interface PromptOptions {
  /** Model to use (if supported by runtime) */
  model?: string;
  /** Run in automated mode without interaction */
  automated?: boolean;
  /** Stream output to console in real-time */
  streamOutput?: boolean;
  /** Working directory for the command */
  workingDirectory?: string;
  /** Verbose mode - print raw JSON for all events before formatted output */
  verbose?: boolean;
}

/**
 * Token usage statistics (when available)
 */
export interface TokenUsage {
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
  /** Tokens read from cache (Claude) */
  cacheReadTokens?: number;
  /** Tokens used for cache creation (Claude) */
  cacheCreationTokens?: number;
}

/**
 * Result from executing a prompt
 */
export interface PromptResult {
  /** Whether the prompt completed successfully */
  success: boolean;
  /** Raw output from the CLI */
  output: string;
  /** Exit code from the process */
  exitCode: number;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Token usage if available (Claude Code) */
  tokenUsage?: TokenUsage;
  /** Total cost in USD if available (Claude Code) */
  costUsd?: number;
}

/**
 * Common interface for LLM runtimes
 * Supports Claude Code, Cursor, and OpenCode
 */
export interface LLMRuntime {
  /** Runtime identifier */
  name: RuntimeName;

  /** Human-readable display name */
  displayName: string;

  /** Whether the runtime supports streaming output */
  supportsStreaming: boolean;

  /** Whether the runtime provides token usage statistics */
  supportsTokenTracking: boolean;

  /**
   * Execute a prompt with the runtime
   * @param prompt - The prompt text to execute
   * @param options - Execution options
   * @returns Promise resolving to the result
   */
  runPrompt(prompt: string, options?: PromptOptions): Promise<PromptResult>;

  /**
   * List available models for this runtime
   * @returns Promise resolving to array of models
   */
  listModels(): Promise<Model[]>;

  /**
   * Check if the runtime CLI is available on the system
   * @returns Promise resolving to true if available
   */
  isAvailable(): Promise<boolean>;
}
