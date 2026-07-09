/**
 * 定时任务（Schedules）数据模型类型定义。
 *
 * 定时任务用于"按 cron 定时触发、自动执行一次任务"的高成功率、无上下文场景。
 * 触发执行时使用临时 agent（无 conversationId），不落库消息、不携带历史上下文。
 * 运行历史记录在 schedule_runs 表，供前端查看执行结果。
 */

export interface ScheduleRecord {
  id: string
  user_id: string
  workspace_id: string
  name: string
  description: string | null
  /** 自包含的执行 prompt；定时运行无任何先前上下文，必须能独立完成 */
  prompt: string
  /** 5 字段 cron 表达式，经 node-cron.validate() 校验 */
  cron_expr: string
  /** 0 | 1 */
  enabled: number
  /** 创建任务时使用的 agent 模式；执行时沿用该模式 */
  mode: string
  created_at: string
  updated_at: string
  last_run_at: string | null
}

export interface CreateScheduleInput {
  name: string
  description?: string
  prompt: string
  cron_expr: string
  enabled?: boolean
  mode?: string
}

export interface UpdateScheduleInput {
  name?: string
  description?: string
  prompt?: string
  cron_expr?: string
  enabled?: boolean
  mode?: string
}

export type ScheduleRunStatus = 'running' | 'success' | 'failed' | 'skipped'

export interface ScheduleRunRecord {
  id: string
  schedule_id: string
  status: ScheduleRunStatus
  started_at: string
  ended_at: string | null
  /** 最终 AIMessage 文本的前 ~2000 字 */
  output_excerpt: string | null
  error: string | null
  duration_ms: number | null
}

export interface ScheduleRunCreateInput {
  schedule_id: string
  status: ScheduleRunStatus
}

export interface ScheduleRunMarkInput {
  output_excerpt?: string | null
  error?: string | null
  duration_ms?: number | null
}
