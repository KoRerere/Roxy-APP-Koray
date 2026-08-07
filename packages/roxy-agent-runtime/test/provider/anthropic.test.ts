import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicProvider, buildClientOptions, type AnthropicProviderOptions } from "../../src/provider/anthropic.ts";

// ---------------------------------------------------------------------------
// buildClientOptions — the pure seam that maps provider options to the
// Anthropic SDK constructor options (apiKey / baseURL / defaultHeaders).
// ---------------------------------------------------------------------------

describe("buildClientOptions", () => {
  it("passes baseURL verbatim (does NOT append /anthropic)", () => {
    // Regression: our `/llm-proxy` is already an Anthropic-protocol root, so the
    // AnthropicProvider must send requests to it unchanged. The "/anthropic"
    // suffix is DeepseekProvider's derived path, NOT AnthropicProvider's — this
    // provider must never add it.
    // Fixed by: AnthropicProvider forwards `baseURL` as-is to the SDK.
    const opts = buildClientOptions({
      model: "m",
      apiKey: "LITERAL_TOKEN_VALUE",
      baseURL: "https://server.example.com/llm-proxy",
    });
    expect(opts.baseURL).toBe("https://server.example.com/llm-proxy");
  });

  it("forwards custom defaultHeaders to the SDK client", () => {
    // Regression: tracing/routing headers (Conversation-Id, ai-agent-version, …)
    // had no way to reach the Anthropic client.
    // Fixed by: the new `defaultHeaders` option on AnthropicProviderOptions.
    const opts = buildClientOptions({
      model: "m",
      apiKey: "LITERAL",
      defaultHeaders: { "ai-agent-version": "1.2.3", "Conversation-Id": "c1" },
    });
    expect(opts.defaultHeaders).toMatchObject({ "ai-agent-version": "1.2.3", "Conversation-Id": "c1" });
  });

  it("uses defaultHeaders as the only custom authentication-header mechanism", () => {
    // Regression: authStyle duplicated defaultHeaders and coupled the generic
    // Anthropic provider to a small, hard-coded set of authentication schemes.
    // Fixed by: removing authStyle and forwarding an explicit Authorization header.
    const removedOption: AnthropicProviderOptions = {
      model: "m",
      apiKey: "sk-literal",
      // @ts-expect-error authStyle was removed; use defaultHeaders instead.
      authStyle: "bearer",
    };
    expect(removedOption).toBeDefined();

    const opts = buildClientOptions({
      model: "m",
      apiKey: "sk-literal",
      defaultHeaders: { "x-trace": "t", Authorization: "Bearer sk-literal" },
    });
    expect(opts.defaultHeaders).toMatchObject({ "x-trace": "t", Authorization: "Bearer sk-literal" });
  });

  it("uses the host-resolved apiKey without consulting process.env", () => {
    // Regression: apiKeyEnv ambiguously meant either an environment variable
    // name or a literal token, so provider construction performed application
    // config resolution inside the framework.
    // Fixed by: providers accept only an already-resolved apiKey value.
    process.env.HOST_RESOLVED_TOKEN = "wrong-token";
    try {
      const opts = buildClientOptions({ model: "m", apiKey: "HOST_RESOLVED_TOKEN" });
      expect(opts.apiKey).toBe("HOST_RESOLVED_TOKEN");
      expect(opts.defaultHeaders).toBeUndefined();
    } finally {
      delete process.env.HOST_RESOLVED_TOKEN;
    }
  });
});

// ---------------------------------------------------------------------------
// Mock helpers
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
    content: opts.content ?? [{ type: "text", text: "hello" }],
    model: "claude-3-5-sonnet-20241022",
    stop_reason: opts.stop_reason ?? "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: opts.inputTokens ?? 10,
      output_tokens: opts.outputTokens ?? 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
}

/** Build an AnthropicProvider with a mock SDK client injected. */
function makeProvider(
  createImpl: (body: unknown, opts?: unknown) => unknown = () => Promise.resolve(makeAnthropicMessage({})),
  streamImpl?: (body: unknown, opts?: unknown) => AsyncIterable<unknown>,
  thinking?: { budgetTokens: number },
  extra?: {
    promptCaching?: boolean;
    countTokensImpl?: (body: unknown) => unknown;
  },
) {
  const mockClient = {
    messages: {
      create: vi.fn(createImpl),
      ...(streamImpl ? { stream: vi.fn(streamImpl) } : {}),
      ...(extra?.countTokensImpl ? { countTokens: vi.fn(extra.countTokensImpl) } : {}),
    },
  } as unknown as Anthropic;

  const provider = new AnthropicProvider({
    model: "claude-3-5-sonnet-20241022",
    apiKey: "test-key",
    _client: mockClient,
    ...(thinking ? { thinking } : {}),
    ...(extra?.promptCaching !== undefined ? { promptCaching: extra.promptCaching } : {}),
  });
  return {
    provider,
    mockClient: mockClient as unknown as {
      messages: {
        create: ReturnType<typeof vi.fn>;
        stream?: ReturnType<typeof vi.fn>;
        countTokens?: ReturnType<typeof vi.fn>;
      };
    },
  };
}

/**
 * Build a mock `messages.stream` that yields the given raw SSE events in order
 * as an async iterable.
 */
function makeStreamImpl(events: unknown[]) {
  return (_body: unknown, _opts?: unknown): AsyncIterable<unknown> => {
    async function* gen(): AsyncIterable<unknown> {
      for (const e of events) yield e;
    }
    return gen();
  };
}

/** Raw SSE event builders (structural — mirror Anthropic's event shapes). */
function evMessageStart(inputTokens = 10) {
  return {
    type: "message_start",
    message: { usage: { input_tokens: inputTokens, output_tokens: 0 } },
  };
}
function evBlockStart(index: number, content_block: Record<string, unknown>) {
  return { type: "content_block_start", index, content_block };
}
function evBlockDelta(index: number, delta: Record<string, unknown>) {
  return { type: "content_block_delta", index, delta };
}
function evBlockStop(index: number) {
  return { type: "content_block_stop", index };
}
function evMessageDelta(stop_reason: string, outputTokens = 5) {
  return {
    type: "message_delta",
    delta: { stop_reason },
    usage: { output_tokens: outputTokens },
  };
}
function evMessageStop() {
  return { type: "message_stop" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnthropicProvider", () => {
  it("chat() with text response maps to ChatResponse", async () => {
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [{ type: "text", text: "Hello there!" }],
          stop_reason: "end_turn",
          inputTokens: 15,
          outputTokens: 8,
        }),
      ),
    );

    const resp = await provider.chat({
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    });

    expect(resp.stopReason).toBe("end_turn");
    expect(resp.message.role).toBe("assistant");
    expect(resp.usage.inputTokens).toBe(15);
    expect(resp.usage.outputTokens).toBe(8);
    const content = Array.isArray(resp.message.content) ? resp.message.content : [];
    expect(content[0]).toMatchObject({ type: "text", text: "Hello there!" });
  });

  it("chat() with tool_use response maps tool_use blocks", async () => {
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "my_tool",
              input: { x: 1 },
            },
          ],
          stop_reason: "tool_use",
        }),
      ),
    );

    const resp = await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "use tool" }],
      maxTokens: 100,
    });

    expect(resp.stopReason).toBe("tool_use");
    const content = Array.isArray(resp.message.content) ? resp.message.content : [];
    expect(content[0]).toMatchObject({
      type: "tool_use",
      id: "tu_1",
      name: "my_tool",
      input: { x: 1 },
    });
  });

  it("chat() forwards tools and toolChoice to SDK", async () => {
    const { provider, mockClient } = makeProvider(() => Promise.resolve(makeAnthropicMessage({})));

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          name: "my_tool",
          description: "a tool",
          inputSchema: { type: "object" },
          source: "builtin",
        },
      ],
      toolChoice: { type: "tool", name: "my_tool" },
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.tools).toBeDefined();
    expect((body.tools as unknown[])[0]).toMatchObject({ name: "my_tool" });
    expect(body.tool_choice).toMatchObject({ type: "tool", name: "my_tool" });
  });

  it("chat() forwards system blocks", async () => {
    const { provider, mockClient } = makeProvider(() => Promise.resolve(makeAnthropicMessage({})));

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      system: [{ type: "text", text: "You are helpful." }],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.system).toBeDefined();
    expect((body.system as Array<{ type: string; text: string }>)[0]).toMatchObject({
      type: "text",
      text: "You are helpful.",
    });
  });

  it("countTokens() returns a positive number", async () => {
    const { provider } = makeProvider();
    const count = await provider.countTokens([{ role: "user", content: "hello world" }]);
    expect(count).toBeGreaterThan(0);
  });

  it("countTokens() uses the count-tokens endpoint when available", async () => {
    const { provider, mockClient } = makeProvider(undefined, undefined, undefined, {
      countTokensImpl: () => Promise.resolve({ input_tokens: 42 }),
    });
    const count = await provider.countTokens([{ role: "user", content: "hello world" }]);
    expect(count).toBe(42);
    const body = mockClient.messages.countTokens?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.model).toBe("claude-3-5-sonnet-20241022");
    expect(body.messages).toEqual([{ role: "user", content: "hello world" }]);
  });

  it("countTokens() falls back to the chars/4 heuristic when the endpoint fails", async () => {
    const { provider } = makeProvider(undefined, undefined, undefined, {
      countTokensImpl: () => Promise.reject(new Error("boom")),
    });
    const count = await provider.countTokens([
      { role: "user", content: "hello world" }, // 11 chars → ceil(11/4) = 3
    ]);
    expect(count).toBe(3);
  });

  it("countTokens() returns 0 for an empty message list without calling the endpoint", async () => {
    const { provider, mockClient } = makeProvider(undefined, undefined, undefined, {
      countTokensImpl: () => Promise.resolve({ input_tokens: 999 }),
    });
    const count = await provider.countTokens([]);
    expect(count).toBe(0);
    expect(mockClient.messages.countTokens).not.toHaveBeenCalled();
  });

  it("chatStream() yields text_delta then message_stop", async () => {
    const { provider } = makeProvider(
      undefined,
      makeStreamImpl([
        evMessageStart(12),
        evBlockStart(0, { type: "text" }),
        evBlockDelta(0, { type: "text_delta", text: "streaming text" }),
        evBlockStop(0),
        evMessageDelta("end_turn", 7),
        evMessageStop(),
      ]),
    );

    const chunks: Array<{ type: string }> = [];
    for await (const chunk of provider.chatStream({
      model: "test",
      messages: [{ role: "user", content: "go" }],
      maxTokens: 100,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === "text_delta")).toBe(true);
    const stop = chunks.find((c) => c.type === "message_stop");
    expect(stop).toBeDefined();
  });

  it("chatStream() yields tool_use block for tool_use response", async () => {
    const { provider } = makeProvider(
      undefined,
      makeStreamImpl([
        evMessageStart(),
        evBlockStart(0, { type: "tool_use", id: "tu1", name: "echo" }),
        evBlockDelta(0, { type: "input_json_delta", partial_json: '{"x":1}' }),
        evBlockStop(0),
        evMessageDelta("tool_use"),
        evMessageStop(),
      ]),
    );

    const chunks: Array<{ type: string; block?: { id?: string; input?: unknown } }> = [];
    for await (const chunk of provider.chatStream({
      model: "test",
      messages: [{ role: "user", content: "go" }],
      maxTokens: 100,
    })) {
      chunks.push(chunk as { type: string; block?: { id?: string; input?: unknown } });
    }

    const toolChunk = chunks.find((c) => c.type === "tool_use");
    expect(toolChunk).toBeDefined();
    expect(toolChunk?.block?.id).toBe("tu1");
    expect(toolChunk?.block?.input).toEqual({ x: 1 });
    const stop = chunks.find((c) => c.type === "message_stop");
    expect((stop as { stopReason?: string } | undefined)?.stopReason).toBe("tool_use");
  });

  it("chat() maps thinking blocks (with signature) for history round-trip", async () => {
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [
            {
              type: "thinking",
              thinking: "let me reason",
              signature: "sig_abc",
            },
            { type: "text", text: "answer" },
          ],
          stop_reason: "end_turn",
        }),
      ),
    );

    const resp = await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    });

    const content = Array.isArray(resp.message.content) ? resp.message.content : [];
    expect(content[0]).toMatchObject({
      type: "thinking",
      thinking: "let me reason",
      signature: "sig_abc",
    });
  });

  it("thinking enabled: request body carries thinking and omits temperature", async () => {
    const { provider, mockClient } = makeProvider(() => Promise.resolve(makeAnthropicMessage({})), undefined, {
      budgetTokens: 2000,
    });

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 4000,
      temperature: 0.7, // MUST be dropped when thinking is enabled
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 2000 });
    expect(body.temperature).toBeUndefined();
  });

  it("thinking disabled: no thinking param, temperature preserved", async () => {
    const { provider, mockClient } = makeProvider(() => Promise.resolve(makeAnthropicMessage({})));

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 4000,
      temperature: 0.5,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.thinking).toBeUndefined();
    expect(body.temperature).toBe(0.5);
  });

  it("chatStream() yields thinking_delta(s) then a signed thinking_block", async () => {
    const { provider, mockClient } = makeProvider(
      undefined,
      makeStreamImpl([
        evMessageStart(),
        evBlockStart(0, { type: "thinking" }),
        evBlockDelta(0, { type: "thinking_delta", thinking: "step 1 " }),
        evBlockDelta(0, { type: "thinking_delta", thinking: "step 2" }),
        evBlockDelta(0, { type: "signature_delta", signature: "sig_xyz" }),
        evBlockStop(0),
        evBlockStart(1, { type: "text" }),
        evBlockDelta(1, { type: "text_delta", text: "answer" }),
        evBlockStop(1),
        evMessageDelta("end_turn"),
        evMessageStop(),
      ]),
      { budgetTokens: 2000 },
    );

    // Verify thinking enablement also reaches the streaming request body.
    const chunks: Array<{
      type: string;
      text?: string;
      block?: { signature?: string; thinking?: string };
    }> = [];
    for await (const chunk of provider.chatStream({
      model: "test",
      messages: [{ role: "user", content: "go" }],
      maxTokens: 4000,
    })) {
      chunks.push(
        chunk as {
          type: string;
          text?: string;
          block?: { signature?: string; thinking?: string };
        },
      );
    }

    const streamBody = mockClient.messages.stream?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(streamBody.thinking).toEqual({
      type: "enabled",
      budget_tokens: 2000,
    });

    // Two thinking deltas, in order, then the complete signed block.
    const thinkingDeltas = chunks.filter((c) => c.type === "thinking_delta");
    expect(thinkingDeltas.map((c) => c.text)).toEqual(["step 1 ", "step 2"]);

    const block = chunks.find((c) => c.type === "thinking_block");
    expect(block?.block?.thinking).toBe("step 1 step 2");
    expect(block?.block?.signature).toBe("sig_xyz");

    // thinking_block precedes the text_delta in emission order.
    expect(chunks.indexOf(block!)).toBeLessThan(chunks.findIndex((c) => c.type === "text_delta"));
  });

  it("withStructuredOutput() extracts structured data", async () => {
    const PersonSchema = z.object({ name: z.string(), age: z.number() });
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [
            {
              type: "tool_use",
              id: "tu_extract",
              name: "extract",
              input: { name: "Alice", age: 30 },
            },
          ],
          stop_reason: "tool_use",
        }),
      ),
    );

    const fn = provider.withStructuredOutput(PersonSchema);
    const result = await fn("Who is the person?");
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("prompt caching (default on): breakpoint on last system block and last message", async () => {
    const { provider, mockClient } = makeProvider();
    const messages = [{ role: "user" as const, content: "hi there" }];

    await provider.chat({
      model: "test",
      messages,
      system: [
        { type: "text", text: "base instructions" },
        { type: "text", text: "skill index" },
      ],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as {
      system: Array<{ text: string; cache_control?: { type: string } }>;
      messages: Array<{ content: unknown }>;
    };
    // Last system block carries the breakpoint (covers tools + system prefix);
    // earlier blocks stay unmarked.
    expect(body.system[0]?.cache_control).toBeUndefined();
    expect(body.system[1]?.cache_control).toEqual({ type: "ephemeral" });
    // String content is promoted to a text block so it can carry the marker.
    expect(body.messages[0]?.content).toEqual([
      { type: "text", text: "hi there", cache_control: { type: "ephemeral" } },
    ]);
    // The caller's request is NOT mutated.
    expect(messages[0]?.content).toBe("hi there");
  });

  it("prompt caching: block-array message gets the breakpoint on its last cacheable block", async () => {
    const { provider, mockClient } = makeProvider();
    const toolResultContent = [{ type: "tool_result" as const, tool_use_id: "tu_1", content: "ok", is_error: false }];

    await provider.chat({
      model: "test",
      messages: [
        { role: "assistant", content: [{ type: "tool_use", id: "tu_1", name: "ls", input: {} }] },
        { role: "user", content: toolResultContent },
      ],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as {
      messages: Array<{ content: Array<Record<string, unknown>> }>;
    };
    // Only the LAST message's last block is marked; earlier messages untouched.
    expect(body.messages[0]?.content[0]?.cache_control).toBeUndefined();
    expect(body.messages[1]?.content[0]?.cache_control).toEqual({ type: "ephemeral" });
    // Caller's block object is not mutated.
    expect((toolResultContent[0] as { cache_control?: unknown }).cache_control).toBeUndefined();
  });

  it("prompt caching: explicit cache_control is preserved and no auto breakpoints are added", async () => {
    const { provider, mockClient } = makeProvider();

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      system: [
        { type: "text", text: "pinned", cache_control: { type: "ephemeral" } },
        { type: "text", text: "volatile" },
      ],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as {
      system: Array<{ cache_control?: { type: string } }>;
      messages: Array<{ content: unknown }>;
    };
    // Explicit breakpoint passes through where the caller put it…
    expect(body.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    // …and the provider adds none of its own (caller owns placement).
    expect(body.system[1]?.cache_control).toBeUndefined();
    expect(body.messages[0]?.content).toBe("hi");
  });

  it("promptCaching: false strips cache_control from the wire request", async () => {
    const { provider, mockClient } = makeProvider(undefined, undefined, undefined, {
      promptCaching: false,
    });

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "hi" }],
      system: [{ type: "text", text: "pinned", cache_control: { type: "ephemeral" } }],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as {
      system: Array<{ cache_control?: unknown }>;
      messages: Array<{ content: unknown }>;
    };
    expect(body.system[0]?.cache_control).toBeUndefined();
    expect(body.messages[0]?.content).toBe("hi");
  });

  it("prompt caching: empty-text last message gets no breakpoint (API rejects it)", async () => {
    const { provider, mockClient } = makeProvider();

    await provider.chat({
      model: "test",
      messages: [{ role: "user", content: "" }],
      system: [{ type: "text", text: "base" }],
      maxTokens: 100,
    });

    const body = mockClient.messages.create.mock.calls[0]?.[0] as {
      system: Array<{ cache_control?: unknown }>;
      messages: Array<{ content: unknown }>;
    };
    expect(body.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(body.messages[0]?.content).toBe("");
  });

  it("prompt caching: streaming requests carry the same auto breakpoints", async () => {
    const { provider, mockClient } = makeProvider(
      undefined,
      makeStreamImpl([
        evMessageStart(),
        evBlockStart(0, { type: "text" }),
        evBlockDelta(0, { type: "text_delta", text: "ok" }),
        evBlockStop(0),
        evMessageDelta("end_turn"),
        evMessageStop(),
      ]),
    );

    for await (const _ of provider.chatStream({
      model: "test",
      messages: [{ role: "user", content: "go" }],
      system: [{ type: "text", text: "base" }],
      maxTokens: 100,
    })) {
      // drain
    }

    const body = mockClient.messages.stream?.mock.calls[0]?.[0] as {
      system: Array<{ cache_control?: { type: string } }>;
      messages: Array<{ content: unknown }>;
    };
    expect(body.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(body.messages[0]?.content).toEqual([{ type: "text", text: "go", cache_control: { type: "ephemeral" } }]);
  });

  it("withStructuredOutput() includeRaw returns { raw, parsed }", async () => {
    const Schema = z.object({ value: z.string() });
    const { provider } = makeProvider(() =>
      Promise.resolve(
        makeAnthropicMessage({
          content: [
            {
              type: "tool_use",
              id: "tu_extract",
              name: "extract",
              input: { value: "hello" },
            },
          ],
          stop_reason: "tool_use",
        }),
      ),
    );

    const fn = provider.withStructuredOutput(Schema, { includeRaw: true });
    const result = await fn("test");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    expect((result as { parsed: { value: string } }).parsed).toEqual({
      value: "hello",
    });
  });
});
