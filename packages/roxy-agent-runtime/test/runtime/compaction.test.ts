import { describe, expect, it, vi } from "vitest";
import { buildTestAgent, chatResponse, endTurnResponse } from "../helpers/buildTestAgent.ts";
import type { ChatResponse } from "../../src/core/interfaces.ts";

/** An end_turn response reporting the given REAL input token usage. */
function endTurnWithUsage(text: string, inputTokens: number): ChatResponse {
  return {
    ...chatResponse({ role: "assistant", content: text }, "end_turn"),
    usage: { inputTokens, outputTokens: 10 },
  };
}

// The compaction trigger must use the REAL context size reported by the API
// (`usage.input_tokens` of the most recent call), not the chars/4 heuristic —
// code-heavy histories blow past the heuristic long before it reaches the
// threshold.
describe("compaction trigger uses real usage", () => {
  it("invoke(): trims on the next call after usage exceeded triggerTokens", async () => {
    const { agent, memory } = buildTestAgent({
      // Tiny text (heuristic ≈ 0 tokens), but the API reports 5000 real
      // input tokens — only the real signal can arm the trigger.
      handler: () => endTurnWithUsage("ok", 5000),
      trimPolicy: { mode: "turns", keep: 1 },
      triggerTokens: 1000,
    });
    const trimSpy = vi.spyOn(memory, "trim");

    await agent.invoke("first");
    // No usage observed before the first call — heuristic says tiny → no trim.
    expect(trimSpy).not.toHaveBeenCalled();

    await agent.invoke("second");
    // Previous call reported 5000 > 1000 → trim fires before the model call.
    expect(trimSpy).toHaveBeenCalledTimes(1);
  });

  it("invoke(): stays on the heuristic when usage is below the threshold", async () => {
    const { agent, memory } = buildTestAgent({
      handler: () => endTurnWithUsage("ok", 50),
      trimPolicy: { mode: "turns", keep: 1 },
      triggerTokens: 1000,
    });
    const trimSpy = vi.spyOn(memory, "trim");

    await agent.invoke("first");
    await agent.invoke("second");
    expect(trimSpy).not.toHaveBeenCalled();
  });

  it("stream(): usage from a prior stream call arms the trigger the same way", async () => {
    const { agent, memory } = buildTestAgent({
      handler: () => endTurnWithUsage("ok", 5000),
      trimPolicy: { mode: "turns", keep: 1 },
      triggerTokens: 1000,
    });
    const trimSpy = vi.spyOn(memory, "trim");

    for await (const _ of agent.stream("first")) {
      // drain
    }
    expect(trimSpy).not.toHaveBeenCalled();

    for await (const _ of agent.stream("second")) {
      // drain
    }
    expect(trimSpy).toHaveBeenCalledTimes(1);
  });

  it("resets the usage signal after trimming so a stale value cannot re-trigger", async () => {
    let inputTokens = 5000;
    const { agent, memory } = buildTestAgent({
      handler: () => {
        // After compaction the context is small again — the API reports so.
        const res = endTurnWithUsage("ok", inputTokens);
        inputTokens = 50;
        return res;
      },
      trimPolicy: { mode: "turns", keep: 1 },
      triggerTokens: 1000,
    });
    const trimSpy = vi.spyOn(memory, "trim");

    await agent.invoke("first"); // reports 5000
    await agent.invoke("second"); // trims, then reports 50
    await agent.invoke("third"); // must NOT trim again off the stale 5000
    expect(trimSpy).toHaveBeenCalledTimes(1);
  });
});

describe("compaction trigger falls back to provider.countTokens", () => {
  it("uses the provider estimate when no usage has been observed yet", async () => {
    const { agent, memory } = buildTestAgent({
      responses: [endTurnResponse("ok")],
      trimPolicy: { mode: "turns", keep: 1 },
      triggerTokens: 1000,
    });
    // Pre-seed a history whose ESTIMATE exceeds the threshold (fresh agent,
    // e.g. resumed session — no usage signal yet).
    const big = "x".repeat(8000); // ≈ 2000 tokens by the chars/4 heuristic
    await memory.append(agent.sessionId, { role: "user", content: big });
    await memory.append(agent.sessionId, { role: "assistant", content: big });
    const trimSpy = vi.spyOn(memory, "trim");

    await agent.invoke("go");
    expect(trimSpy).toHaveBeenCalledTimes(1);
  });
});
