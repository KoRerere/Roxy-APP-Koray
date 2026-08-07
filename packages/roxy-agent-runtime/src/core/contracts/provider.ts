import type { ZodType } from "zod";
import type { ToolDescriptor } from "./tools.ts";

// ---------------------------------------------------------------------------
// Provider abstraction
// ---------------------------------------------------------------------------

/**
 * Conversation role.
 *
 * IMPORTANT: although `"system"` is a valid role, the framework carries the
 * system prompt SEPARATELY as {@link ChatRequest.system} (matching the
 * Anthropic protocol, where system is a top-level field, not a message). A
 * `Message` with `role: "system"` MUST NOT appear in {@link ChatRequest.messages}
 * — the runtime rejects/filters it. In-message `system` exists only so a
 * memory provider can store an archived-summary preamble if needed; it is never
 * sent to the provider as a message.
 */
export type Role = "system" | "user" | "assistant" | "tool";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  /**
   * The tool arguments as produced by the model. Always a JSON object
   * (`Record<string, unknown>`) in practice, but typed `unknown` because it
   * arrives untrusted from the model. Tool handlers SHOULD validate `input`
   * (e.g. with their zod schema) before use; executors that skip validation
   * pass it through verbatim.
   */
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | TextBlock[];
  is_error?: boolean;
}

/**
 * Anthropic extended-thinking block. Produced by the model when thinking is
 * enabled. The `signature` is opaque and MUST be preserved verbatim and
 * round-tripped back to the API on subsequent turns (alongside matching
 * `tool_result` blocks) — Anthropic rejects requests that drop or alter it.
 */
export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

/**
 * A pure function that normalises a model-produced {@link ToolUseBlock} before
 * execution. Corrects common model quirks: truncated JSON, extraneous fields,
 * name-casing drift. MUST NOT throw — return the block unmodified if
 * normalisation is uncertain. The executor applies this once per `tool_use`
 * block, before handler dispatch, so the agent loop never sees a raw
 * malformed block.
 */
export type ToolCallNormalizer = (block: ToolUseBlock) => ToolUseBlock;

// ---------------------------------------------------------------------------
// System blocks (the Anthropic `system` field — a block ARRAY, not a string)
// ---------------------------------------------------------------------------

/**
 * A single block of the top-level system prompt. The system prompt is sent as
 * an ARRAY of these (Anthropic-native: `system` accepts `string |
 * SystemBlock[]`), NOT a concatenated string, so each segment can carry its
 * own `cache_control` breakpoint and be cached independently.
 *
 * Segments are ordered most-stable-first: base instructions + tool guidance
 * (turn-invariant, high cache hit), then skill index (changes only when skills
 * load/unload), then archived-summary preamble (changes on trim). This matches
 * Claude Code / deepagentsjs, which place cache breakpoints at block
 * boundaries so a change in one segment does not invalidate the others.
 *
 * `cache_control` lives in core (not provider-layer) by explicit decision: it
 * is the cache-breakpoint marker for the Anthropic wire format. Non-Anthropic
 * providers simply ignore it when converting.
 */
export interface SystemTextBlock {
  type: "text";
  text: string;
  /**
   * Anthropic prompt-cache breakpoint. Place on the LAST block of a segment
   * you want cached. Up to 4 breakpoints per request; the runtime uses ~2
   * (base+tools segment, skill-catalog segment). `{ type: "ephemeral" }` →
   * 5-minute TTL, refreshed on hit.
   */
  cache_control?: { type: "ephemeral" };
}

export type SystemBlock = SystemTextBlock;

/**
 * Opaque per-message state owned by a concrete model provider. The runtime
 * persists and replays it verbatim but never inspects `data`. This is required
 * by stateless protocols whose next request must include provider-only output
 * items (for example Responses reasoning and server-tool items).
 */
export interface ProviderState {
  provider: string;
  data: unknown;
}

/**
 * A conversation message. For `role: "user" | "assistant"` content is either a
 * plain string or a block array (assistant tool_use turns use blocks).
 * `tool` role messages carry `ToolResultBlock[]` in `content`.
 *
 * `role: "system"` is reserved — see {@link Role}.
 */
export interface Message {
  role: Role;
  content: string | ContentBlock[];
  /** Provider-owned JSON-serializable state; opaque to the runtime. */
  providerState?: ProviderState;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "pause_turn";

export type ToolChoice = "auto" | "any" | "none" | { type: "tool"; name: string };

export interface ChatRequest {
  model: string;
  messages: Message[];
  /** Top-level system prompt as canonical text blocks, outside message history. */
  system?: SystemBlock[];
  tools?: ToolDescriptor[];
  maxTokens: number;
  /** Override model context window in tokens (default 262144 = 256 KiB). */
  contextWindowTokens?: number;
  temperature?: number;
  toolChoice?: ToolChoice;
}

export interface ChatResponse {
  /** Assistant message, possibly containing tool_use blocks. */
  message: Message;
  stopReason: StopReason;
  usage: ModelUsage;
}

/** Provider-neutral token accounting with optional protocol-specific details. */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export type ChatStreamChunk =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; block: ToolUseBlock }
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_block"; block: ThinkingBlock }
  | {
      type: "message_stop";
      stopReason: StopReason;
      usage: ChatResponse["usage"];
      providerState?: ProviderState;
    };

export interface IModelProvider {
  readonly id: string;
  /**
   * Model's maximum context window in tokens. Used as the basis for the
   * summarization threshold (summarize when estimated tokens exceed
   * `contextWindowTokens * summarizeTrigger`). Default: 262144 (256 KiB).
   */
  readonly contextWindowTokens: number;
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk>;
  /**
   * Token count for memory/trimming decisions. Providers with a real
   * count-tokens endpoint use it (falling back to a chars/4 estimate on
   * failure); others estimate. May cost a network round-trip — call it for
   * decisions, not per-iteration telemetry (use a local estimate there).
   */
  countTokens(messages: Message[]): Promise<number>;
  /**
   * Bind a zod schema and return a single-shot callable that extracts a
   * typed `T` from one provider call, mirroring langchain's
   * `BaseChatModel.withStructuredOutput`.
   *
   * The concrete extraction mechanism belongs to the provider. A provider may
   * use a forced function/tool call, JSON mode, or native JSON Schema output;
   * all implementations validate the result against the supplied zod schema.
   *
   * This is a PROVIDER-level, single-turn operation — it does NOT run the
   * agent loop, touch memory, or trigger HITL. It is the structured-output
   * primitive the runtime/agent layer composes on top of.
   *
   * The returned callable is lazy (langchain "Runnable" shape): build it
   * once, call it per input. `includeRaw: true` widens the resolved value to
   * `{ raw, parsed }` (raw assistant {@link Message}); the default resolves
   * to just `parsed`.
   *
   * Unsupported methods are rejected by the concrete provider.
   */
  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options?: StructuredOutputOptions & { includeRaw?: IncludeRaw },
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T>;
}

/**
 * Options for {@link IModelProvider.withStructuredOutput}.
 */
export interface StructuredOutputOptions {
  /**
   * Extraction strategy. When omitted, the concrete provider selects its
   * preferred native strategy. Unsupported strategies are rejected.
   */
  method?: "functionCalling" | "jsonMode" | "jsonSchema";
  /**
   * Override the synthetic extract tool's name (default `"extract"`). Useful
   * when the model must pick among several extraction tools.
   */
  name?: string;
}

/**
 * A lazy structured-output callable produced by
 * {@link IModelProvider.withStructuredOutput}. Takes the prompt as a string or
 * pre-built messages, resolves to the parsed `T` (or `{ raw, parsed }` when
 * `includeRaw` was set). An optional `AbortSignal` cancels the underlying
 * provider call cooperatively.
 */
export type StructuredOutputFn<T> = (input: string | Message[], signal?: AbortSignal) => Promise<T>;
