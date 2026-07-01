import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { ScriptStore } from '@/database/conversations'
import {
  deleteScriptCascade,
  getOccupiedDirIds,
  getRunStatus,
  startScriptRun,
  stopScriptRun,
  subscribeScriptRun,
  syncScriptsFromBackend,
  updateScriptCascade,
} from '@/services/scriptService'

const router: Router = Router()

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback
}

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p
}

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  // 为 true 时先从后端拉取并合并本地脚本，再返回本地列表（前端打开「自动化脚本」页面时传 true）
  sync: z.coerce.boolean().optional(),
})

const StartRunSchema = z.object({
  scriptName: z.string({ error: 'scriptName is required' }),
  scriptUrl: z.string({ error: 'scriptUrl is required' }),
  dirId: z.string({ error: 'dirId is required' }),
})

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

const RunSchema = z.object({
  dirId: z.string().optional(),
})

/** GET /api/scripts/run/occupied — 返回当前被占用的 dirId 列表 */
router.get('/run/occupied', (_req: Request, res: Response) => {
  res.json({ code: 0, data: getOccupiedDirIds() })
})

/** POST /api/scripts/run — 打开浏览器并在 sandbox 中启动脚本 */
router.post('/run', async (req: Request, res: Response) => {
  const parsed = StartRunSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })
  }

  const { scriptName, scriptUrl, dirId } = parsed.data

  try {
    const result = await startScriptRun({ scriptName, scriptUrl, dirId })
    return res.json({ code: 0, data: result })
  }
  catch (err: any) {
    console.error('[scriptRoutes] startScriptRun failed:', err.message)
    return res.json({ code: 1, msg: err.message })
  }
})

/** GET /api/scripts/run/:runId/status — SSE 流，推送运行日志和完成事件 */
router.get('/run/:runId/status', (req: Request, res: Response) => {
  const runId = param(req.params.runId)

  const found = subscribeScriptRun(runId, res)
  if (!found) {
    res.status(404).json({ code: 1, msg: `Run ${runId} not found` })
  }
})

/** GET /api/scripts/run/:runId — 获取运行结果快照（非 SSE） */
router.get('/run/:runId', (req: Request, res: Response) => {
  const runId = param(req.params.runId)
  const status = getRunStatus(runId)
  if (!status) {
    return res.json({ code: 1, msg: `Run ${runId} not found` })
  }
  res.json({ code: 0, data: status })
})

/** POST /api/scripts/run/:runId/stop — 中止运行中的脚本 */
router.post('/run/:runId/stop', (req: Request, res: Response) => {
  const runId = param(req.params.runId)
  const stopped = stopScriptRun(runId)
  if (!stopped) {
    return res.json({ code: 1, msg: `Run ${runId} not found or already finished` })
  }
  res.json({ code: 0, msg: 'Stop signal sent' })
})

/** GET /api/scripts — 列出脚本（sync=true 时先从后端同步合并本地，再返回本地列表） */
router.get('/', async (req: Request, res: Response) => {
  const parsed = PaginationSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid query') })
  }

  let syncError: string | null = null
  if (parsed.data.sync) {
    try {
      const result = await syncScriptsFromBackend()
      if (result.error)
        syncError = result.error
    }
    catch (err: any) {
      console.warn('[scriptRoutes] syncScriptsFromBackend failed:', err?.message)
      syncError = err?.message || '同步失败'
    }
  }

  const rows = ScriptStore.list(parsed.data)
  const items = rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    conversationId: r.conversation_id ?? null,
    dirId: r.dir_id ?? null,
    source: r.source,
    ossUrl: r.oss_url ?? null,
    fileName: r.file_name ?? null,
    size: r.size ?? null,
    createdAt: r.created_at,
    runnable: Boolean(r.oss_url || r.local_path),
  }))
  return res.json({ code: 0, data: { rows: items, syncError } })
})

/** GET /api/scripts/:id — 脚本详情 */
router.get('/:id', (req: Request, res: Response) => {
  const id = param(req.params.id)
  const rec = ScriptStore.getById(id)
  if (!rec) {
    return res.json({ code: 1, msg: `Script ${id} not found` })
  }
  return res.json({
    code: 0,
    data: {
      id: rec.id,
      name: rec.name,
      description: rec.description ?? null,
      conversationId: rec.conversation_id ?? null,
      dirId: rec.dir_id ?? null,
      source: rec.source,
      ossUrl: rec.oss_url ?? null,
      fileName: rec.file_name ?? null,
      size: rec.size ?? null,
      createdAt: rec.created_at,
    },
  })
})

/** PUT /api/scripts/:id — 重命名/改描述 */
router.put('/:id', async (req: Request, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })
  }

  const id = param(req.params.id)
  const result = await updateScriptCascade(id, parsed.data)
  if (!result.ok) {
    return res.json({ code: 1, msg: result.msg || `Script ${id} not found` })
  }
  const rec = ScriptStore.getById(id)
  return res.json({
    code: 0,
    data: rec
      ? {
          id: rec.id,
          name: rec.name,
          description: rec.description ?? null,
          conversationId: rec.conversation_id ?? null,
          source: rec.source,
          createdAt: rec.created_at,
        }
      : null,
  })
})

/** DELETE /api/scripts/:id — 级联删除：先删后端（云端为真相源）再删本地，避免同步时「复活」 */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = param(req.params.id)
  const result = await deleteScriptCascade(id)
  if (!result.ok) {
    return res.json({ code: 1, msg: result.msg || `Script ${id} not found` })
  }
  return res.json({ code: 0, data: null })
})

/** POST /api/scripts/:id/run — 按 id 解析 file 后委托 scriptRunService */
router.post('/:id/run', async (req: Request, res: Response) => {
  const parsed = RunSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })
  }

  const id = param(req.params.id)
  const rec = ScriptStore.getById(id)
  if (!rec) {
    return res.json({ code: 1, msg: `Script ${id} not found` })
  }

  const scriptUrl = rec.oss_url || rec.local_path
  if (!scriptUrl) {
    return res.json({ code: 1, msg: 'script file missing' })
  }

  const dirId = parsed.data.dirId || rec.dir_id || undefined
  if (!dirId) {
    return res.json({ code: 1, msg: '请选择浏览器窗口' })
  }

  try {
    const result = await startScriptRun({
      scriptName: rec.name,
      scriptUrl,
      dirId,
    })
    ScriptStore.updateDirId(id, dirId)
    return res.json({ code: 0, data: result })
  }
  catch (err: any) {
    console.error('[scriptRoutes] startScriptRun failed:', err.message)
    return res.json({ code: 1, msg: err.message })
  }
})

export default router
