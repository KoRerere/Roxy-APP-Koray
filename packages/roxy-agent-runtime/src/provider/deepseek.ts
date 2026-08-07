import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicProvider } from "./anthropic.ts";
import type { AnthropicProviderOptions } from "./anthropic.ts";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ContentBlock,
  IModelProvider,
  Message,
  StructuredOutputFn,
  StructuredOutputOptions,
} from "../core/interfaces.ts";
import { zodToJsonSchema } from "../tools/schema.ts";
import type { ZodType } from "zod";

/**
 * DeepSeek talks the Anthropic messages protocol (its `/anthropic` endpoint),
 * so this provider does NOT reimplement a separate wire format for chat — it
 * delegates {@link chat}/{@link chatStream}/{@link countTokens} to
 * {@link AnthropicProvider} (pointed at DeepSeek, bearer auth) and only owns
 * DeepSeek's own quirks:
 *
 *  1. Input sanitization ({@link sanitizeForDeepseek}) — strip content-block
 *     types DeepSeek's Anthropic API rejects (images, documents, …).
 *  2. Structured output ({@link withStructuredOutput}) — implemented with
 *     DeepSeek's NATIVE JSON Output (`response_format: { type: "json_object" }`)
 *     over its OpenAI-compatible `/chat/completions` endpoint, NOT the Anthropic
 *     forced-tool path. `response_format` is not an Anthropic field, so this is
 *     the only structured-output mechanism DeepSeek actually honors. See
 *     docs/deepseek-json-output.md.
 *
 * `baseURL` is required and passed directly to the Anthropic protocol client;
 * the JSON Output transport appends `/chat/completions` to the same URL.
 */

/** Reasonable cap so JSON output is not truncated mid-object (doc note #3). */
const JSON_OUTPUT_MAX_TOKENS = 4096;

/**
 * Content-block `type`s DeepSeek's Anthropic API marks "Not Supported" — these
 * are stripped before the request is sent (source: docs/deepseek-anthropic-api.md,
 * "Message Fields"). Everything else — including DeepSeek-supported variants not
 * in roxy's core union today (`server_tool_use`, `web_search_tool_result`) — is
 * left untouched, so this is a denylist, not an allowlist. roxy's core
 * {@link ContentBlock} union (text/tool_use/tool_result/thinking) is entirely
 * supported, so stripping only ever fires on foreign/future blocks (e.g. images).
 */
const UNSUPPORTED_BLOCK_TYPES = new Set<string>([
  "image",
  "document",
  "search_result",
  "redacted_thinking",
  "code_execution_tool_result",
  "mcp_tool_use",
  "mcp_tool_result",
  "container_upload",
]);

// ---------------------------------------------------------------------------
// JSON Output (OpenAI-compatible /chat/completions) — structured output seam
// ---------------------------------------------------------------------------

export interface DeepseekJsonRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  response_format: { type: "json_object" };
  max_tokens: number;
  temperature?: number;
}

export interface DeepseekJsonResponse {
  choices: Array<{ message: { content: string | null } }>;
}

/**
 * Transport seam for DeepSeek's JSON Output endpoint. The default implementation
 * POSTs to `<root>/chat/completions`; tests inject a fake to exercise the
 * prompt-building + parse/validate logic offline.
 */
export interface DeepseekJsonClient {
  create(body: DeepseekJsonRequest, signal?: AbortSignal): Promise<DeepseekJsonResponse>;
}

export interface DeepseekProviderOptions {
  /** API key already resolved by the host application. */
  apiKey: string;
  model: string;
  /**
   * Required API root. Passed directly to the Anthropic protocol client; the
   * JSON Output transport appends `/chat/completions`.
   */
  baseURL: string;
  /**
   * Extra headers forwarded unchanged to the underlying Anthropic client.
   * When omitted, DeepSeek bearer authentication is derived from `apiKey`.
   */
  defaultHeaders?: Record<string, string>;
  /** Override model context window tokens (default 65536 for deepseek-chat). */
  contextWindowTokens?: number;
  /** Test back-door: inject the Anthropic client (chat/stream path). */
  _client?: Anthropic;
  /** Test back-door: inject the JSON Output client (structured-output path). */
  _jsonClient?: DeepseekJsonClient;
}

/** Map DeepSeek options to the delegated Anthropic protocol provider. */
export function buildDeepseekAnthropicOptions(opts: DeepseekProviderOptions): AnthropicProviderOptions {
  if (!opts.baseURL) {
    throw new Error("DeepseekProvider: baseURL is required (e.g. https://api.deepseek.com)");
  }

  return {
    model: opts.model,
    apiKey: opts.apiKey,
    baseURL: opts.baseURL.replace(/\/$/, ""),
    defaultHeaders: opts.defaultHeaders ?? { Authorization: `Bearer ${opts.apiKey}` },
    contextWindowTokens: opts.contextWindowTokens ?? 65536,
    promptCaching: false,
    countTokensApi: false,
    ...(opts._client ? { _client: opts._client } : {}),
  };
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Return a request safe for DeepSeek: drop any content block whose type DeepSeek
 * rejects (images, documents, …; see {@link UNSUPPORTED_BLOCK_TYPES}). Pure —
 * never mutates the input. When stripping empties a message's block list, a text
 * placeholder is substituted so DeepSeek is not sent an empty-content message
 * (which it rejects), and the user/assistant/tool turn structure is preserved.
 */
export function sanitizeForDeepseek(req: ChatRequest): ChatRequest {
  let changed = false;
  const messages: Message[] = req.messages.map((m) => {
    if (typeof m.content === "string") return m;
    const kept = m.content.filter((b) => !UNSUPPORTED_BLOCK_TYPES.has(b.type));
    if (kept.length === m.content.length) return m;
    changed = true;
    const content: ContentBlock[] = kept.length > 0 ? kept : [{ type: "text", text: "[non-text content omitted]" }];
    return { ...m, content };
  });
  return changed ? { ...req, messages } : req;
}

// ---------------------------------------------------------------------------
// JSON Output helpers
// ---------------------------------------------------------------------------

/**
 * Build the system prompt that steers DeepSeek's JSON Output. DeepSeek requires
 * the prompt to contain the word "json" AND show the desired shape (doc note
 * #2) — we embed the schema's JSON Schema to satisfy both.
 */
function buildJsonSystemPrompt(jsonSchema: unknown): string {
  return [
    "You are a strict data-extraction assistant.",
    "Respond with a SINGLE valid json object and nothing else — no prose, no markdown fences.",
    "The json object MUST conform to this JSON Schema:",
    JSON.stringify(jsonSchema),
  ].join("\n");
}

/** Flatten a roxy message's content to a plain string for the OpenAI endpoint. */
function messageContentToString(m: Message): string {
  if (typeof m.content === "string") return m.content;
  return m.content.map((b) => (b.type === "text" ? b.text : JSON.stringify(b))).join("\n");
}

function normalizeJsonInput(input: string | Message[]): Array<{ role: string; content: string }> {
  const messages = typeof input === "string" ? [{ role: "user", content: input } as Message] : input;
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
    content: messageContentToString(m),
  }));
}

function createJsonHttpClient(
  apiKey: string,
  rootBaseURL: string,
  defaultHeaders?: Record<string, string>,
): DeepseekJsonClient {
  const url = `${rootBaseURL.replace(/\/$/, "")}/chat/completions`;
  const headers = defaultHeaders ?? { authorization: `Bearer ${apiKey}` };
  return {
    async create(body, signal) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`DeepSeek JSON request failed: ${res.status} ${res.statusText} ${text}`);
      }
      return (await res.json()) as DeepseekJsonResponse;
    },
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * DeepSeek provider — chat/stream/countTokens delegate to {@link AnthropicProvider}
 * (DeepSeek speaks the Anthropic protocol), with DeepSeek-specific input
 * sanitization; structured output uses DeepSeek's native JSON Output feature.
 */
export class DeepseekProvider implements IModelProvider {
  readonly id = "deepseek";
  readonly contextWindowTokens: number;
  private readonly inner: AnthropicProvider;
  private readonly jsonClient: DeepseekJsonClient;
  private readonly defaultModel: string;

  constructor(opts: DeepseekProviderOptions) {
    this.defaultModel = opts.model;
    const anthropicOptions = buildDeepseekAnthropicOptions(opts);
    const root = anthropicOptions.baseURL!;

    this.inner = new AnthropicProvider(anthropicOptions);
    this.contextWindowTokens = this.inner.contextWindowTokens;
    this.jsonClient = opts._jsonClient ?? createJsonHttpClient(opts.apiKey, root, opts.defaultHeaders);
  }

  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    return this.inner.chat(sanitizeForDeepseek(req), signal);
  }

  chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    return this.inner.chatStream(sanitizeForDeepseek(req), signal);
  }

  countTokens(messages: Message[]): Promise<number> {
    return this.inner.countTokens(messages);
  }

  /**
   * Structured output via DeepSeek's native JSON Output (`response_format:
   * { type: "json_object" }`) over the OpenAI-compatible endpoint. The schema
   * is embedded in a system prompt (which contains the required "json" hint),
   * the returned content is JSON-parsed and validated with the zod schema.
   * DeepSeek can occasionally return empty content (doc note #4) — surfaced as
   * a clear error rather than a silent bad parse.
   */
  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options?: StructuredOutputOptions & { includeRaw?: IncludeRaw },
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T> {
    const includeRaw = options?.includeRaw ?? false;
    const systemPrompt = buildJsonSystemPrompt(zodToJsonSchema(schema));

    const fn = async (input: string | Message[], signal?: AbortSignal): Promise<T | { raw: Message; parsed: T }> => {
      const res = await this.jsonClient.create(
        {
          model: this.defaultModel,
          messages: [{ role: "system", content: systemPrompt }, ...normalizeJsonInput(input)],
          response_format: { type: "json_object" },
          max_tokens: JSON_OUTPUT_MAX_TOKENS,
        },
        signal,
      );
      const content = res.choices[0]?.message?.content;
      if (!content) {
        throw new Error(
          "DeepseekProvider.withStructuredOutput: DeepSeek returned empty content for json_object (doc note #4 — try adjusting the prompt)",
        );
      }
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch {
        throw new Error(`DeepseekProvider.withStructuredOutput: response was not valid JSON: ${content}`);
      }
      const parsed = schema.parse(raw);
      if (includeRaw) {
        const rawMsg: Message = { role: "assistant", content: [{ type: "text", text: content }] };
        return { raw: rawMsg, parsed };
      }
      return parsed;
    };

    return fn as StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T>;
  }
}
