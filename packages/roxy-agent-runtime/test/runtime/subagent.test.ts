import { describe, expect, it } from "vitest";
import type { AgentResponse } from "../../src/core/interfaces.ts";
import { SubAgentManager } from "../../src/subagent/manager.ts";

function makeResponse(text: string): AgentResponse {
  return {
    messages: [{ role: "assistant", content: text }],
    trajectory: [],
  };
}

describe("SubAgentManager.delegate", () => {
  it("parallel(count=2) — runs factory twice concurrently and returns 2 responses", async () => {
    const invocations: string[] = [];
    const manager = new SubAgentManager(async (task) => {
      invocations.push(task);
      return makeResponse(`response to: ${task}`);
    });
    const results = await manager.delegate("do something", { mode: "parallel", count: 2 });
    expect(results).toHaveLength(2);
    expect(invocations).toHaveLength(2);
    expect(invocations.every((t) => t === "do something")).toBe(true);
  });

  it("parallel(count=1) — runs factory once", async () => {
    const manager = new SubAgentManager(async (task) => makeResponse(`result: ${task}`));
    const results = await manager.delegate("task", { mode: "parallel", count: 1 });
    expect(results).toHaveLength(1);
  });

  it("sequential — first output becomes second input", async () => {
    const received: string[] = [];
    const manager = new SubAgentManager(
      async (task) => {
        received.push(task);
        return makeResponse(`refined: ${task}`);
      },
      2, // 2 stages
    );
    await manager.delegate("initial task", { mode: "sequential" });
    expect(received[0]).toBe("initial task");
    expect(received[1]).toBe("refined: initial task"); // stage 1 output fed to stage 2
  });

  it("sequential returns responses for all stages", async () => {
    const manager = new SubAgentManager(async (task) => makeResponse(`out: ${task}`), 2);
    const results = await manager.delegate("start", { mode: "sequential" });
    expect(results).toHaveLength(2);
  });

  it("parallel results contain messages from each sub-invocation", async () => {
    const manager = new SubAgentManager(async (_task, idx) => makeResponse(`agent-${idx}`));
    const results = await manager.delegate("task", { mode: "parallel", count: 3 });
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.messages).toHaveLength(1);
    }
  });
});
