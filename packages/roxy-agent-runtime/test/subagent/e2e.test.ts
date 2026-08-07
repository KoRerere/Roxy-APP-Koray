import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";
import { SubAgentRegistry } from "../../src/subagent/registry.ts";
import { SubAgentDispatcher } from "../../src/subagent/dispatcher.ts";
import { taskTool } from "../../src/tools/builtin/task.ts";
import type { ChatRequest, Message } from "../../src/core/interfaces.ts";

const isToolResult = (m: Message | undefined): boolean =>
  !!m && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result");

/** Serialize an AgentResponse's messages for substring assertions. */
const serialize = (messages: Message[]): string => JSON.stringify(messages);

describe("subagent e2e — main loop delegates through the task tool", () => {
  it("main dispatches to a child agent and receives its report as a tool_result", async () => {
    const registry = new SubAgentRegistry([
      { name: "coder", description: "writes code", systemPrompt: "You are coder." },
    ]);

    // Child agent: echoes the task it was given as its final report.
    const child = buildTestAgent({
      handler: (req: ChatRequest) => {
        const last = req.messages.at(-1);
        const task = typeof last?.content === "string" ? last.content : "";
        return endTurnResponse(`child processed: ${task}`);
      },
    });

    let builds = 0;
    const dispatcher = new SubAgentDispatcher(
      registry,
      async () => {
        builds++;
        return child.agent;
      },
      "parent-1",
    );
    const { descriptor, handler } = taskTool({ dispatcher, specs: registry.list() });

    // Main agent: first turn calls `task`, then ends after the tool_result.
    const main = buildTestAgent({
      handler: (req: ChatRequest) =>
        isToolResult(req.messages.at(-1))
          ? endTurnResponse("main done")
          : toolCallResponse("tu1", "task", {
              subagent_type: "coder",
              description: "write parser",
            }),
      tools: [{ descriptor, handler }],
    });

    const resp = await main.agent.invoke("please build a parser");

    expect(builds).toBe(1);
    expect(child.provider.calls.length).toBe(1);
    // The child's report crossed back into the parent as a tool_result.
    expect(serialize(resp.messages)).toContain("child processed: write parser");
  });

  it("repeated task calls reuse the SAME child instance (auto-continue)", async () => {
    const registry = new SubAgentRegistry([
      { name: "coder", description: "writes code", systemPrompt: "You are coder." },
    ]);
    const child = buildTestAgent({
      handler: (req: ChatRequest) => {
        const last = req.messages.at(-1);
        const task = typeof last?.content === "string" ? last.content : "";
        return endTurnResponse(`child: ${task}`);
      },
    });
    let builds = 0;
    const dispatcher = new SubAgentDispatcher(
      registry,
      async () => {
        builds++;
        return child.agent;
      },
      "parent-1",
    );
    const { descriptor, handler } = taskTool({ dispatcher, specs: registry.list() });

    const main = buildTestAgent({
      handler: (req: ChatRequest) =>
        isToolResult(req.messages.at(-1))
          ? endTurnResponse("done")
          : toolCallResponse(`tu-${req.messages.length}`, "task", {
              subagent_type: "coder",
              description: "iterate",
            }),
      tools: [{ descriptor, handler }],
    });

    await main.agent.invoke("first");
    await main.agent.invoke("second");

    // Built exactly once; the same child handled both delegations.
    expect(builds).toBe(1);
    expect(child.provider.calls.length).toBe(2);
  });

  it("child memory accumulates across delegations; parent memory only sees reports", async () => {
    const registry = new SubAgentRegistry([
      { name: "coder", description: "writes code", systemPrompt: "You are coder." },
    ]);
    const child = buildTestAgent({
      handler: (req: ChatRequest) => {
        const last = req.messages.at(-1);
        const task = typeof last?.content === "string" ? last.content : "";
        return endTurnResponse(`ok: ${task}`);
      },
    });
    const dispatcher = new SubAgentDispatcher(registry, async () => child.agent, "parent-1");
    const { descriptor, handler } = taskTool({ dispatcher, specs: registry.list() });
    const main = buildTestAgent({
      handler: (req: ChatRequest) =>
        isToolResult(req.messages.at(-1))
          ? endTurnResponse("done")
          : toolCallResponse(`tu-${req.messages.length}`, "task", {
              subagent_type: "coder",
              description: "step",
            }),
      tools: [{ descriptor, handler }],
    });

    await main.agent.invoke("first");
    await main.agent.invoke("second");

    // The child's own history grew across both delegations (full context kept).
    const childHistory = await child.memory.getAll(child.agent.sessionId);
    expect(childHistory.length).toBeGreaterThanOrEqual(4); // 2×(user task + assistant report)

    // The parent never absorbed the child's intermediate turns — only the
    // task tool_results (the reports) live in the parent history.
    const parentHistory = await main.memory.getAll(main.agent.sessionId);
    expect(serialize(parentHistory)).not.toContain("You are coder.");
  });
});
