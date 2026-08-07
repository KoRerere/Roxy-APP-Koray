import type { TodoItem, TodoStatus } from "../../core/interfaces.ts";
import type { BuiltinTool } from "./index.ts";

function formatTodos(todos: TodoItem[]): string {
  if (todos.length === 0) return "No tasks in the current session.";
  return todos.map((todo, index) => `${index + 1}. [${todo.status}] ${todo.content}`).join("\n");
}

/** Replace the current session's complete todo list. */
export function todo_writeTool(): BuiltinTool {
  return {
    descriptor: {
      name: "todo_write",
      description: "Replace the current session's complete todo list.",
      inputSchema: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                status: { type: "string", enum: ["in_progress", "completed"] },
              },
              required: ["content", "status"],
            },
          },
        },
        required: ["todos"],
      },
      source: "builtin",
      metadata: { sensitive: false },
    },
    handler: async (input, _ctx) => {
      const parsed = input as { todos?: unknown[] };
      if (!Array.isArray(parsed?.todos)) {
        return { content: "todo_write: input.todos must be an array", isError: true };
      }
      const validStatuses = new Set<TodoStatus>(["in_progress", "completed"]);
      for (const item of parsed.todos) {
        const todo = item as Record<string, unknown>;
        if (typeof todo?.content !== "string" || !validStatuses.has(todo?.status as TodoStatus)) {
          return {
            content: "todo_write: each todo must have content and a valid status",
            isError: true,
          };
        }
      }
      const todos = (parsed.todos as TodoItem[]).map((todo) => ({ ...todo }));
      _ctx.emit?.({ type: "todo_updated", todos });
      return { content: formatTodos(todos), isError: false };
    },
  };
}
