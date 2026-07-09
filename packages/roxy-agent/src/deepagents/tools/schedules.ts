/**
 * 定时任务 LLM 内置工具集。
 *
 * 让 agent 在对话中创建/查看/修改/删除/启停定时任务。
 * 变更工具调用 ScheduleStore 后同步 schedulerEngine，使 CRUD 实时生效（无需重启）。
 *
 * 形状镜像 tools/run_worker.ts、tools/list_scripts.ts：
 * tool(fn, { name, description, schema }) as unknown as StructuredToolInterface，导出数组。
 *
 * 注意：schedulerEngine 通过 chat.ts → 本文件 import 形成 live binding，
 * 但仅在工具处理函数（运行时）内使用，模块求值时不会触发 TDZ（同 mcpManager）。
 *
 * 工具描述与返回信息统一使用英文（与 get_current_time 工具保持一致）。
 */

import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import cron from 'node-cron'
import { z } from 'zod'
import { ScheduleStore } from '../../database/schedules'
import { schedulerEngine } from '../../schedules/engine'

const PROMPT_FIELD_DESC = 'Self-contained execution prompt. Scheduled runs have no prior context and no shell access; only MCP tools (e.g. browser automation) are available. It must complete the task on its own.'
const CRON_FIELD_DESC = 'Standard 5-field cron expression, e.g. "*/5 * * * *" (every 5 minutes), "0 9 * * *" (daily at 9:00). Server local timezone.'

type ScheduleAgentMode = 'simple' | 'orchestrator'

function normalizeScheduleAgentMode(mode: unknown): ScheduleAgentMode {
  return mode === 'orchestrator' ? 'orchestrator' : 'simple'
}

function formatSchedulesTable(rows: ReturnType<typeof ScheduleStore.list>): string {
  if (rows.length === 0)
    return 'No scheduled tasks.'
  const header = '| Name | ID | cron | Mode | Enabled | Last run | Description |'
  const divider = '| --- | --- | --- | --- | --- | --- | --- |'
  const lines = rows.map((s) => {
    const enabled = s.enabled ? '✅' : '❌'
    const last = s.last_run_at ? s.last_run_at.slice(0, 19) : '—'
    const desc = s.description ?? ''
    return `| ${s.name} | ${s.id} | \`${s.cron_expr}\` | ${s.mode} | ${enabled} | ${last} | ${desc} |`
  })
  return [header, divider, ...lines].join('\n')
}

export function createScheduleTools(mode: ScheduleAgentMode = 'simple'): StructuredToolInterface[] {
  const scheduleMode = normalizeScheduleAgentMode(mode)

  return [
    tool(
      async (input: { name: string, prompt: string, cron: string, description?: string, enabled?: boolean }): Promise<string> => {
        if (!cron.validate(input.cron)) {
          return `❌ Invalid cron expression: \`${input.cron}\`. Please provide a standard 5-field cron expression.`
        }
        // 同名防重：已存在同名任务时拒绝创建，引导 agent 改用 update_schedule，
        // 避免"更新"意图被误执行成反复新建。
        const existing = ScheduleStore.getByName(input.name)
        if (existing) {
          return `⚠️ A scheduled task with the name "${input.name}" already exists (ID: ${existing.id}, cron: \`${existing.cron_expr}\`, enabled: ${existing.enabled ? 'yes' : 'no'}). To change it, call \`update_schedule\` with scheduleId "${existing.id}" instead of creating a new one. If a separate task is truly intended, use a different name.`
        }
        const rec = ScheduleStore.create({
          name: input.name,
          prompt: input.prompt,
          cron_expr: input.cron,
          description: input.description,
          enabled: input.enabled !== false,
          mode: scheduleMode,
        })
        const reg = schedulerEngine.register(rec)
        if (!reg.ok) {
          return `⚠️ Schedule saved but scheduling registration failed: ${reg.error}`
        }
        const state = rec.enabled ? 'enabled' : 'disabled'
        return `✅ Created scheduled task "${rec.name}" (${state})\n- ID: ${rec.id}\n- cron: \`${rec.cron_expr}\`\n- mode: ${rec.mode}\n- prompt: ${rec.prompt}\nIt will be triggered automatically according to the cron schedule.`
      },
      {
        name: 'create_schedule',
        description: 'Create a scheduled task that runs a prompt periodically on a cron schedule. Suited for high-success-rate, context-free recurring automations (e.g. periodic checks, periodic sync). Runs have no history context and no shell; only MCP tools are available. A task name must be unique; if a task with the same name already exists, use `update_schedule` instead.',
        schema: z.object({
          name: z.string().min(1).describe('Task name (must be unique; if it already exists, use update_schedule instead)'),
          prompt: z.string().min(1).describe(PROMPT_FIELD_DESC),
          cron: z.string().describe(CRON_FIELD_DESC),
          description: z.string().optional().describe('Task description (optional)'),
          enabled: z.boolean().optional().describe('Whether to enable immediately; defaults to true'),
        }),
      },
    ) as unknown as StructuredToolInterface,

    tool(
      async (input: { enabledOnly?: boolean }): Promise<string> => {
        let rows = ScheduleStore.list()
        if (input.enabledOnly)
          rows = rows.filter(r => r.enabled)
        return `## Scheduled tasks (${rows.length} total)\n\n${formatSchedulesTable(rows)}`
      },
      {
        name: 'list_schedules',
        description: 'List all scheduled tasks (optionally filtered by enabled state). Call this first to resolve a task name to its ID before update_schedule / toggle_schedule / delete_schedule.',
        schema: z.object({
          enabledOnly: z.boolean().optional().describe('Only return enabled tasks'),
        }),
      },
    ) as unknown as StructuredToolInterface,

    tool(
      async (input: { scheduleId: string }): Promise<string> => {
        schedulerEngine.unregister(input.scheduleId)
        const ok = ScheduleStore.delete(input.scheduleId)
        if (!ok)
          return `❌ Scheduled task not found: ${input.scheduleId}`
        return `✅ Deleted scheduled task ${input.scheduleId} (run history also removed)`
      },
      {
        name: 'delete_schedule',
        description: 'Delete a scheduled task (also stops scheduling and removes its run history).',
        schema: z.object({
          scheduleId: z.string().describe('ID of the scheduled task to delete'),
        }),
      },
    ) as unknown as StructuredToolInterface,

    tool(
      async (input: { scheduleId: string, enabled: boolean }): Promise<string> => {
        const rec = ScheduleStore.setEnabled(input.scheduleId, input.enabled)
        if (!rec)
          return `❌ Scheduled task not found: ${input.scheduleId}`
        const reg = schedulerEngine.register(rec)
        if (!reg.ok)
          return `⚠️ State updated but scheduling sync failed: ${reg.error}`
        return `✅ Scheduled task "${rec.name}" ${rec.enabled ? 'enabled' : 'disabled'}`
      },
      {
        name: 'toggle_schedule',
        description: 'Enable or disable a scheduled task, taking effect immediately (no restart needed).',
        schema: z.object({
          scheduleId: z.string().describe('Scheduled task ID'),
          enabled: z.boolean().describe('true = enable, false = disable'),
        }),
      },
    ) as unknown as StructuredToolInterface,

    tool(
      async (input: { scheduleId: string, name?: string, prompt?: string, cron?: string, description?: string }): Promise<string> => {
        if (input.cron !== undefined && !cron.validate(input.cron)) {
          return `❌ Invalid cron expression: \`${input.cron}\``
        }
        const rec = ScheduleStore.update(input.scheduleId, {
          name: input.name,
          prompt: input.prompt,
          cron_expr: input.cron,
          description: input.description,
        })
        if (!rec)
          return `❌ Scheduled task not found: ${input.scheduleId}`
        const reg = schedulerEngine.register(rec)
        if (!reg.ok)
          return `⚠️ Updated but scheduling sync failed: ${reg.error}`
        return `✅ Updated scheduled task "${rec.name}"\n- cron: \`${rec.cron_expr}\`\n- mode: ${rec.mode}\n- prompt: ${rec.prompt}`
      },
      {
        name: 'update_schedule',
        description: 'Update an existing scheduled task\'s name, prompt, cron, or description. Use this when the user wants to CHANGE/MODIFY an existing task (not create a new one). Pass only the fields to change; cron changes take effect immediately. If you do not have the scheduleId, call `list_schedules` first and match by name.',
        schema: z.object({
          scheduleId: z.string().describe('Scheduled task ID'),
          name: z.string().optional().describe('Task name'),
          prompt: z.string().optional().describe(PROMPT_FIELD_DESC),
          cron: z.string().optional().describe(CRON_FIELD_DESC),
          description: z.string().optional().describe('Task description'),
        }),
      },
    ) as unknown as StructuredToolInterface,
  ]
}

export const scheduleTools = createScheduleTools()
