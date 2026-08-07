import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";
import { todo_writeTool } from "../../src/tools/builtin/todo_write.ts";

describe("AgentImpl.invoke", () => {
  it("pure text response: returns assistant message with no tool turns", async () => {
    const { agent } = buildTestAgent({ responses: [endTurnResponse("Hello!")] });
    const res = await agent.invoke("say hi");
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0]?.role).toBe("assistant");
    expect(res.messages[0]?.content).toBe("Hello!");
  });

  it("single tool call: model → tool_use → result → end_turn", async () => {
    let callIndex = 0;
    const { agent, registry } = buildTestAgent({
      handler: () => {
        callIndex++;
        if (callIndex === 1) return toolCallResponse("id1", "echo", { text: "ping" });
        return endTurnResponse("done");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async (input) => ({
      content: `echoed:${(input as { text: string }).text}`,
      isError: false,
    }));
    const res = await agent.invoke("call echo");
    // assistant(tool_use), user(tool_result), assistant(end_turn)
    expect(res.messages).toHaveLength(3);
    expect(res.messages[0]?.role).toBe("assistant");
    expect(res.messages[1]?.role).toBe("user");
    expect(res.messages[2]?.role).toBe("assistant");
  });

  it("two sequential tool calls then end_turn", async () => {
    let n = 0;
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "echo", { text: "a" });
        if (n === 2) return toolCallResponse("id2", "echo", { text: "b" });
        return endTurnResponse("all done");
      },
    });
    registry.add({ name: "echo", description: "echo", inputSchema: {}, source: "builtin" }, async (input) => ({
      content: (input as { text: string }).text,
      isError: false,
    }));
    const res = await agent.invoke("call echo twice");
    // turn1: assistant(tool_use a), user(tool_result a)
    // turn2: assistant(tool_use b), user(tool_result b)
    // turn3: assistant(end_turn)
    expect(res.messages).toHaveLength(5);
  });

  it("AbortSignal already aborted: invoke.abort hook fires and invoke completes", async () => {
    const ac = new AbortController();
    let abortFired = false;
    const { agent } = buildTestAgent({
      responses: [endTurnResponse("done")],
      hooks: {
        invoke: {
          abort: () => {
            abortFired = true;
          },
        },
      },
    });
    ac.abort();
    await agent.invoke("test", ac.signal);
    expect(abortFired).toBe(true);
  });

  it("trajectory has model_thought events", async () => {
    const { agent } = buildTestAgent({ responses: [endTurnResponse("hi")] });
    const res = await agent.invoke("test");
    expect(res.trajectory.some((e) => e.phase === "model_thought")).toBe(true);
  });

  it("todo_write records its complete snapshot in the trajectory", async () => {
    let modelCalls = 0;
    const todoTool = todo_writeTool();
    const { agent } = buildTestAgent({
      handler: () => {
        modelCalls++;
        if (modelCalls === 1) {
          return toolCallResponse("todo-1", "todo_write", {
            todos: [{ content: "Inspect page", status: "in_progress" }],
          });
        }
        return endTurnResponse("done");
      },
      tools: [todoTool],
    });

    const response = await agent.invoke("test");
    expect(response.trajectory).toContainEqual(
      expect.objectContaining({
        phase: "todo_updated",
        data: { todos: [{ content: "Inspect page", status: "in_progress" }] },
      }),
    );
  });

  it("unknown tool is stripped — loop ends without tool_result (avoids provider 400)", async () => {
    // When the model calls a tool not in the registry (e.g. provider-internal tools
    // like DeepSeek built-ins), we strip the tool_use and treat the response as
    // end_turn rather than sending a tool_result that the provider would reject.
    let n = 0;
    const { agent } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "no_such_tool", {});
        return endTurnResponse("done");
      },
    });
    const res = await agent.invoke("call unknown tool");
    // Only ONE model call — no second loop iteration after stripping
    expect(n).toBe(1);
    // No tool_result message in history
    const toolResultMsg = res.messages.find((m) => m.role === "user" && Array.isArray(m.content));
    expect(toolResultMsg).toBeUndefined();
    // No unresolved tool_use blocks remain in the assistant message
    const assistantMsg = res.messages.find((m) => m.role === "assistant");
    if (assistantMsg && Array.isArray(assistantMsg.content)) {
      const toolUseBlocks = (assistantMsg.content as Array<{ type: string }>).filter((b) => b.type === "tool_use");
      expect(toolUseBlocks).toHaveLength(0);
    }
  });
});
