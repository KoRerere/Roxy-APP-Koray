import { describe, expect, it } from "vitest";
import { todo_writeTool } from "../../../src/tools/builtin/todo_write.ts";
import type { ToolEvent } from "../../../src/core/interfaces.ts";

function makeCtx(emit?: (event: ToolEvent) => void) {
  return { agentId: "a", traceId: "t1", signal: new AbortController().signal, emit };
}

describe("todo_writeTool", () => {
  it("replaces items and returns formatted list", async () => {
    const write = todo_writeTool();
    const result = await write.handler(
      {
        todos: [
          { content: "Implement feature X", status: "in_progress" },
          { content: "Write tests", status: "in_progress" },
        ],
      },
      makeCtx(),
    );
    expect(result.isError).toBe(false);
    expect(result.content).toContain("1.");
    expect(result.content).toContain("Implement feature X");
    expect(result.content).toContain("in_progress");
    expect(result.content).toContain("2.");
  });

  it("emits a complete snapshot when a task changes", async () => {
    const events: ToolEvent[] = [];
    const write = todo_writeTool();
    const result = await write.handler(
      { todos: [{ content: "Do X", status: "completed" }] },
      makeCtx((event) => events.push(event)),
    );
    expect(result.isError).toBe(false);
    expect(result.content).toContain("completed");
    expect(events).toEqual([{ type: "todo_updated", todos: [{ content: "Do X", status: "completed" }] }]);
  });

  it("returns error when todos is not an array", async () => {
    const write = todo_writeTool();
    const result = await write.handler({ todos: "not-an-array" }, makeCtx());
    expect(result.isError).toBe(true);
  });

  it("returns error when item is missing required field", async () => {
    const write = todo_writeTool();
    const result = await write.handler(
      { todos: [{ content: "X" }] }, // missing status
      makeCtx(),
    );
    expect(result.isError).toBe(true);
  });

  it("returns error on invalid status value", async () => {
    const events: ToolEvent[] = [];
    const write = todo_writeTool();
    const result = await write.handler(
      { todos: [{ content: "X", status: "not_valid" }] },
      makeCtx((event) => events.push(event)),
    );
    expect(result.isError).toBe(true);
    expect(events).toEqual([]);
  });

  it("accepts only active and completed todo states", async () => {
    // Regression: the model could create pending/cancelled items that add
    // bookkeeping states without representing useful agent work.
    // Fixed by: todo_write exposes only in_progress and completed statuses.
    const write = todo_writeTool();

    expect(write.descriptor.inputSchema).toMatchObject({
      properties: {
        todos: {
          items: {
            properties: {
              status: { enum: ["in_progress", "completed"] },
            },
            required: ["content", "status"],
          },
        },
      },
    });
    const itemProperties = (
      write.descriptor.inputSchema as {
        properties: { todos: { items: { properties: Record<string, unknown> } } };
      }
    ).properties.todos.items.properties;
    expect(itemProperties).not.toHaveProperty("id");
    expect(itemProperties).not.toHaveProperty("priority");

    for (const status of ["pending", "cancelled"]) {
      const result = await write.handler({ todos: [{ content: "Task", status }] }, makeCtx());
      expect(result.isError).toBe(true);
    }
  });

  it("replaces the full list from content and status only", async () => {
    // Regression: model-assigned ids and priorities turn simple checklist
    // updates into bookkeeping, while upsert leaves removed work behind.
    // Fixed by: todo_write accepts a full content/status snapshot and replaces it atomically.
    const events: ToolEvent[] = [];
    const write = todo_writeTool();

    const initial = await write.handler(
      {
        todos: [
          { content: "Inspect the page", status: "completed" },
          { content: "Submit the form", status: "in_progress" },
        ],
      },
      makeCtx((event) => events.push(event)),
    );
    expect(initial.isError).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "todo_updated",
      todos: [
        { content: "Inspect the page", status: "completed" },
        { content: "Submit the form", status: "in_progress" },
      ],
    });

    const replaced = await write.handler(
      { todos: [{ content: "Submit the form", status: "completed" }] },
      makeCtx((event) => events.push(event)),
    );
    expect(replaced.isError).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "todo_updated",
      todos: [{ content: "Submit the form", status: "completed" }],
    });
  });

  it("is not sensitive (internal planning state)", () => {
    const tool = todo_writeTool();
    expect(tool.descriptor.metadata?.sensitive).toBe(false);
  });
});
