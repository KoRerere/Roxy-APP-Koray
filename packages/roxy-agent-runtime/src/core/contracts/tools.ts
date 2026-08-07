import type { ToolCallNormalizer } from "./provider.ts";
import type { ToolEvent } from "./todo.ts";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * Minimal JSON Schema subset used for tool input schemas. Anthropic accepts a
 * subset of JSON Schema; we only model what we need. Built from zod schemas
 * in {@link src/tools/schema.ts}.
 *
 * `zodToJsonSchema` maps exactly these zod constructors:
 *   z.string/z.number/z.boolean → { type }
 *   z.array(T)                  → { type: "array", items }
 *   z.object({...})             → { type: "object", properties, required }
 *   z.enum([...])               → { type: "string", enum }
 *   z.union/optional            → { anyOf } / omitted from `required`
 *   .describe(s)                → { description }
 * Any zod type outside this set is a build-time error (zodToJsonSchema throws),
 * not a silent fallback — to use an unsupported shape, pass an explicit
 * hand-written {@link JsonSchema} on the {@link ToolDescriptor}.
 */
export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  additionalProperties?: boolean;
}

export type ToolSource = "builtin" | "skill" | "mcp";

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  source: ToolSource;
  /**
   * Free-form metadata. `sensitive: true` flags tools that mutate state or
   * touch the network/shell and therefore require HITL approval in delegate
   * or strict mode.
   */
  metadata?: Record<string, unknown>;
  /**
   * Optional diff preview callback. When present, `HitlInterceptor` calls it
   * before requesting approval and attaches the result as
   * {@link ApprovalRequest.diff}. Errors are silently swallowed — a missing
   * diff never blocks the approval flow.
   *
   * Intended for write tools (`write_file`, `edit_file`) that can compute a
   * unified diff before executing, so the human sees exactly what will change.
   */
  previewFn?: (input: unknown) => Promise<string | undefined>;
}

export interface ToolContext {
  agentId: string;
  traceId: string;
  /** Identifier of the concrete model tool-use block being executed. */
  toolUseId?: string;
  /** Queue an event that the runtime publishes only if the final tool result succeeds. */
  emit?: (event: ToolEvent) => void;
  /**
   * Cooperative-cancellation signal, owned by the runtime/executor. A handler
   * MUST check/await on this (e.g. pass to child processes, poll in loops) so
   * an aborted agent turn does not leave work running. Aborting the signal is
   * not itself an error — the executor surfaces an `isError` ToolResult if a
   * handler rejects with an `AbortError`.
   */
  signal: AbortSignal;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

/** The body of a tool result, minus the id (the executor stamps `toolUseId`). */
export interface ToolHandlerResult {
  content: string;
  isError: boolean;
}

export type ToolHandler = (input: unknown, ctx: ToolContext) => Promise<ToolHandlerResult>;

export interface IToolRegistry {
  /**
   * Register a tool. On a name collision the new entry replaces the old and a
   * warning is logged; the previous handler is dropped. The decision key is
   * the user-facing `name` only (NOT `{source}.{name}`), so an MCP tool and a
   * builtin with the same short name collide. Callers wanting isolation must
   * namespace the name themselves.
   */
  add(descriptor: ToolDescriptor, handler: ToolHandler): void;
  remove(name: string): void;
  resolve(name: string): { descriptor: ToolDescriptor; handler: ToolHandler } | undefined;
  all(): ToolDescriptor[];
  /**
   * Project the unified tool list into Anthropic's `tools` shape:
   * `{ name, description, input_schema }` (note the snake_case
   * `input_schema`). Excludes nothing — every registered tool is exposed.
   */
  toAnthropicTools(): AnthropicTool[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

/**
 * Construction options for {@link ToolExecutor} implementations.
 */
export interface ToolExecutorOptions {
  /**
   * Optional normaliser applied to every tool-use block before dispatch.
   * Correct model-produced quirks here rather than in individual handlers.
   * Defaults to identity (no normalisation).
   */
  normalizer?: ToolCallNormalizer;
}

export interface ToolExecutor {
  /**
   * Execute a registered tool by name inside a sandbox.
   *
   * Failure modes never reject — they return a `ToolResult` so the agent loop
   * stays alive:
   *  - unknown tool name → `{ isError: true, content: "tool not found: <name>" }`
   *  - handler throws    → `{ isError: true, content: <Error.message> }`
   *  - handler rejects with an AbortError (signal aborted) →
   *      `{ isError: true, content: "aborted" }`
   *  - handler returns    → passed through (handler's own isError/content).
   * `toolUseId` is taken from the call site and echoed back on the result.
   */
  execute(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult>;
}

/**
 * Classification of why a tool execution failed. Carried by
 * {@link ToolAfterContext} so hook consumers can distinguish model-side errors
 * from infrastructure errors without parsing free-text content strings.
 *
 * - `not_found`     — the model called a tool name absent from the registry.
 *                     Indicates hallucination or a stale tool list in the prompt.
 * - `input_invalid` — the model passed input that failed schema validation.
 *                     Indicates a misunderstanding of the tool's contract.
 * - `handler_error` — the registered handler threw or returned `isError: true`.
 *                     Indicates a bug or transient failure in the tool itself.
 * - `aborted`       — the AbortSignal fired while the handler was running.
 *                     Not a model or tool error — initiated by the caller.
 */
export type ToolErrorKind = "not_found" | "input_invalid" | "handler_error" | "aborted";
