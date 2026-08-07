import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  buildDeepseekAnthropicOptions,
  DeepseekProvider,
  sanitizeForDeepseek,
  type DeepseekJsonClient,
  type DeepseekJsonRequest,
  type DeepseekJsonResponse,
} from "../../src/provider/deepseek.ts";
import type { ChatRequest, ContentBlock } from "../../src/core/interfaces.ts";

// ---------------------------------------------------------------------------
// Mock Anthropic SDK client (DeepSeek speaks the Anthropic protocol, so the
// provider delegates to AnthropicProvider under the hood).
// ---------------------------------------------------------------------------

function makeAnthropicMessage(opts: {
  content?: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: "thinking"; thinking: string; signature: string }
  >;
  stop_reason?: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: opts.content ?? [{ type: "text", text: "hi" }],
    model: "deepseek-chat",
    stop_reason: opts.stop_reason ?? "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: opts.inputTokens ?? 10,
      output_tokens: opts.outputTokens ?? 5,
    },
  };
}

function makeStreamImpl(events: unknown[]) {
  return (_body: unknown, _opts?: unknown): AsyncIterable<unknown> => {
    async function* gen(): AsyncIterable<unknown> {
      for (const e of events) yield e;
    }
    return gen();
  };
}

function makeProvider(
  createImpl: (body: unknown, opts?: unknown) => unknown = () => Promise.resolve(makeAnthropicMessage({})),
  streamImpl?: (body: unknown, opts?: unknown) => AsyncIterable<unknown>,
  jsonCreate?: (body: DeepseekJsonRequest) => Promise<DeepseekJsonResponse>,
) {
  const mockClient = {
    messages: {
      create: vi.fn(createImpl),
      ...(streamImpl ? { stream: vi.fn(streamImpl) } : {}),
    },
  } as unknown as Anthropic;
  const jsonClient: DeepseekJsonClient = {
    create: vi.fn(jsonCreate ?? (() => Promise.resolve({ choices: [{ message: { content: "{}" } }] }))),
  };
  const provider = new DeepseekProvider({
    model: "deepseek-chat",
    apiKey: "test-key",
    baseURL: "https://api.deepseek.com",
    _client: mockClient,
    _jsonClient: jsonClient,
  });
  return {
    provider,
    mockClient: mockClient as unknown as {
      messages: { create: ReturnType<typeof vi.fn>; stream?: ReturnType<typeof vi.fn> };
    },
    jsonClient: jsonClient as unknown as { create: ReturnType<typeof vi.fn> },
  };
}

/** The (sanitized) messages that reached the Anthropic client. */
function sentMessages(mockClient: {
  messages: { create: ReturnType<typeof vi.fn> };
}): Array<{ role: string; content: unknown }> {
  const body = mockClient.messages.create.mock.calls[0]?.[0] as {
    messages: Array<{ role: string; content: unknown }>;
  };
  return body.messages;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeepseekProvider", () => {
  it("forwards caller-provided defaultHeaders unchanged", () => {
    // Regression: DeepseekProvider always replaced caller headers with its own
    // Authorization header, so proxy routing and custom auth could not be used.
    // Fixed by: caller-provided defaultHeaders are passed through verbatim.
    const defaultHeaders = {
      Authorization: "Bearer proxy-token",
      "Conversation-Id": "conversation-1",
    };
    const options = buildDeepseekAnthropicOptions({
      model: "deepseek-chat",
      apiKey: "test-key",
      baseURL: "https://proxy.example.test/anthropic",
      defaultHeaders,
    });

    expect(options.defaultHeaders).toBe(defaultHeaders);
    expect(options.baseURL).toBe("https://proxy.example.test/anthropic");
  });

  it("keeps bearer authentication as the default when defaultHeaders are omitted", () => {
    const options = buildDeepseekAnthropicOptions({
      model: "deepseek-chat",
      apiKey: "test-key",
      baseURL: "https://api.deepseek.com",
    });
    expect(options.defaultHeaders).toEqual({ Authorization: "Bearer test-key" });
  });

  it("uses defaultHeaders for structured JSON output requests", async () => {
    // Regression: headers reached delegated Anthropic chat requests but not
    // the native JSON Output fetch used by withStructuredOutput().
    // Fixed by: both DeepSeek transports share the caller-provided header map.
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: '{"ok":true}' } }] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const mockClient = {
        messages: { create: vi.fn(() => Promise.resolve(makeAnthropicMessage({}))) },
      } as unknown as Anthropic;
      const provider = new DeepseekProvider({
        model: "deepseek-chat",
        apiKey: "test-key",
        baseURL: "https://proxy.example.test",
        defaultHeaders: { Authorization: "Bearer proxy-token", "Conversation-Id": "conversation-1" },
        _client: mockClient,
      });

      await provider.withStructuredOutput(z.object({ ok: z.boolean() }))("return json");

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        headers: {
          Authorization: "Bearer proxy-token",
          "Conversation-Id": "conversation-1",
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("has id 'deepseek' and a DeepSeek-sized default context window", () => {
    const { provider } = makeProvider();
    expect(provider.id).toBe("deepseek");
    expect(provider.contextWindowTokens).toBe(65536);
  });

  it("chat() delegates to the Anthropic protocol and maps a text response", async () => {
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [{ type: "text", text: "Hello!" }],
          inputTokens: 12,
          outputTokens: 4,
        }),
      ),
    );
    const resp = await provider.chat({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    });
    expect(resp.stopReason).toBe("end_turn");
    expect(resp.usage).toEqual({ inputTokens: 12, outputTokens: 4 });
    const content = resp.message.content as ContentBlock[];
    expect(content[0]).toMatchObject({ type: "text", text: "Hello!" });
  });

  it("chat() maps tool_use responses", async () => {
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [{ type: "tool_use", id: "tu1", name: "my_tool", input: { x: 1 } }],
          stop_reason: "tool_use",
        }),
      ),
    );
    const resp = await provider.chat({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "use tool" }],
      maxTokens: 100,
    });
    expect(resp.stopReason).toBe("tool_use");
    const content = resp.message.content as ContentBlock[];
    expect(content[0]).toMatchObject({ type: "tool_use", id: "tu1", name: "my_tool", input: { x: 1 } });
  });

  it("strips image (non-text) blocks before sending, keeps sibling text", async () => {
    const { provider, mockClient } = makeProvider();
    const imageBlock = {
      type: "image",
      source: { data: "BINARY" },
    } as unknown as ContentBlock;
    await provider.chat({
      model: "deepseek-chat",
      messages: [{ role: "user", content: [imageBlock, { type: "text", text: "caption" }] }],
      maxTokens: 100,
    });
    const serialized = JSON.stringify(sentMessages(mockClient));
    expect(serialized).not.toContain("BINARY");
    expect(serialized).toContain("caption");
  });

  it("substitutes a placeholder when stripping empties a message", async () => {
    const { provider, mockClient } = makeProvider();
    const imageBlock = {
      type: "image",
      source: { data: "BINARY" },
    } as unknown as ContentBlock;
    await provider.chat({
      model: "deepseek-chat",
      messages: [{ role: "user", content: [imageBlock] }],
      maxTokens: 100,
    });
    const msgs = sentMessages(mockClient);
    // The message survived (not empty) with a text placeholder instead.
    const content = msgs[0]?.content as Array<{ type: string; text?: string }>;
    expect(content[0]).toMatchObject({ type: "text" });
    expect(JSON.stringify(msgs)).not.toContain("BINARY");
  });

  it("strips every DeepSeek-unsupported block type from the doc denylist", async () => {
    const { provider, mockClient } = makeProvider();
    const bad = (type: string) => ({ type, source: { data: "BAD" } }) as unknown as ContentBlock;
    await provider.chat({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: [
            bad("image"),
            bad("document"),
            bad("search_result"),
            bad("redacted_thinking"),
            bad("code_execution_tool_result"),
            bad("mcp_tool_use"),
            bad("mcp_tool_result"),
            bad("container_upload"),
            { type: "text", text: "keep me" },
          ],
        },
      ],
      maxTokens: 100,
    });
    const serialized = JSON.stringify(sentMessages(mockClient));
    expect(serialized).not.toContain("BAD");
    expect(serialized).toContain("keep me");
  });

  it("passes through DeepSeek-supported blocks not in the core union (e.g. server_tool_use)", () => {
    const server = {
      type: "server_tool_use",
      id: "s1",
      name: "web_search",
      input: {},
    } as unknown as ContentBlock;
    const req: ChatRequest = {
      model: "deepseek-chat",
      maxTokens: 100,
      messages: [{ role: "assistant", content: [server, { type: "text", text: "x" }] }],
    };
    // Nothing on the denylist → same reference back (not stripped).
    expect(sanitizeForDeepseek(req)).toBe(req);
  });

  it("leaves text / tool_use / tool_result / thinking untouched (pure passthrough)", () => {
    const req: ChatRequest = {
      model: "deepseek-chat",
      maxTokens: 100,
      messages: [
        { role: "user", content: "plain" },
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "t", signature: "" },
            { type: "text", text: "answer" },
            { type: "tool_use", id: "a", name: "x", input: {} },
          ],
        },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] },
      ],
    };
    // No non-sendable blocks → same object reference returned (no copy).
    expect(sanitizeForDeepseek(req)).toBe(req);
  });

  it("countTokens() returns a positive number", async () => {
    const { provider } = makeProvider();
    const count = await provider.countTokens([{ role: "user", content: "hello world" }]);
    expect(count).toBeGreaterThan(0);
  });

  it("countTokens() uses the local heuristic — never calls a count endpoint", async () => {
    // DeepSeek's Anthropic-compatible surface has no count-tokens endpoint;
    // the provider must not attempt the API path AnthropicProvider uses.
    const countTokens = vi.fn(() => Promise.resolve({ input_tokens: 999 }));
    const mockClient = {
      messages: {
        create: vi.fn(() => Promise.resolve(makeAnthropicMessage({}))),
        countTokens,
      },
    } as unknown as Anthropic;
    const provider = new DeepseekProvider({
      model: "deepseek-chat",
      apiKey: "test-key",
      baseURL: "https://api.deepseek.com",
      _client: mockClient,
      _jsonClient: { create: vi.fn() },
    });
    const count = await provider.countTokens([{ role: "user", content: "hello world" }]);
    expect(count).toBe(3); // ceil(11 chars / 4), not the endpoint's 999
    expect(countTokens).not.toHaveBeenCalled();
  });

  it("never sends cache_control — DeepSeek manages context caching server-side", async () => {
    const { provider, mockClient } = makeProvider();

    await provider.chat({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "hi" }],
      system: [{ type: "text", text: "pinned", cache_control: { type: "ephemeral" } }],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as {
      system: Array<{ cache_control?: unknown }>;
      messages: Array<{ content: unknown }>;
    };
    // Explicit marker stripped from system; message content left as a plain string
    // (no auto breakpoint promotion).
    expect(body.system[0]?.cache_control).toBeUndefined();
    expect(body.messages[0]?.content).toBe("hi");
  });

  it("chatStream() delegates: yields text_delta then message_stop", async () => {
    const { provider } = makeProvider(
      undefined,
      makeStreamImpl([
        { type: "message_start", message: { usage: { input_tokens: 3 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "streamed" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } },
        { type: "message_stop" },
      ]),
    );
    const chunks: Array<{ type: string; text?: string }> = [];
    for await (const c of provider.chatStream({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "go" }],
      maxTokens: 100,
    })) {
      chunks.push(c as { type: string; text?: string });
    }
    expect(chunks.some((c) => c.type === "text_delta")).toBe(true);
    expect(chunks.find((c) => c.type === "message_stop")).toBeDefined();
  });

  it("chatStream() sanitizes the streamed request too", async () => {
    const { provider, mockClient } = makeProvider(undefined, makeStreamImpl([{ type: "message_stop" }]));
    const imageBlock = { type: "image", source: { data: "BINARY" } } as unknown as ContentBlock;
    for await (const _ of provider.chatStream({
      model: "deepseek-chat",
      messages: [{ role: "user", content: [imageBlock, { type: "text", text: "cap" }] }],
      maxTokens: 100,
    })) {
      // drain
    }
    const body = mockClient.messages.stream?.mock.calls[0]?.[0] as {
      messages: Array<{ content: unknown }>;
    };
    expect(JSON.stringify(body.messages)).not.toContain("BINARY");
  });

  it("withStructuredOutput() uses native JSON Output (response_format json_object)", async () => {
    const Schema = z.object({ name: z.string(), age: z.number() });
    const { provider, jsonClient } = makeProvider(undefined, undefined, () =>
      Promise.resolve({ choices: [{ message: { content: '{"name":"Alice","age":30}' } }] }),
    );
    const fn = provider.withStructuredOutput(Schema);
    expect(await fn("Who is the person?")).toEqual({ name: "Alice", age: 30 });

    const body = jsonClient.create.mock.calls[0]?.[0] as DeepseekJsonRequest;
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBeGreaterThan(0);
    // System prompt must contain the "json" hint + the schema shape (doc note #2).
    const system = body.messages.find((m) => m.role === "system")?.content ?? "";
    expect(system.toLowerCase()).toContain("json");
    expect(system).toContain("age");
    expect(body.messages.at(-1)).toMatchObject({ role: "user", content: "Who is the person?" });
  });

  it("withStructuredOutput() does NOT hit the Anthropic (tool) path", async () => {
    const Schema = z.object({ ok: z.boolean() });
    const { provider, mockClient } = makeProvider(undefined, undefined, () =>
      Promise.resolve({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );
    await provider.withStructuredOutput(Schema)("go");
    expect(mockClient.messages.create).not.toHaveBeenCalled();
  });

  it("withStructuredOutput() throws a clear error on empty content (doc note #4)", async () => {
    const Schema = z.object({ a: z.number() });
    const { provider } = makeProvider(undefined, undefined, () =>
      Promise.resolve({ choices: [{ message: { content: null } }] }),
    );
    await expect(provider.withStructuredOutput(Schema)("x")).rejects.toThrow(/empty content/i);
  });

  it("withStructuredOutput() includeRaw returns { raw, parsed }", async () => {
    const Schema = z.object({ value: z.string() });
    const { provider } = makeProvider(undefined, undefined, () =>
      Promise.resolve({ choices: [{ message: { content: '{"value":"hello"}' } }] }),
    );
    const result = await provider.withStructuredOutput(Schema, { includeRaw: true })("t");
    expect(result).toHaveProperty("raw");
    expect((result as { parsed: { value: string } }).parsed).toEqual({ value: "hello" });
  });
});
