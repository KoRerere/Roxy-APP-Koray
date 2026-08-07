import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";
import { chatResponse, thinkingBlock, toolUse } from "../helpers/makeFakeProvider.ts";
import { StrictHitlHandler } from "../../src/hitl/handler.ts";
import { todo_writeTool } from "../../src/tools/builtin/todo_write.ts";
import type { AgentStreamEvent, ContentBlock, ThinkingBlock } from "../../src/core/interfaces.ts";

async function collect(
  agent: { stream: (input: string) => AsyncIterable<AgentStreamEvent> },
  input: string,
): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const e of agent.stream(input)) events.push(e);
  return events;
}

describe("AgentImpl.stream", () => {
  it("pure text: events are text then done", async () => {
    const { agent } = buildTestAgent({ responses: [endTurnResponse("Hello!")] });
    const events = await collect(agent, "hi");
    expect(events[0]?.type).toBe("text");
    expect((events[0] as { type: "text"; delta: string }).delta).toBe("Hello!");
    expect(events.at(-1)?.type).toBe("done");
  });

  it("tool call: events include tool_call → tool_result → done", async () => {
    let n = 0;
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "echo", { text: "x" });
        return endTurnResponse("ok");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async (input) => ({
      content: (input as { text: string }).text,
      isError: false,
    }));
    const types = (await collect(agent, "test")).map((e) => e.type);
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types.at(-1)).toBe("done");
  });

  it("text and thinking events identify the model call that produced them", async () => {
    // Regression: all streamed text/thinking deltas looked identical across
    // the tool loop, so hosts merged separate LLM responses into one UI block.
    // Fixed by: every model delta carries the zero-based model call index.
    let modelCalls = 0;
    const { agent, registry } = buildTestAgent({
      handler: () => {
        modelCalls++;
        if (modelCalls === 1) {
          return chatResponse(
            {
              role: "assistant",
              content: [thinkingBlock("planning", "sig_call_0"), toolUse("id1", "echo", { text: "x" })],
            },
            "tool_use",
          );
        }
        return endTurnResponse("final");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async () => ({
      content: "ok",
      isError: false,
    }));

    const events = await collect(agent, "test");
    const thinking = events.find((event) => event.type === "thinking") as { callIndex?: number } | undefined;
    const toolCall = events.find((event) => event.type === "tool_call") as { callIndex?: number } | undefined;
    const finalText = events.find((event) => event.type === "text") as { callIndex?: number } | undefined;

    expect(thinking?.callIndex).toBe(0);
    expect(toolCall?.callIndex).toBe(0);
    expect(finalText?.callIndex).toBe(1);
  });

  it("todo_write emits the complete todo snapshot without a store", async () => {
    let modelCalls = 0;
    const todoTool = todo_writeTool();
    const { agent } = buildTestAgent({
      handler: () => {
        modelCalls++;
        if (modelCalls === 1) {
          return toolCallResponse("todo-1", "todo_write", {
            todos: [{ content: "Inspect page", status: "in_progress" }],
          });
        }
        return endTurnResponse("done");
      },
      tools: [todoTool],
    });

    const events = await collect(agent, "test");
    expect(events).toContainEqual({
      type: "todo_updated",
      todos: [{ content: "Inspect page", status: "in_progress" }],
    });
    expect(events.findIndex((event) => event.type === "todo_updated")).toBeLessThan(
      events.findIndex((event) => event.type === "tool_result"),
    );
  });

  it("unknown tool: no tool_result emitted, stream ends after one model call", async () => {
    // Regression: when the model returns stop_reason=tool_use for a tool
    // not in our registry (e.g. provider-internal tools like DeepSeek built-ins),
    // the old code would send a tool_result "tool not found" back, which the
    // provider would reject with a 400 ("tool_result without matching tool_use").
    // Fixed: strip unresolvable tool_use blocks, treat response as end_turn.
    let modelCalls = 0;
    const { agent } = buildTestAgent({
      handler: () => {
        modelCalls++;
        if (modelCalls === 1) return toolCallResponse("id1", "provider_internal_tool", {});
        return endTurnResponse("second call should never happen");
      },
    });
    // no registry.add — "provider_internal_tool" is NOT registered

    const events = await collect(agent, "hi");
    const types = events.map((e) => e.type);

    // tool_call IS yielded (from streaming the chunk before we know it's unresolvable)
    expect(types).toContain("tool_call");
    // but NO tool_result follows — we do not send back "tool not found"
    expect(types).not.toContain("tool_result");
    // stream still ends cleanly
    expect(types.at(-1)).toBe("done");
    // only one model call — the loop does not retry
    expect(modelCalls).toBe(1);
  });

  it("hitl_pending emitted, tool runs after resume(approve)", async () => {
    let n = 0;
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(),
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "sensitive", {});
        return endTurnResponse("done");
      },
    });
    registry.add(
      {
        name: "sensitive",
        description: "s",
        inputSchema: {},
        source: "builtin",
        metadata: { sensitive: true },
      },
      async () => ({ content: "ran", isError: false }),
    );

    const events: AgentStreamEvent[] = [];
    for await (const e of agent.stream("test")) {
      events.push(e);
      if (e.type === "hitl_pending") {
        agent.resume(e.pending.traceId, { decision: "approve" });
      }
    }

    const types = events.map((e) => e.type);
    expect(types).toContain("hitl_pending");
    expect(types).toContain("tool_result");
    expect(types.at(-1)).toBe("done");
  });

  it("hitl_pending + reject: tool_result carries rejection feedback", async () => {
    let n = 0;
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(),
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "sensitive", {});
        return endTurnResponse("done");
      },
    });
    registry.add(
      { name: "sensitive", description: "s", inputSchema: {}, source: "builtin", metadata: { sensitive: true } },
      async () => ({ content: "ran", isError: false }),
    );

    const events: AgentStreamEvent[] = [];
    for await (const e of agent.stream("test")) {
      events.push(e);
      if (e.type === "hitl_pending") {
        agent.resume(e.pending.traceId, { decision: "reject", feedback: "not allowed" });
      }
    }

    const toolResultEvt = events.find((e) => e.type === "tool_result");
    expect(toolResultEvt).toBeDefined();
    if (toolResultEvt?.type === "tool_result") {
      expect(toolResultEvt.result.isError).toBe(true);
      expect(toolResultEvt.result.content).toContain("not allowed");
    }
  });

  it("thinking + tool call: emits thinking delta, then tool_call → tool_result → done", async () => {
    let n = 0;
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) {
          return chatResponse(
            {
              role: "assistant",
              content: [thinkingBlock("planning the echo", "sig_T"), toolUse("tu1", "echo", { text: "x" })],
            },
            "tool_use",
          );
        }
        return endTurnResponse("ok");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async (input) => ({
      content: (input as { text: string }).text,
      isError: false,
    }));

    const events = await collect(agent, "test");
    const types = events.map((e) => e.type);

    // thinking delta is surfaced as a stream event, before tool_call.
    const thinkingEvt = events.find((e) => e.type === "thinking");
    expect(thinkingEvt).toBeDefined();
    expect((thinkingEvt as { delta?: string }).delta).toBe("planning the echo");
    expect(types.indexOf("thinking")).toBeLessThan(types.indexOf("tool_call"));
    expect(types).toContain("tool_result");
    expect(types.at(-1)).toBe("done");
  });

  // Regression: with extended thinking enabled, Anthropic requires the
  // assistant's thinking block (carrying its signature) to be round-tripped
  // back in the request messages on subsequent turns — alongside the matching
  // tool_result — or the next call 400s. The loop must preserve thinking
  // blocks in stored history when the turn uses tools.
  it("thinking + tool call: thinking block (with signature) is round-tripped into the next request", async () => {
    let n = 0;
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) {
          return chatResponse(
            {
              role: "assistant",
              content: [thinkingBlock("reasoning here", "sig_ROUNDTRIP"), toolUse("tu1", "echo", { text: "x" })],
            },
            "tool_use",
          );
        }
        return endTurnResponse("final");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async (input) => ({
      content: (input as { text: string }).text,
      isError: false,
    }));

    await collect(agent, "test");

    // Second model call carries the prior assistant turn, including the
    // signed thinking block, followed by the tool_result user message.
    expect(provider.calls.length).toBeGreaterThanOrEqual(2);
    const secondReqMessages = provider.calls[1].messages;
    const assistantTurn = secondReqMessages.find((m) => m.role === "assistant" && Array.isArray(m.content));
    expect(assistantTurn).toBeDefined();
    const blocks = (assistantTurn!.content as ContentBlock[]).filter((b): b is ThinkingBlock => b.type === "thinking");
    expect(blocks.length).toBe(1);
    expect(blocks[0].signature).toBe("sig_ROUNDTRIP");
    expect(blocks[0].thinking).toBe("reasoning here");
  });

  it("provider-owned turn state is round-tripped into the next streamed request", async () => {
    // Regression: the stream loop reconstructed canonical content but discarded
    // Responses-only items, so stateless providers lost reasoning/server-tool state.
    // Fixed by: carrying message_stop.providerState onto the stored assistant turn.
    const providerState = {
      provider: "openai-responses",
      data: {
        items: [{ type: "web_search_call", id: "ws_1", status: "completed" }],
        toolKinds: { tu1: "function" },
      },
    };
    let n = 0;
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) {
          return chatResponse(
            {
              role: "assistant",
              content: [toolUse("tu1", "echo", { text: "x" })],
              providerState,
            },
            "tool_use",
          );
        }
        return endTurnResponse("done");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async () => ({
      content: "ok",
      isError: false,
    }));

    await collect(agent, "test");

    const assistantTurn = provider.calls[1]!.messages.find((message) => message.role === "assistant");
    expect(assistantTurn?.providerState).toEqual(providerState);
  });
});
