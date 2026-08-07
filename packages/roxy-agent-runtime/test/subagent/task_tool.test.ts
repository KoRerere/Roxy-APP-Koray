import { describe, expect, it } from "vitest";
import { taskTool } from "../../src/tools/builtin/task.ts";
import type { AgentResponse, ISubAgentDispatcher, SubAgentSpec, ToolContext } from "../../src/core/interfaces.ts";

const ctx: ToolContext = {
  agentId: "a1",
  traceId: "t1",
  signal: new AbortController().signal,
};

const specs: SubAgentSpec[] = [
  { name: "coder", description: "writes and tests code", systemPrompt: "" },
  { name: "browser", description: "drives a browser", systemPrompt: "" },
];

function dispatcherReturning(text: string): ISubAgentDispatcher {
  return {
    async run(_name, task): Promise<AgentResponse> {
      return {
        messages: [{ role: "assistant", content: `${text} (${task})` }],
        trajectory: [],
      };
    },
  };
}

describe("taskTool", () => {
  it("descriptor advertises available subagent names", () => {
    const { descriptor } = taskTool({ dispatcher: dispatcherReturning("x"), specs });
    expect(descriptor.name).toBe("task");
    expect(descriptor.description).toContain("coder");
    expect(descriptor.description).toContain("browser");
    expect(descriptor.metadata?.sensitive).toBe(true);
  });

  it("dispatches to the subagent and returns its final text", async () => {
    const { handler } = taskTool({ dispatcher: dispatcherReturning("child report"), specs });
    const r = await handler({ subagent_type: "coder", description: "build a parser" }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("child report");
    expect(r.content).toContain("build a parser");
  });

  it("unknown subagent_type → isError (never throws)", async () => {
    const { handler } = taskTool({ dispatcher: dispatcherReturning("x"), specs });
    const r = await handler({ subagent_type: "ghost", description: "x" }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/ghost|unknown|available/i);
  });

  it("dispatcher failure → isError, loop survives", async () => {
    const failing: ISubAgentDispatcher = {
      async run() {
        throw new Error("subagent boom");
      },
    };
    const { handler } = taskTool({ dispatcher: failing, specs });
    const r = await handler({ subagent_type: "coder", description: "x" }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content).toContain("boom");
  });

  it("invalid input (missing fields) → isError", async () => {
    const { handler } = taskTool({ dispatcher: dispatcherReturning("x"), specs });
    const r = await handler({ subagent_type: "coder" }, ctx);
    expect(r.isError).toBe(true);
  });
});
