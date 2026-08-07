/**
 * "Yes, and don't ask again" — remember rule tests.
 *
 * When ApprovalResult carries a `remember` field, the interceptor must
 * call handler.addRule() so that subsequent calls to the same tool/command
 * bypass HITL entirely.
 */
import { describe, it, expect, vi } from "vitest";
import { HitlInterceptor } from "../../src/hitl/interceptor.ts";
import { DelegateHitlHandler } from "../../src/hitl/handler.ts";
import type { ToolDescriptor, ToolContext } from "../../src/core/interfaces.ts";

function ctx(id = "t1"): ToolContext {
  return { agentId: "a", traceId: id, signal: new AbortController().signal };
}

const executeTool: ToolDescriptor = {
  name: "execute",
  description: "run a command",
  inputSchema: { type: "object", properties: {}, required: [] },
  source: "builtin",
  metadata: { sensitive: true },
};

const writeTool: ToolDescriptor = {
  name: "write_file",
  description: "write a file",
  inputSchema: { type: "object", properties: {}, required: [] },
  source: "builtin",
  metadata: { sensitive: true },
};

// ── DelegateHitlHandler.addRule ──────────────────────────────────────────────

describe("DelegateHitlHandler — addRule", () => {
  it("after addRule({ match: 'write_file', sensitive: false }), needsApproval returns false", () => {
    const handler = new DelegateHitlHandler([]);
    expect(handler.needsApproval(writeTool)).toBe(true);
    handler.addRule({ match: "write_file", sensitive: false });
    expect(handler.needsApproval(writeTool)).toBe(false);
  });

  it("addRule with glob pattern matches correctly", () => {
    const handler = new DelegateHitlHandler([]);
    handler.addRule({ match: "write_*", sensitive: false });
    expect(handler.needsApproval(writeTool)).toBe(false);
    expect(handler.needsApproval(executeTool)).toBe(true); // not matched
  });

  it("onRuleAdded callback is fired when a rule is added", () => {
    const cb = vi.fn();
    const handler = new DelegateHitlHandler([], { onRuleAdded: cb });
    handler.addRule({ match: "write_file", sensitive: false });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ match: "write_file", sensitive: false }, undefined);
  });

  it("onRuleAdded receives commandPattern when provided", () => {
    const cb = vi.fn();
    const handler = new DelegateHitlHandler([], { onRuleAdded: cb });
    handler.addRule({ match: "execute", sensitive: false }, "git add *");
    expect(cb).toHaveBeenCalledWith({ match: "execute", sensitive: false }, "git add *");
  });

  it("dynamically added rule takes precedence over metadata", () => {
    const handler = new DelegateHitlHandler([]);
    // sensitive tool starts as needing approval
    expect(handler.needsApproval(executeTool)).toBe(true);
    // add a rule that marks it as not sensitive
    handler.addRule({ match: "execute", sensitive: false });
    expect(handler.needsApproval(executeTool)).toBe(false);
  });
});

// ── Interceptor consumes remember field ─────────────────────────────────────

describe("HitlInterceptor — remember field", () => {
  it("when result has remember, addRule is called and subsequent call is approved without asking", async () => {
    const handler = new DelegateHitlHandler([], {
      resolver: () => ({
        decision: "approve",
        remember: { toolPattern: "write_file" },
      }),
    });
    const interceptor = new HitlInterceptor(handler);

    // First call: needs approval, handler approves + remembers
    const first = await interceptor.intercept(writeTool, {}, ctx("t1"));
    expect(first.approved).toBe(true);

    // Second call: rule now in place, should skip approval entirely
    const requestApprovalSpy = vi.spyOn(handler, "requestApproval");
    const second = await interceptor.intercept(writeTool, {}, ctx("t2"));
    expect(second.approved).toBe(true);
    expect(requestApprovalSpy).not.toHaveBeenCalled();
  });

  it("remember with commandPattern passes commandPattern to addRule", async () => {
    const addRuleSpy = vi.fn();
    const handler = new DelegateHitlHandler([], {
      resolver: () => ({
        decision: "approve",
        remember: { toolPattern: "execute", commandPattern: "git add *" },
      }),
    });
    handler.addRule = addRuleSpy;
    const interceptor = new HitlInterceptor(handler);

    await interceptor.intercept(executeTool, { command: "git add ." }, ctx());
    expect(addRuleSpy).toHaveBeenCalledWith({ match: "execute", sensitive: false }, "git add *");
  });

  it("reject result with remember field is still a rejection (remember is ignored)", async () => {
    const handler = new DelegateHitlHandler([], {
      resolver: () => ({
        decision: "reject",
        feedback: "no",
        remember: { toolPattern: "write_file" },
      }),
    });
    const interceptor = new HitlInterceptor(handler);
    const result = await interceptor.intercept(writeTool, {}, ctx());
    expect(result.approved).toBe(false);
    // rule should NOT have been added on reject
    expect(handler.needsApproval(writeTool)).toBe(true);
  });
});
