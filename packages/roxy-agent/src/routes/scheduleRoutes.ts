/**
 * 定时任务 REST 路由（/api/schedules）。
 *
 * 供前端管理定时任务与查看运行历史。所有变更路由同步 schedulerEngine，CRUD 实时生效。
 * 形状镜像 routes/scriptRoutes.ts：Router + zod + { code:0, data } / { code:1, msg } 信封。
 */

import type { Request, Response } from 'express'
import { Router } from 'express'
import cron from 'node-cron'
import { z } from 'zod'
import { ScheduleRunStore, ScheduleStore } from '@/database/schedules'
import { schedulerEngine } from '@/schedules/engine'

const router: Router = Router()

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback
}

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p
}

function toDTO(r: ReturnType<typeof ScheduleStore.getById>) {
  if (!r)
    return null
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    prompt: r.prompt,
    cron: r.cron_expr,
    enabled: Boolean(r.enabled),
    mode: r.mode,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastRunAt: r.last_run_at,
  }
}

function runToDTO(r: ReturnType<typeof ScheduleRunStore.getLatest>) {
  if (!r)
    return null
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    outputExcerpt: r.output_excerpt,
    error: r.error,
    durationMs: r.duration_ms,
  }
}

const CreateSchema = z.object({
  name: z.string({ error: 'name is required' }),
  prompt: z.string({ error: 'prompt is required' }),
  cron: z.string({ error: 'cron is required' }),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
})

const UpdateSchema = z.object({
  name: z.string().optional(),
  prompt: z.string().optional(),
  cron: z.string().optional(),
  description: z.string().optional(),
})

const ValidateSchema = z.object({
  cron: z.string({ error: 'cron is required' }),
})

const RunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

/** POST /api/schedules/validate — 校验 cron 表达式 */
router.post('/validate', (req: Request, res: Response) => {
  const parsed = ValidateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })
  }
  return res.json({ code: 0, data: { valid: cron.validate(parsed.data.cron) } })
})

/** GET /api/schedules — 列出定时任务 */
router.get('/', (req: Request, res: Response) => {
  const enabledOnly = req.query.enabledOnly === 'true' || req.query.enabledOnly === '1'
  let rows = ScheduleStore.list()
  if (enabledOnly)
    rows = rows.filter(r => r.enabled)
  return res.json({ code: 0, data: rows.map(toDTO) })
})

/** POST /api/schedules — 创建定时任务 */
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })
  }
  if (!cron.validate(parsed.data.cron)) {
    return res.json({ code: 1, msg: `Invalid cron expression: ${parsed.data.cron}` })
  }
  const rec = ScheduleStore.create({
    name: parsed.data.name,
    prompt: parsed.data.prompt,
    cron_expr: parsed.data.cron,
    description: parsed.data.description,
    enabled: parsed.data.enabled !== false,
    mode: 'simple',
  })
  schedulerEngine.register(rec)
  return res.json({ code: 0, data: toDTO(rec) })
})

/** GET /api/schedules/:id — 详情 */
router.get('/:id', (req: Request, res: Response) => {
  const rec = ScheduleStore.getById(param(req.params.id))
  if (!rec)
    return res.json({ code: 1, msg: 'Schedule not found' })
  return res.json({ code: 0, data: toDTO(rec) })
})

/** PUT /api/schedules/:id — 更新 */
router.put('/:id', (req: Request, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })
  }
  if (parsed.data.cron !== undefined && !cron.validate(parsed.data.cron)) {
    return res.json({ code: 1, msg: `Invalid cron expression: ${parsed.data.cron}` })
  }
  const rec = ScheduleStore.update(param(req.params.id), {
    name: parsed.data.name,
    prompt: parsed.data.prompt,
    cron_expr: parsed.data.cron,
    description: parsed.data.description,
  })
  if (!rec)
    return res.json({ code: 1, msg: 'Schedule not found' })
  schedulerEngine.register(rec)
  return res.json({ code: 0, data: toDTO(rec) })
})

/** DELETE /api/schedules/:id — 删除（级联运行历史） */
router.delete('/:id', (req: Request, res: Response) => {
  const id = param(req.params.id)
  schedulerEngine.unregister(id)
  const ok = ScheduleStore.delete(id)
  if (!ok)
    return res.json({ code: 1, msg: 'Schedule not found' })
  return res.json({ code: 0, data: null })
})

/** POST /api/schedules/:id/enable — 启用 */
router.post('/:id/enable', (req: Request, res: Response) => {
  const rec = ScheduleStore.setEnabled(param(req.params.id), true)
  if (!rec)
    return res.json({ code: 1, msg: 'Schedule not found' })
  schedulerEngine.register(rec)
  return res.json({ code: 0, data: toDTO(rec) })
})

/** POST /api/schedules/:id/disable — 停用 */
router.post('/:id/disable', (req: Request, res: Response) => {
  const rec = ScheduleStore.setEnabled(param(req.params.id), false)
  if (!rec)
    return res.json({ code: 1, msg: 'Schedule not found' })
  schedulerEngine.unregister(rec.id)
  return res.json({ code: 0, data: toDTO(rec) })
})

/** GET /api/schedules/:id/runs/latest — 最近一次运行 */
router.get('/:id/runs/latest', (req: Request, res: Response) => {
  const run = ScheduleRunStore.getLatest(param(req.params.id))
  return res.json({ code: 0, data: run ? runToDTO(run) : null })
})

/** GET /api/schedules/:id/runs — 运行历史 */
router.get('/:id/runs', (req: Request, res: Response) => {
  const parsed = RunsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid query') })
  }
  const runs = ScheduleRunStore.listBySchedule(param(req.params.id), parsed.data)
  return res.json({ code: 0, data: runs.map(runToDTO) })
})

export default router
