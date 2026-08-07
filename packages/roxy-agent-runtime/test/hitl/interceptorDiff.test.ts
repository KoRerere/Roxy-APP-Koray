import { describe, expect, it } from "vitest";
import { HitlInterceptor } from "../../src/hitl/interceptor.ts";
import { FakeHitlHandler } from "../helpers/makeFakeHandler.ts";
import type { ToolContext, ToolDescriptor } from "../../src/core/interfaces.ts";

function ctx(): ToolContext {
  return { agentId: "a", traceId: "t1", signal: new AbortController().signal };
}

describe("HitlInterceptor — diff via previewFn", () => {
  it("passes diff from previewFn to ApprovalRequest", async () => {
    const handler = new FakeHitlHandler({ mode: "strict", results: [{ decision: "approve" }] });
    const interceptor = new HitlInterceptor(handler);

    const tool: ToolDescriptor = {
      name: "write_file",
      description: "write",
      inputSchema: { type: "object" },
      source: "builtin",
      metadata: { sensitive: true },
      previewFn: async () => "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
    };

    await interceptor.intercept(tool, { path: "f.ts", content: "new\n" }, ctx());

    expect(handler.requests[0]?.diff).toBe("--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new");
  });

  it("diff is undefined when previewFn is absent", async () => {
    const handler = new FakeHitlHandler({ mode: "strict", results: [{ decision: "approve" }] });
    const interceptor = new HitlInterceptor(handler);

    const tool: ToolDescriptor = {
      name: "execute",
      description: "exec",
      inputSchema: { type: "object" },
      source: "builtin",
      metadata: { sensitive: true },
    };

    await interceptor.intercept(tool, { command: "ls" }, ctx());
    expect(handler.requests[0]?.diff).toBeUndefined();
  });

  it("diff is undefined when previewFn throws", async () => {
    const handler = new FakeHitlHandler({ mode: "strict", results: [{ decision: "approve" }] });
    const interceptor = new HitlInterceptor(handler);

    const tool: ToolDescriptor = {
      name: "write_file",
      description: "write",
      inputSchema: { type: "object" },
      source: "builtin",
      metadata: { sensitive: true },
      previewFn: async () => {
        throw new Error("cannot read");
      },
    };

    // Should not throw — errors from previewFn are swallowed
    const result = await interceptor.intercept(tool, {}, ctx());
    expect(result.approved).toBe(true);
    expect(handler.requests[0]?.diff).toBeUndefined();
  });

  it("diff is undefined when previewFn returns undefined", async () => {
    const handler = new FakeHitlHandler({ mode: "strict", results: [{ decision: "approve" }] });
    const interceptor = new HitlInterceptor(handler);

    const tool: ToolDescriptor = {
      name: "write_file",
      description: "write",
      inputSchema: { type: "object" },
      source: "builtin",
      metadata: { sensitive: true },
      previewFn: async () => undefined,
    };

    await interceptor.intercept(tool, {}, ctx());
    expect(handler.requests[0]?.diff).toBeUndefined();
  });
});
