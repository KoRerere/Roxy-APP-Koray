// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------

/**
 * Unfinished work is always in progress. Avoid a separate backlog/cancelled
 * state so the model can maintain a task list without bookkeeping transitions.
 */
export type TodoStatus = "in_progress" | "completed";
export interface TodoItem {
  content: string;
  status: TodoStatus;
}

/** Domain events emitted by tools and observable by runtime stream consumers. */
export type ToolEvent = { type: "todo_updated"; todos: TodoItem[] };
