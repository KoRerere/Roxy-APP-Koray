import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";
import { ScriptedClarificationHandler } from "../../src/clarification/handler.ts";

describe("clarification (ask_user) integration", () => {
  it("ask_user tool returns scripted answer as tool_result", async () => {
    let n = 0;
    const clarification = new ScriptedClarificationHandler(["TypeScript"]);
    const { agent, registry } = buildTestAgent({
      clarification,
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "ask_user", { question: "which language?" });
        return endTurnResponse("done");
      },
    });
    // Register ask_user: the builtin tool delegates to the clarification handler
    registry.add({ name: "ask_user", description: "ask", inputSchema: {}, source: "builtin" }, async (input, _ctx) => {
      const req = input as { question: string };
      const result = await clarification.request({ traceId: "t", question: req.question });
      return { content: result.answer, isError: false };
    });
    const res = await agent.invoke("ask user");
    // Find the tool_result message
    const toolResultMsg = res.messages.find((m) => m.role === "user" && Array.isArray(m.content));
    expect(toolResultMsg).toBeDefined();
    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const block = toolResultMsg.content.find((b) => "tool_use_id" in b) as { content: string } | undefined;
      expect(block?.content).toBe("TypeScript");
    }
    expect(clarification.calls[0]?.question).toBe("which language?");
  });

  it("NullClarificationHandler gives empty answer", async () => {
    let n = 0;
    const {
      agent,
      registry,
      provider: _p,
    } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("id1", "ask_user", { question: "anything?" });
        return endTurnResponse("done");
      },
    });
    registry.add({ name: "ask_user", description: "ask", inputSchema: {}, source: "builtin" }, async () => ({
      content: "",
      isError: false,
    }));
    const res = await agent.invoke("ask null");
    const toolResultMsg = res.messages.find((m) => m.role === "user" && Array.isArray(m.content));
    expect(toolResultMsg).toBeDefined();
    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const block = toolResultMsg.content.find((b) => "tool_use_id" in b) as { content: string } | undefined;
      expect(block?.content).toBe("");
    }
  });
});
