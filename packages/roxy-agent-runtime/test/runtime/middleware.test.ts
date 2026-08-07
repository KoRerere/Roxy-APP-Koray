import { describe, expect, it, vi } from "vitest";
import type { ToolAfterContext, ToolMiddleware, ToolMiddlewareContext, ToolResult } from "../../src/core/interfaces.ts";
import { runAfterMiddleware, runBeforeMiddleware } from "../../src/runtime/middleware_chain.ts";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";

const stubCtx: ToolMiddlewareContext = {
  agentId: "agent",
  sessionId: "session",
  traceId: "trace",
  toolName: "test_tool",
  toolSource: "builtin",
  toolUseId: "use-1",
  callIndex: 0,
};

const stubResult: ToolResult = {
  toolUseId: "use-1",
  content: "original",
  isError: false,
};

// ---------------------------------------------------------------------------
// Unit: runBeforeMiddleware
// ---------------------------------------------------------------------------

describe("runBeforeMiddleware", () => {
  it("returns original input when no middleware matches", async () => {
    const out = await runBeforeMiddleware([], "any_tool", { x: 1 }, stubCtx);
    expect(out.aborted).toBe(false);
    if (!out.aborted) expect(out.input).toEqual({ x: 1 });
  });

  it("passes modified input through chain in registration order", async () => {
    const order: string[] = [];
    const mws: ToolMiddleware[] = [
      {
        before(input, _ctx) {
          order.push("A");
          return { ...(input as Record<string, unknown>), a: true };
        },
      },
      {
        before(input, _ctx) {
          order.push("B");
          return { ...(input as Record<string, unknown>), b: true };
        },
      },
    ];
    const out = await runBeforeMiddleware(mws, "any_tool", {}, stubCtx);
    expect(order).toEqual(["A", "B"]);
    expect(out.aborted).toBe(false);
    if (!out.aborted) expect(out.input).toEqual({ a: true, b: true });
  });

  it("returns aborted=true when a before() throws", async () => {
    const mws: ToolMiddleware[] = [
      {
        before() {
          throw new Error("blocked");
        },
      },
    ];
    const out = await runBeforeMiddleware(mws, "any_tool", {}, stubCtx);
    expect(out.aborted).toBe(true);
    if (out.aborted) expect(out.error.message).toBe("blocked");
  });

  it("skips subsequent middleware after abort", async () => {
    const ran: string[] = [];
    const mws: ToolMiddleware[] = [
      {
        before() {
          throw new Error("stop");
        },
      },
      {
        before(input) {
          ran.push("B");
          return input;
        },
      },
    ];
    const out = await runBeforeMiddleware(mws, "any_tool", {}, stubCtx);
    expect(out.aborted).toBe(true);
    expect(ran).toHaveLength(0);
  });

  it("skips middleware that does not match the tool name", async () => {
    const ran: string[] = [];
    const mws: ToolMiddleware[] = [
      {
        match: "other_tool",
        before(input) {
          ran.push("mw");
          return input;
        },
      },
    ];
    const out = await runBeforeMiddleware(mws, "test_tool", {}, stubCtx);
    expect(out.aborted).toBe(false);
    expect(ran).toHaveLength(0);
  });

  it("matches tool name with glob pattern", async () => {
    const ran: string[] = [];
    const mws: ToolMiddleware[] = [
      {
        match: "write_*",
        before(input) {
          ran.push("mw");
          return input;
        },
      },
    ];
    await runBeforeMiddleware(mws, "write_file", {}, stubCtx);
    expect(ran).toHaveLength(1);
    await runBeforeMiddleware(mws, "read_file", {}, stubCtx);
    expect(ran).toHaveLength(1); // not called again
  });

  it("matches tool name with RegExp", async () => {
    const ran: string[] = [];
    const mws: ToolMiddleware[] = [
      {
        match: /^(execute|shell)$/,
        before(input) {
          ran.push("mw");
          return input;
        },
      },
    ];
    await runBeforeMiddleware(mws, "execute", {}, stubCtx);
    expect(ran).toHaveLength(1);
    await runBeforeMiddleware(mws, "read_file", {}, stubCtx);
    expect(ran).toHaveLength(1); // not called again
  });
});

// ---------------------------------------------------------------------------
// Unit: runAfterMiddleware
// ---------------------------------------------------------------------------

describe("runAfterMiddleware", () => {
  it("returns original result when no middleware", async () => {
    const out = await runAfterMiddleware([], "any_tool", stubResult, stubCtx);
    expect(out).toEqual(stubResult);
  });

  it("runs after() in REVERSE registration order", async () => {
    const order: string[] = [];
    const mws: ToolMiddleware[] = [
      {
        after(result) {
          order.push("A");
          return result;
        },
      },
      {
        after(result) {
          order.push("B");
          return result;
        },
      },
    ];
    await runAfterMiddleware(mws, "any_tool", stubResult, stubCtx);
    expect(order).toEqual(["B", "A"]); // last-registered runs first
  });

  it("each after() receives the result from the previous after()", async () => {
    const mws: ToolMiddleware[] = [
      {
        after(result) {
          return { ...result, content: result.content + "_A" };
        },
      },
      {
        after(result) {
          return { ...result, content: result.content + "_B" };
        },
      },
    ];
    // B runs first (reverse), then A
    const out = await runAfterMiddleware(mws, "any_tool", stubResult, stubCtx);
    expect(out.content).toBe("original_B_A");
  });

  it("after() can change isError to true", async () => {
    const mws: ToolMiddleware[] = [
      {
        after(result) {
          return { ...result, isError: true, content: "redacted" };
        },
      },
    ];
    const out = await runAfterMiddleware(mws, "any_tool", stubResult, stubCtx);
    expect(out.isError).toBe(true);
    expect(out.content).toBe("redacted");
  });
});

// ---------------------------------------------------------------------------
// Integration: middleware wired into agent loop
// ---------------------------------------------------------------------------

describe("middleware integration (agent loop)", () => {
  it("before() modifies input — handler receives modified value", async () => {
    let receivedInput: unknown;
    const { agent, registry } = buildTestAgent({
      middleware: [
        {
          before(input) {
            return { ...(input as Record<string, unknown>), injected: true };
          },
        },
      ],
      responses: [toolCallResponse("u1", "capture_tool", { original: true }), endTurnResponse("done")],
    });
    registry.add(
      { name: "capture_tool", description: "", inputSchema: { type: "object" }, source: "builtin" },
      async (input) => {
        receivedInput = input;
        return { content: "ok", isError: false };
      },
    );
    await agent.invoke("go");
    expect((receivedInput as Record<string, unknown>).injected).toBe(true);
  });

  it("before() throw — handler not executed, tool.after.errorKind = 'aborted'", async () => {
    const afterCalls: ToolAfterContext[] = [];
    let handlerCalled = false;
    const { agent, registry } = buildTestAgent({
      middleware: [
        {
          before() {
            throw new Error("blocked");
          },
        },
      ],
      hooks: {
        tool: { after: (ctx) => afterCalls.push(ctx) },
      },
      responses: [toolCallResponse("u1", "blocked_tool", {}), endTurnResponse("done")],
    });
    registry.add(
      { name: "blocked_tool", description: "", inputSchema: { type: "object" }, source: "builtin" },
      async () => {
        handlerCalled = true;
        return { content: "should not run", isError: false };
      },
    );
    await agent.invoke("go");
    expect(handlerCalled).toBe(false);
    expect(afterCalls[0]?.errorKind).toBe("aborted");
    expect(afterCalls[0]?.isError).toBe(true);
  });

  it("after() modifies result — model receives modified content", async () => {
    let secondCallMessages: unknown;
    const { agent, registry } = buildTestAgent({
      middleware: [
        {
          after(result) {
            return { ...result, content: "REDACTED" };
          },
        },
      ],
      handler: (req, callIndex) => {
        if (callIndex === 0) return toolCallResponse("u1", "leaky_tool", {});
        secondCallMessages = req.messages;
        return endTurnResponse("done");
      },
    });
    registry.add(
      { name: "leaky_tool", description: "", inputSchema: { type: "object" }, source: "builtin" },
      async () => ({ content: "secret content", isError: false }),
    );
    await agent.invoke("go");
    const msgs = secondCallMessages as Array<{ role: string; content: unknown }>;
    const toolResultMsg = msgs?.find((m) => m.role === "user" && Array.isArray(m.content));
    const resultContent = (toolResultMsg?.content as Array<{ type: string; content?: string }> | undefined)?.find(
      (b) => b.type === "tool_result",
    )?.content;
    expect(resultContent).toBe("REDACTED");
  });
});
