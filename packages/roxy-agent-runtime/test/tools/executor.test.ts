import { describe, expect, it } from "vitest";
import type { ToolContext, ToolHandlerResult } from "../../src/core/interfaces.ts";
import { ToolExecutor } from "../../src/tools/executor.ts";
import { ToolRegistry } from "../../src/tools/registry.ts";

function ctx(): ToolContext {
  return { agentId: "a", traceId: "t", signal: new AbortController().signal };
}

describe("ToolExecutor (production)", () => {
  it("passes the concrete toolUseId to the registered handler context", async () => {
    // Regression: ToolHandler only received the turn traceId, so host adapters
    // could not correlate an MCP call with the model's tool_use block.
    // Fixed by: ToolExecutor derives a per-call context containing toolUseId.
    const registry = new ToolRegistry();
    let received: string | undefined;
    registry.add({ name: "mcp_tool", description: "mcp", inputSchema: {}, source: "mcp" }, async (_input, context) => {
      received = context.toolUseId;
      return { content: "ok", isError: false };
    });

    const executor = new ToolExecutor(registry);
    await executor.execute("mcp_tool", {}, ctx(), "block_id_abc");

    expect(received).toBe("block_id_abc");
  });

  it("toolUseId from execute() arg always wins over extra toolUseId returned by handler", async () => {
    // Regression: executor did `return { toolUseId, ...r }`.
    // MCP handlers (App.tsx) return a ToolResult that carries toolUseId: ''
    // (the default, since ToolHandler only takes 2 args and the MCP callTool
    // always populates toolUseId on its return value).
    // The spread `{ toolUseId: block_id, ...r }` was overridden by r.toolUseId = '',
    // producing tool_result.tool_use_id = '' != tool_use.id → provider 400.
    // Fixed by: `{ ...r, toolUseId }` so the execute() arg is last and always wins.
    const registry = new ToolRegistry();
    registry.add(
      { name: "mcp_tool", description: "simulated MCP tool", inputSchema: {}, source: "mcp" },
      async (_input: unknown, _ctx: ToolContext) => {
        // Simulate what App.tsx MCP handler returns: a ToolResult object
        // (structural superset of ToolHandlerResult) with toolUseId: ''.
        const result = { toolUseId: "", content: "workspace list", isError: false };
        return result as unknown as ToolHandlerResult;
      },
    );

    const executor = new ToolExecutor(registry);
    const result = await executor.execute("mcp_tool", {}, ctx(), "block_id_abc");

    // Must equal the toolUseId passed to execute(), never the empty string from the handler.
    expect(result.toolUseId).toBe("block_id_abc");
  });

  it("stamps toolUseId from execute() arg when handler returns plain ToolHandlerResult", async () => {
    // Sanity: when a handler returns only { content, isError } (no toolUseId
    // field at all), the executor still stamps the correct toolUseId.
    const registry = new ToolRegistry();
    registry.add({ name: "plain", description: "plain", inputSchema: {}, source: "builtin" }, async () => ({
      content: "ok",
      isError: false,
    }));
    const executor = new ToolExecutor(registry);
    const result = await executor.execute("plain", {}, ctx(), "call_xyz_999");
    expect(result.toolUseId).toBe("call_xyz_999");
    expect(result.content).toBe("ok");
    expect(result.isError).toBe(false);
  });
});
