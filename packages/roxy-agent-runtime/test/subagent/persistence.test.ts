import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlSessionStore } from "../../src/memory/session_store.ts";
import { InMemoryProvider } from "../../src/memory/memory.ts";
import { replayIntoMemory } from "../../src/memory/replay.ts";
import { SubAgentDispatcher } from "../../src/subagent/dispatcher.ts";
import { SubAgentRegistry } from "../../src/subagent/registry.ts";
import type { Agent, AgentResponse } from "../../src/core/interfaces.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "roxy-sub-"));

function fakeAgent(sessionId: string): Agent {
  return {
    id: `agent-${sessionId}`,
    sessionId,
    async invoke(): Promise<AgentResponse> {
      return { messages: [{ role: "assistant", content: "ok" }], trajectory: [] };
    },
    async *stream() {},
    structured<T>() {
      return {
        async invoke(): Promise<T> {
          throw new Error("fakeAgent.structured is not used in this test");
        },
      };
    },
    async delegate() {
      return [];
    },
    resume() {},
    clarify() {},
    cancelPending() {},
    async dispose() {},
  };
}

describe("subagent persistence & linking", () => {
  it("replay ignores subagent_delegated link events", async () => {
    const store = new JsonlSessionStore({ dir: tmp() });
    const sid = "parent-1";
    await store.append(sid, { type: "session_start", sessionId: sid, createdAt: 1 });
    await store.append(sid, { type: "user_input", message: { role: "user", content: "hi" } });
    await store.append(sid, {
      type: "subagent_delegated",
      childSessionId: "parent-1:sub:coder",
      name: "coder",
      ts: 2,
    });
    await store.append(sid, {
      type: "assistant_turn",
      message: { role: "assistant", content: "hello" },
      stopReason: "end_turn",
    });

    const mem = new InMemoryProvider();
    await replayIntoMemory(store, mem, sid);
    const msgs = await mem.getAll(sid);
    // The link event contributes NO message to the reconstructed history.
    expect(msgs.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  it("a child session persists and resumes with full history (restart simulation)", async () => {
    const dir = tmp();
    const childSid = "parent-1:sub:coder";
    const store = new JsonlSessionStore({ dir });
    await store.append(childSid, { type: "session_start", sessionId: childSid, createdAt: 1 });
    await store.append(childSid, {
      type: "user_input",
      message: { role: "user", content: "write parser" },
    });
    await store.append(childSid, {
      type: "assistant_turn",
      message: { role: "assistant", content: "parser v1" },
      stopReason: "end_turn",
    });

    // New process: fresh store + memory, replay by the SAME derived child id.
    const store2 = new JsonlSessionStore({ dir });
    const mem = new InMemoryProvider();
    const res = await replayIntoMemory(store2, mem, childSid);
    expect(res.isNew).toBe(false);
    const msgs = await mem.getAll(childSid);
    expect(msgs.map((m) => m.content)).toEqual(["write parser", "parser v1"]);
  });

  it("dispatcher onDelegate persists a parent→child link into the parent rollout", async () => {
    const store = new JsonlSessionStore({ dir: tmp() });
    const parentSid = "parent-1";
    const registry = new SubAgentRegistry([{ name: "coder", description: "writes code", systemPrompt: "" }]);
    const dispatcher = new SubAgentDispatcher(registry, async (_s, sid) => fakeAgent(sid), parentSid, {
      onDelegate: async (name, childSessionId) => {
        await store.append(parentSid, {
          type: "subagent_delegated",
          childSessionId,
          name,
          ts: 1,
        });
      },
    });

    await dispatcher.run("coder", "x");
    const events = await store.read(parentSid);
    expect(events).toContainEqual({
      type: "subagent_delegated",
      childSessionId: "parent-1:sub:coder",
      name: "coder",
      ts: 1,
    });
  });
});
