import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type OpenAI from "openai";
import type { Response, ResponseCreateParams, ResponseStreamEvent } from "openai/resources/responses/responses";
import { OpenAIResponsesProvider } from "../../src/provider/openai_responses.ts";
import type { ChatRequest, ToolDescriptor } from "../../src/core/interfaces.ts";

function makeResponse(output: Response["output"], overrides: Partial<Response> = {}): Response {
  return {
    id: "resp_1",
    object: "response",
    created_at: 1,
    status: "completed",
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: 1024,
    model: "model",
    output,
    output_text: "",
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt_cache_key: null,
    prompt_cache_retention: null,
    reasoning: null,
    safety_identifier: null,
    service_tier: "default",
    store: false,
    temperature: 1,
    text: { format: { type: "text" }, verbosity: "medium" },
    tool_choice: "auto",
    tools: [],
    top_logprobs: 0,
    top_p: 1,
    truncation: "disabled",
    usage: {
      input_tokens: 12,
      input_tokens_details: { cached_tokens: 4 },
      output_tokens: 7,
      output_tokens_details: { reasoning_tokens: 3 },
      total_tokens: 19,
    },
    user: null,
    metadata: null,
    ...overrides,
  } as Response;
}

function makeClient(impl: (body: ResponseCreateParams) => unknown) {
  return {
    responses: { create: vi.fn(impl) },
  } as unknown as OpenAI & { responses: { create: ReturnType<typeof vi.fn> } };
}

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 1024,
    ...overrides,
  };
}

const localTools: ToolDescriptor[] = [
  {
    name: "lookup",
    description: "Look something up",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    source: "builtin",
  },
  {
    name: "apply_patch",
    description: "Apply a patch",
    inputSchema: { type: "string" },
    source: "builtin",
  },
];

describe("OpenAIResponsesProvider API", () => {
  it("is a protocol provider configured independently from the model vendor", () => {
    // Regression: Responses support was initially modeled as a DeepSeek-specific
    // provider, coupling a wire protocol to one model vendor.
    // Fixed by: OpenAIResponsesProvider accepts any model and compatible base URL.
    const provider = new OpenAIResponsesProvider({
      apiKey: "key",
      model: "any-model",
      baseURL: "https://compatible.example.test",
      _client: makeClient(() => makeResponse([])),
    });
    expect(provider.id).toBe("openai-responses");
  });

  it("maps common runtime fields and provider-specific defaults to a Responses request", async () => {
    const client = makeClient(() => makeResponse([]));
    const provider = new OpenAIResponsesProvider({
      apiKey: "key",
      model: "deepseek-v4-flash",
      reasoning: { effort: "high" },
      topP: 0.8,
      topLogprobs: 5,
      user: "user-1",
      customToolNames: ["apply_patch"],
      additionalTools: [{ type: "web_search" }],
      _client: client,
    });

    await provider.chat(
      request({
        system: [
          { type: "text", text: "base" },
          { type: "text", text: "rules", cache_control: { type: "ephemeral" } },
        ],
        temperature: 0.3,
        tools: localTools,
        toolChoice: "any",
      }),
    );

    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams;
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      instructions: "base\n\nrules",
      max_output_tokens: 1024,
      temperature: 0.3,
      top_p: 0.8,
      top_logprobs: 5,
      user: "user-1",
      reasoning: { effort: "high" },
      tool_choice: "required",
      stream: false,
      store: false,
    });
    expect(body.input).toContainEqual({ type: "message", role: "user", content: "hello" });
    expect(body.tools).toContainEqual(expect.objectContaining({ type: "function", name: "lookup" }));
    expect(body.tools).toContainEqual(expect.objectContaining({ type: "custom", name: "apply_patch" }));
    expect(body.tools).toContainEqual({ type: "web_search" });
  });

  it("uses opaque provider state to round-trip Responses-only items and custom tool kinds", async () => {
    const webSearch = { type: "web_search_call", id: "ws_1", status: "completed", action: { type: "search" } };
    const first = makeResponse([
      {
        type: "reasoning",
        id: "rs_1",
        content: [{ type: "reasoning_text", text: "think" }],
        summary: [],
      },
      { type: "function_call", call_id: "fc_1", name: "lookup", arguments: '{"query":"x"}', status: "completed" },
      { type: "custom_tool_call", call_id: "ct_1", name: "apply_patch", input: "*** Begin Patch" },
      webSearch,
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "done", annotations: [], logprobs: [] }],
      },
    ] as Response["output"]);
    const client = makeClient(() => first);
    const provider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: client });

    const result = await provider.chat(request());
    expect(result.stopReason).toBe("tool_use");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 7,
      cachedInputTokens: 4,
      reasoningTokens: 3,
    });
    expect(result.message.content).toEqual([
      { type: "thinking", thinking: "think", signature: "rs_1" },
      { type: "tool_use", id: "fc_1", name: "lookup", input: { query: "x" } },
      { type: "tool_use", id: "ct_1", name: "apply_patch", input: "*** Begin Patch" },
      { type: "text", text: "done" },
    ]);
    expect(result.message.providerState).toMatchObject({
      provider: "openai-responses",
      data: {
        toolKinds: { fc_1: "function", ct_1: "custom" },
        items: first.output,
      },
    });

    await provider.chat(
      request({
        messages: [
          result.message,
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "fc_1", content: "found" },
              { type: "tool_result", tool_use_id: "ct_1", content: "patched" },
            ],
          },
        ],
      }),
    );
    const next = client.responses.create.mock.calls[1]?.[0] as ResponseCreateParams;
    expect(next.input).toContainEqual({ type: "function_call_output", call_id: "fc_1", output: "found" });
    expect(next.input).toContainEqual({ type: "custom_tool_call_output", call_id: "ct_1", output: "patched" });
    expect(next.input).toContainEqual(webSearch);
  });

  it("maps semantic SSE events and carries provider state on the terminal chunk", async () => {
    const finalResponse = makeResponse([
      { type: "function_call", call_id: "fc_1", name: "lookup", arguments: '{"query":"x"}', status: "completed" },
    ] as Response["output"]);
    const events = [
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { type: "function_call", call_id: "fc_1", name: "lookup", arguments: "", status: "in_progress" },
      },
      { type: "response.reasoning_text.delta", item_id: "rs_1", output_index: 1, content_index: 0, delta: "think" },
      { type: "response.reasoning_text.done", item_id: "rs_1", output_index: 1, content_index: 0, text: "think" },
      {
        type: "response.output_text.delta",
        item_id: "msg_1",
        output_index: 2,
        content_index: 0,
        delta: "hello",
        logprobs: [],
      },
      { type: "response.function_call_arguments.done", item_id: "fc_1", output_index: 0, arguments: '{"query":"x"}' },
      { type: "response.completed", response: finalResponse },
    ] as ResponseStreamEvent[];
    const client = makeClient((body) => {
      if (!body.stream) return finalResponse;
      return (async function* () {
        for (const event of events) yield event;
      })();
    });
    const provider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: client });

    const chunks = [];
    for await (const chunk of provider.chatStream(request())) chunks.push(chunk);
    expect(chunks).toContainEqual({ type: "thinking_delta", text: "think" });
    expect(chunks).toContainEqual({
      type: "thinking_block",
      block: { type: "thinking", thinking: "think", signature: "rs_1" },
    });
    expect(chunks).toContainEqual({ type: "text_delta", text: "hello" });
    expect(chunks).toContainEqual({
      type: "tool_use",
      block: { type: "tool_use", id: "fc_1", name: "lookup", input: { query: "x" } },
    });
    expect(chunks.at(-1)).toMatchObject({
      type: "message_stop",
      stopReason: "tool_use",
      providerState: { provider: "openai-responses" },
    });
  });

  it("streams custom tool calls and maps incomplete and failed terminal events", async () => {
    // Regression: handling only function_call SSE events made DeepSeek's
    // Codex-compatible apply_patch custom tool disappear from streamed turns.
    // Fixed by: mapping custom_tool_call_input.done and all terminal event kinds.
    const customItem = {
      type: "custom_tool_call",
      id: "ct_item_1",
      call_id: "ct_1",
      name: "apply_patch",
      input: "*** Begin Patch",
    } as Response["output"][number];
    const incompleteResponse = makeResponse([customItem], {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    });
    const client = makeClient(() =>
      (async function* () {
        yield {
          type: "response.output_item.added",
          output_index: 0,
          item: customItem,
        } as ResponseStreamEvent;
        yield {
          type: "response.custom_tool_call_input.done",
          item_id: "ct_item_1",
          output_index: 0,
          input: "*** Begin Patch",
        } as ResponseStreamEvent;
        yield { type: "response.incomplete", response: incompleteResponse } as ResponseStreamEvent;
      })(),
    );
    const provider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: client });

    const chunks = [];
    for await (const chunk of provider.chatStream(request())) chunks.push(chunk);
    expect(chunks).toContainEqual({
      type: "tool_use",
      block: { type: "tool_use", id: "ct_1", name: "apply_patch", input: "*** Begin Patch" },
    });
    expect(chunks.at(-1)).toMatchObject({ type: "message_stop", stopReason: "max_tokens" });

    const failedResponse = makeResponse([], {
      status: "failed",
      error: { code: "server_error", message: "stream boom" },
    });
    const failedClient = makeClient(() =>
      (async function* () {
        yield { type: "response.failed", response: failedResponse } as ResponseStreamEvent;
      })(),
    );
    const failedProvider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: failedClient });
    await expect(async () => {
      for await (const chunk of failedProvider.chatStream(request())) {
        void chunk;
      }
    }).rejects.toThrow(/server_error.*stream boom/i);
  });

  it("uses Responses JSON Schema structured output", async () => {
    const client = makeClient(() =>
      makeResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: '{"ok":true}', annotations: [], logprobs: [] }],
        },
      ]),
    );
    const provider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: client });

    expect(await provider.withStructuredOutput(z.object({ ok: z.boolean() }))("return json")).toEqual({ ok: true });
    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams;
    expect(body.text?.format).toMatchObject({ type: "json_schema", name: "extract", strict: true });
  });

  it("supports function calling and JSON mode structured output", async () => {
    // Regression: the provider exposed the shared StructuredOutputOptions but
    // initially covered only one Responses extraction strategy.
    // Fixed by: mapping all interface methods to their native Responses forms.
    const functionClient = makeClient(() =>
      makeResponse([
        {
          type: "function_call",
          call_id: "fc_1",
          name: "result",
          arguments: '{"ok":true}',
          status: "completed",
        },
      ] as Response["output"]),
    );
    const functionProvider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: functionClient });
    expect(
      await functionProvider.withStructuredOutput(z.object({ ok: z.boolean() }), {
        method: "functionCalling",
        name: "result",
      })("return json"),
    ).toEqual({ ok: true });
    const functionBody = functionClient.responses.create.mock.calls[0]?.[0] as ResponseCreateParams;
    expect(functionBody.tool_choice).toEqual({ type: "function", name: "result" });

    const jsonClient = makeClient(() =>
      makeResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: '{"ok":true}', annotations: [], logprobs: [] }],
        },
      ]),
    );
    const jsonProvider = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: jsonClient });
    expect(
      await jsonProvider.withStructuredOutput(z.object({ ok: z.boolean() }), { method: "jsonMode" })("return json"),
    ).toEqual({ ok: true });
    const jsonBody = jsonClient.responses.create.mock.calls[0]?.[0] as ResponseCreateParams;
    expect(jsonBody.text?.format).toEqual({ type: "json_object" });
  });

  it("maps incomplete responses and surfaces failed responses", async () => {
    const incompleteClient = makeClient(() =>
      makeResponse([], { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
    );
    const incomplete = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: incompleteClient });
    expect((await incomplete.chat(request())).stopReason).toBe("max_tokens");

    const failedClient = makeClient(() =>
      makeResponse([], { status: "failed", error: { code: "server_error", message: "boom" } }),
    );
    const failed = new OpenAIResponsesProvider({ apiKey: "key", model: "m", _client: failedClient });
    await expect(failed.chat(request())).rejects.toThrow(/server_error.*boom/i);
  });
});
