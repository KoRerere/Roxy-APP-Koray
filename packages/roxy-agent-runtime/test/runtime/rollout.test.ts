import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, chatResponse } from "../helpers/buildTestAgent.ts";
import { JsonlSessionStore } from "../../src/memory/session_store.ts";
import { InMemoryProvider } from "../../src/memory/memory.ts";
import { replayIntoMemory } from "../../src/memory/replay.ts";
import type { AgentStreamEvent, RolloutEvent } from "../../src/core/interfaces.ts";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "roxy-test-rollout-"));
}

/** Collect every stream event from a streamed turn. */
async function streamTurn(agent: { stream(input: string): AsyncIterable<AgentStreamEvent> }, input: string) {
  const events: AgentStreamEvent[] = [];
  for await (const e of agent.stream(input)) events.push(e);
  return events;
}

describe("agent loop rollout double-write", () => {
  it("appends user_input + assistant_turn (+tool_result) events during a tool turn", async () => {
    const dir = tmpDir();
    const store = new JsonlSessionStore({ dir });
    let n = 0;
    const { agent, registry } = buildTestAgent({
      sessionId: "rollout-sid",
      sessionStore: store,
      handler: () => {
        n++;
        if (n === 1) {
          return chatResponse(
            {
              role: "assistant",
              content: [
                { type: "thinking", thinking: "p", signature: "s" },
                { type: "tool_use", id: "tu1", name: "echo", input: { x: 1 } },
              ],
            },
            "tool_use",
          );
        }
        return endTurnResponse("done");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async (input) => ({
      content: (input as { x: number }).x.toString(),
      isError: false,
    }));

    await streamTurn(agent, "hello");

    const events: RolloutEvent[] = await store.read("rollout-sid");
    const types = events.map((e) => e.type);

    expect(types).toContain("user_input");
    expect(types).toContain("assistant_turn");
    expect(types).toContain("tool_result");

    const turns = events.filter((e) => e.type === "assistant_turn");
    expect(turns.length).toBe(2);
    const toolTurn = turns[0] as Extract<RolloutEvent, { type: "assistant_turn" }>;
    expect(toolTurn.stopReason).toBe("tool_use");
    expect(toolTurn.message.content).toEqual([
      { type: "thinking", thinking: "p", signature: "s" } as never,
      { type: "tool_use", id: "tu1", name: "echo", input: { x: 1 } } as never,
    ]);
    const endTurn = turns[1] as Extract<RolloutEvent, { type: "assistant_turn" }>;
    expect(endTurn.stopReason).toBe("end_turn");

    const toolResultEvt = events.find((e) => e.type === "tool_result") as Extract<
      RolloutEvent,
      { type: "tool_result" }
    >;
    expect(toolResultEvt.result.tool_use_id).toBe("tu1");
  });
});

// Regression: a resumed session must rebuild in-memory history from its rollout
// so the next turn carries prior context. This is the cross-process resume path.
describe("cross-process session resume", () => {
  it("replaying a saved rollout rebuilds memory with full first-turn exchanges", async () => {
    const dir = tmpDir();
    const store = new JsonlSessionStore({ dir });
    const { agent, registry } = buildTestAgent({
      sessionId: "resume-sid",
      sessionStore: store,
      handler: () => endTurnResponse("first answer"),
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async () => ({
      content: "ok",
      isError: false,
    }));

    // First process: one turn.
    await streamTurn(agent, "first question");

    // Second "process": new memory, same store dir, same sessionId.
    const memory2 = new InMemoryProvider();
    const store2 = new JsonlSessionStore({ dir });
    const replayed = await replayIntoMemory(store2, memory2, "resume-sid");
    expect(replayed.isNew).toBe(false);
    expect(replayed.eventCount).toBeGreaterThan(0);

    // Rebuilt memory contains the first-turn exchanges (user then assistant),
    // i.e. the durable truth the next process resumes from.
    const rebuilt = await memory2.getAll("resume-sid");
    const toText = (m: { content: string | unknown[] }): string => (typeof m.content === "string" ? m.content : "");
    expect(rebuilt.map(toText)).toEqual(["first question", ""]);
    // assistant turn replays as a block array — verify the text block survives.
    const assistantContent = rebuilt[1]!.content as { type: string; text?: string }[];
    expect(assistantContent[0]).toMatchObject({ type: "text", text: "first answer" });
  });

  it("replays provider-owned state after JSONL serialization", async () => {
    // Regression: a process resume rebuilt only canonical message content and
    // silently lost opaque Responses items required by the next stateless call.
    // Fixed by: persisting providerState as part of each assistant message.
    const dir = tmpDir();
    const store = new JsonlSessionStore({ dir });
    const providerState = {
      provider: "openai-responses",
      data: {
        items: [{ type: "reasoning", id: "rs_1", content: [], summary: [] }],
        toolKinds: {},
      },
    };
    const { agent } = buildTestAgent({
      sessionId: "provider-state-sid",
      sessionStore: store,
      handler: () =>
        chatResponse(
          {
            role: "assistant",
            content: [{ type: "text", text: "answer" }],
            providerState,
          },
          "end_turn",
        ),
    });

    await streamTurn(agent, "question");

    const memory = new InMemoryProvider();
    await replayIntoMemory(new JsonlSessionStore({ dir }), memory, "provider-state-sid");
    const assistant = (await memory.getAll("provider-state-sid")).find((message) => message.role === "assistant");
    expect(assistant?.providerState).toEqual(providerState);
  });
});
