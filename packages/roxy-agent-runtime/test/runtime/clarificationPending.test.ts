import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, chatResponse } from "../helpers/buildTestAgent.ts";
import { SuspendingClarificationHandler } from "../../src/clarification/handler.ts";
import { ask_userTool } from "../../src/tools/builtin/ask_user.ts";
import type {
  AgentStreamEvent,
  ChatRequest,
  ChatResponse,
  ContentBlock,
  PendingClarification,
} from "../../src/core/interfaces.ts";

/** A scripted turn that calls ask_user, then ends echoing the tool result. */
function askUserThenEcho() {
  let call = 0;
  return (req: ChatRequest): ChatResponse => {
    call++;
    if (call === 1) {
      return chatResponse(
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "tu_ask", name: "ask_user", input: { question: "Which env?" } }],
        },
        "tool_use",
      );
    }
    // Echo back what the tool_result carried so the test can assert it.
    const last = req.messages[req.messages.length - 1];
    const blocks = Array.isArray(last?.content) ? (last!.content as ContentBlock[]) : [];
    const tr = blocks.find((b) => b.type === "tool_result") as { content?: unknown } | undefined;
    return endTurnResponse(`answer was: ${String(tr?.content ?? "")}`);
  };
}

function buildClarifyingAgent() {
  const clarification = new SuspendingClarificationHandler();
  const built = buildTestAgent({
    handler: askUserThenEcho(),
    clarification,
    tools: [ask_userTool(clarification)],
  });
  return { ...built, clarification };
}

describe("clarification_pending stream flow", () => {
  it("stream() emits clarification_pending while ask_user parks; resume feeds the answer back", async () => {
    const { agent } = buildClarifyingAgent();

    const events: AgentStreamEvent[] = [];
    let finalText = "";
    for await (const event of agent.stream("deploy it")) {
      events.push(event);
      if (event.type === "clarification_pending") {
        expect(event.pending.request.question).toBe("Which env?");
        event.pending.resume({ answer: "staging" });
      }
      if (event.type === "text") finalText += event.delta;
    }

    expect(events.some((e) => e.type === "clarification_pending")).toBe(true);
    expect(finalText).toContain("answer was: staging");
  });

  it("agent.clarify(traceId, …) resolves the parked request too", async () => {
    const { agent } = buildClarifyingAgent();

    let finalText = "";
    for await (const event of agent.stream("deploy it")) {
      if (event.type === "clarification_pending") {
        agent.clarify(event.pending.traceId, { answer: "production" });
      }
      if (event.type === "text") finalText += event.delta;
    }
    expect(finalText).toContain("answer was: production");
  });

  it("invoke() parks until an external clarify() call resolves it", async () => {
    const { agent, clarification } = buildClarifyingAgent();

    // Simulate an out-of-band UI (HTTP endpoint, websocket…) answering.
    // Chain onto the agent's own onPending wiring so both fire.
    const pendingSeen = new Promise<PendingClarification>((resolve) => {
      const prev = clarification.onPending;
      clarification.onPending = (p) => {
        prev?.(p);
        resolve(p);
      };
    });
    const invokePromise = agent.invoke("deploy it");
    const pending = await pendingSeen;
    agent.clarify(pending.traceId, { answer: "dev" });

    const res = await invokePromise;
    const lastMsg = res.messages[res.messages.length - 1];
    expect(String(lastMsg?.content)).toContain("answer was: dev");
  });

  it("cancelPending() releases a parked clarification without disposing the agent", async () => {
    // Regression: stopping a host-side task while ask_user was parked had no
    // framework API to release the pending promise, leaving the run hung.
    // Fixed by: Agent.cancelPending() resolves all pending interaction waits.
    const { agent, clarification } = buildClarifyingAgent();
    const pendingSeen = new Promise<PendingClarification>((resolve) => {
      const previous = clarification.onPending;
      clarification.onPending = (pending) => {
        previous?.(pending);
        resolve(pending);
      };
    });

    const invokePromise = agent.invoke("deploy it");
    await pendingSeen;
    agent.cancelPending("Run stopped by host");

    await expect(invokePromise).resolves.toBeDefined();
    await agent.dispose();
  });
});
