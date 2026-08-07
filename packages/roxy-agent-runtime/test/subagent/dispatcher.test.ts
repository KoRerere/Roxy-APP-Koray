import { describe, expect, it } from "vitest";
import { SubAgentDispatcher } from "../../src/subagent/dispatcher.ts";
import { SubAgentRegistry } from "../../src/subagent/registry.ts";
import type { Agent, AgentResponse, SubAgentSpec } from "../../src/core/interfaces.ts";

const spec = (name: string): SubAgentSpec => ({
  name,
  description: `the ${name} subagent`,
  systemPrompt: `You are ${name}.`,
});

/** Minimal fake Agent recording invoke() calls and dispose(). */
function fakeAgent(sessionId: string) {
  const invokes: string[] = [];
  let disposed = false;
  const agent: Agent = {
    id: `agent-${sessionId}`,
    sessionId,
    async invoke(input): Promise<AgentResponse> {
      invokes.push(typeof input === "string" ? input : "[blocks]");
      return {
        messages: [{ role: "assistant", content: `done: ${input}` }],
        trajectory: [],
      };
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
    async dispose() {
      disposed = true;
    },
  };
  return {
    agent,
    invokes,
    get disposed() {
      return disposed;
    },
  };
}

describe("SubAgentDispatcher", () => {
  it("run() builds the child once and reuses it across calls (auto-continue)", async () => {
    const built: Array<ReturnType<typeof fakeAgent>> = [];
    const registry = new SubAgentRegistry([spec("coder")]);
    const dispatcher = new SubAgentDispatcher(
      registry,
      async (_s, sid) => {
        const f = fakeAgent(sid);
        built.push(f);
        return f.agent;
      },
      "parent-1",
    );

    await dispatcher.run("coder", "task a");
    await dispatcher.run("coder", "task b");

    expect(built.length).toBe(1);
    expect(built[0]!.invokes).toEqual(["task a", "task b"]);
  });

  it("derives a stable child sessionId from parent + name", async () => {
    let seen = "";
    const registry = new SubAgentRegistry([spec("coder")]);
    const dispatcher = new SubAgentDispatcher(
      registry,
      async (_s, sid) => {
        seen = sid;
        return fakeAgent(sid).agent;
      },
      "parent-1",
    );
    await dispatcher.run("coder", "x");
    expect(seen).toBe("parent-1:sub:coder");
  });

  it("returns the child's AgentResponse", async () => {
    const registry = new SubAgentRegistry([spec("coder")]);
    const dispatcher = new SubAgentDispatcher(registry, async (_s, sid) => fakeAgent(sid).agent, "p");
    const resp = await dispatcher.run("coder", "hello");
    expect(resp.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "done: hello",
    });
  });

  it("throws on unknown subagent name", async () => {
    const registry = new SubAgentRegistry([spec("coder")]);
    const dispatcher = new SubAgentDispatcher(registry, async (_s, sid) => fakeAgent(sid).agent, "p");
    await expect(dispatcher.run("ghost", "x")).rejects.toThrow(/ghost|unknown/i);
  });

  it("onDelegate fires once per name on first build, with the derived child sessionId", async () => {
    const calls: Array<[string, string]> = [];
    const registry = new SubAgentRegistry([spec("coder")]);
    const dispatcher = new SubAgentDispatcher(registry, async (_s, sid) => fakeAgent(sid).agent, "parent-1", {
      onDelegate: (name, sid) => void calls.push([name, sid]),
    });
    await dispatcher.run("coder", "a");
    await dispatcher.run("coder", "b"); // reuse — no second onDelegate
    expect(calls).toEqual([["coder", "parent-1:sub:coder"]]);
  });

  it("disposeAll() disposes every built child", async () => {
    const built: Array<ReturnType<typeof fakeAgent>> = [];
    const registry = new SubAgentRegistry([spec("a"), spec("b")]);
    const dispatcher = new SubAgentDispatcher(
      registry,
      async (_s, sid) => {
        const f = fakeAgent(sid);
        built.push(f);
        return f.agent;
      },
      "p",
    );
    await dispatcher.run("a", "1");
    await dispatcher.run("b", "2");
    await dispatcher.disposeAll();
    expect(built.map((f) => f.disposed)).toEqual([true, true]);
  });
});
