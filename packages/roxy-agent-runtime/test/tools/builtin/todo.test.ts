import { describe, expect, it } from "vitest";
import { todo_writeTool } from "../../../src/tools/builtin/todo_write.ts";
import type { ToolContext, ToolEvent } from "../../../src/core/interfaces.ts";

function ctx(emit?: (event: ToolEvent) => void): ToolContext {
  return { agentId: "a", traceId: "t", signal: new AbortController().signal, emit };
}

describe("todo_write tool", () => {
  it("has descriptor with name 'todo_write', builtin source", () => {
    const { descriptor } = todo_writeTool();
    expect(descriptor.name).toBe("todo_write");
    expect(descriptor.source).toBe("builtin");
  });

  it("returns and emits the complete updated list", async () => {
    const events: ToolEvent[] = [];
    const { handler } = todo_writeTool();
    const input = {
      todos: [
        { content: "First task", status: "in_progress" },
        { content: "Second task", status: "in_progress" },
      ],
    };
    const result = await handler(
      input,
      ctx((event) => events.push(event)),
    );
    expect(result.isError).toBe(false);
    expect(result.content).toContain("First task");
    expect(result.content).toContain("Second task");
    expect(events).toEqual([{ type: "todo_updated", todos: input.todos }]);
  });

  it("returns isError when the input schema is violated", async () => {
    const { handler } = todo_writeTool();
    const result = await handler({ todos: [{ bad: true }] }, ctx());
    expect(result.isError).toBe(true);
  });

  it("does not retain state between snapshots", async () => {
    const events: ToolEvent[] = [];
    const { handler } = todo_writeTool();
    const context = ctx((event) => events.push(event));
    await handler({ todos: [{ content: "old", status: "in_progress" }] }, context);
    await handler({ todos: [{ content: "new", status: "completed" }] }, context);
    expect(events.at(-1)).toEqual({
      type: "todo_updated",
      todos: [{ content: "new", status: "completed" }],
    });
  });
});
