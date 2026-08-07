import { describe, expect, it } from "vitest";
import { StrictHitlHandler } from "../../src/hitl/handler.ts";
import type { ToolDescriptor } from "../../src/core/interfaces.ts";

function tool(name: string, sensitive: boolean): ToolDescriptor {
  return { name, description: name, inputSchema: { type: "object" }, source: "builtin", metadata: { sensitive } };
}

const req = { toolName: "x", input: {}, reason: "test", traceId: "t1" };

describe("StrictHitlHandler", () => {
  it("mode is strict", () => {
    expect(new StrictHitlHandler().mode).toBe("strict");
  });

  it("requires approval for all tools (sensitiveOnly defaults to false)", () => {
    const h = new StrictHitlHandler();
    expect(h.needsApproval(tool("ls", false))).toBe(true);
    expect(h.needsApproval(tool("write_file", true))).toBe(true);
  });

  it("sensitiveOnly=true: only sensitive tools require approval", () => {
    const h = new StrictHitlHandler(true);
    expect(h.needsApproval(tool("write_file", true))).toBe(true);
    expect(h.needsApproval(tool("ls", false))).toBe(false);
  });

  it("sensitiveOnly=true: tool with no metadata → not sensitive → no approval", () => {
    const h = new StrictHitlHandler(true);
    const noMeta: ToolDescriptor = { name: "x", description: "x", inputSchema: {}, source: "builtin" };
    expect(h.needsApproval(noMeta)).toBe(false);
  });

  it("resolver returns its result", async () => {
    const h = new StrictHitlHandler(false, { resolver: () => ({ decision: "reject", feedback: "denied" }) });
    const r = await h.requestApproval(req);
    expect(r.decision).toBe("reject");
    expect(r.feedback).toBe("denied");
  });

  it("result queue is consumed in order", async () => {
    const h = new StrictHitlHandler(false, {
      results: [{ decision: "approve" }, { decision: "reject", feedback: "no" }],
    });
    expect((await h.requestApproval(req)).decision).toBe("approve");
    expect((await h.requestApproval(req)).decision).toBe("reject");
  });

  it("auto-approves when neither resolver nor queue is provided (defensive)", async () => {
    const h = new StrictHitlHandler();
    const r = await h.requestApproval(req);
    expect(r.decision).toBe("approve");
  });
});
