import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";
import { FullAccessHandler, StrictHitlHandler } from "../../src/hitl/handler.ts";

const sensitiveDescriptor = {
  name: "write",
  description: "write",
  inputSchema: {},
  source: "builtin" as const,
  metadata: { sensitive: true },
};

describe("HITL integration (invoke)", () => {
  it("FullAccess: tool runs without approval", async () => {
    let ran = false;
    let n = 0;
    const { agent, registry } = buildTestAgent({
      hitl: new FullAccessHandler(),
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "write", {});
        return endTurnResponse("done");
      },
    });
    registry.add(sensitiveDescriptor, async () => {
      ran = true;
      return { content: "ok", isError: false };
    });
    await agent.invoke("test");
    expect(ran).toBe(true);
  });

  it("Strict + approve: tool runs", async () => {
    let ran = false;
    let n = 0;
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(false, { results: [{ decision: "approve" }] }),
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "write", {});
        return endTurnResponse("done");
      },
    });
    registry.add(sensitiveDescriptor, async () => {
      ran = true;
      return { content: "ok", isError: false };
    });
    await agent.invoke("test");
    expect(ran).toBe(true);
  });

  it("Strict + reject: tool does NOT run, model gets rejection feedback", async () => {
    let ran = false;
    let n = 0;
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(false, {
        results: [{ decision: "reject", feedback: "denied by policy" }],
      }),
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "write", {});
        return endTurnResponse("done");
      },
    });
    registry.add(sensitiveDescriptor, async () => {
      ran = true;
      return { content: "ok", isError: false };
    });
    const res = await agent.invoke("test");
    expect(ran).toBe(false);
    // tool_result message should contain the rejection feedback
    const toolResultMsg = res.messages.find((m) => m.role === "user" && Array.isArray(m.content));
    expect(toolResultMsg).toBeDefined();
    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const block = toolResultMsg.content.find((b) => "tool_use_id" in b) as
        | { is_error?: boolean; content: string }
        | undefined;
      expect(block?.is_error).toBe(true);
      expect(block?.content).toContain("denied by policy");
    }
  });
});
