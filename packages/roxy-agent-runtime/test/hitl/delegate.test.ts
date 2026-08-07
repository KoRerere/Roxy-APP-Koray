import { describe, expect, it } from "vitest";
import { DelegateHitlHandler } from "../../src/hitl/handler.ts";
import type { ToolDescriptor } from "../../src/core/interfaces.ts";

function tool(name: string, sensitive: boolean): ToolDescriptor {
  return { name, description: name, inputSchema: { type: "object" }, source: "builtin", metadata: { sensitive } };
}

describe("DelegateHitlHandler", () => {
  it("mode is delegate", () => {
    expect(new DelegateHitlHandler().mode).toBe("delegate");
  });

  it("sensitive tool requires approval regardless of rules", () => {
    const h = new DelegateHitlHandler();
    expect(h.needsApproval(tool("write_file", true))).toBe(true);
  });

  it("non-sensitive tool with no matching rules does NOT require approval", () => {
    const h = new DelegateHitlHandler();
    expect(h.needsApproval(tool("ls", false))).toBe(false);
  });

  it("glob rule sensitive:true marks matched tool as requiring approval", () => {
    const h = new DelegateHitlHandler([{ match: "write_*", sensitive: true }]);
    expect(h.needsApproval(tool("write_file", false))).toBe(true);
    expect(h.needsApproval(tool("write_notes", false))).toBe(true);
  });

  it("glob rule sensitive:false exempts even metadata-sensitive tools", () => {
    const h = new DelegateHitlHandler([{ match: "ls", sensitive: false }]);
    // Override: the rule explicitly marks ls as NOT requiring approval
    expect(h.needsApproval(tool("ls", true))).toBe(false);
  });

  it("unmatched non-sensitive tool is not flagged", () => {
    const h = new DelegateHitlHandler([{ match: "execute", sensitive: true }]);
    expect(h.needsApproval(tool("ls", false))).toBe(false);
  });

  it("exact name rule matches only that tool", () => {
    const h = new DelegateHitlHandler([{ match: "execute", sensitive: true }]);
    expect(h.needsApproval(tool("execute", false))).toBe(true);
    expect(h.needsApproval(tool("execute_bg", false))).toBe(false);
  });

  it("resolver-based approval works", async () => {
    const h = new DelegateHitlHandler([], {
      resolver: (req) =>
        req.toolName === "execute" ? { decision: "reject", feedback: "no shell" } : { decision: "approve" },
    });
    const r = await h.requestApproval({ toolName: "execute", input: {}, reason: "r", traceId: "t" });
    expect(r.decision).toBe("reject");
    expect(r.feedback).toBe("no shell");
  });
});
