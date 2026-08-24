// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export type PlanStatus = 'pending' | 'in_progress' | 'completed'
export interface PlanItem {
  content: string
  status: PlanStatus
}

/** Domain events emitted by tools and observable by runtime stream consumers. */
export type ToolEvent = { type: 'plan_updated'; todos: PlanItem[] }

/** @deprecated Use PlanStatus. */
export type TodoStatus = PlanStatus
/** @deprecated Use PlanItem. */
export type TodoItem = PlanItem
