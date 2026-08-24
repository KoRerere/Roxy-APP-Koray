import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { AiAgentHttpError } from '@/api/errors'
import { t } from '@/core/i18n'
import {
  deleteTaskLog,
  replayTaskExecution,
  runTaskNow,
  stopTaskLog,
  syncTasks,
} from '@/services/taskService'

const router: Router = Router()

const TaskIdSchema = z.coerce.number().int().positive()
const LogIdSchema = z.string().min(1)

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value
}

function errorResponse(res: Response, error: unknown, message: string) {
  console.error('[taskRoutes] request failed:', error)
  if (error instanceof AiAgentHttpError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502
    return res.status(status).json({ code: 1, msg: message })
  }
  return res.status(500).json({ code: 1, msg: message })
}

router.get('/logs/:logId/replay', (req: Request, res: Response) => {
  const logId = LogIdSchema.safeParse(param(req.params.logId))
  if (!logId.success) {
    return res.status(400).json({ code: 1, msg: t('任务日志参数不正确') })
  }

  try {
    const replay = replayTaskExecution(logId.data)
    if (!replay) {
      return res.status(404).json({ code: 1, msg: t('未找到任务日志') })
    }

    return res.json({ code: 0, data: replay })
  }
  catch (error) {
    return errorResponse(res, error, t('加载任务执行详情失败，请稍后重试'))
  }
})

router.post('/logs/:logId/stop', (req: Request, res: Response) => {
  const parsed = LogIdSchema.safeParse(param(req.params.logId))
  if (!parsed.success) {
    return res.status(400).json({ code: 1, msg: t('任务日志 ID 不正确') })
  }
  try {
    const result = stopTaskLog(parsed.data)
    if (result === 'not_found') {
      return res.status(404).json({ code: 1, msg: t('未找到任务日志') })
    }
    if (result === 'not_active') {
      return res.status(409).json({ code: 1, msg: t('任务已经结束，无法停止') })
    }
    return res.status(202).json({ code: 0, data: { stopping: true } })
  }
  catch (error) {
    return errorResponse(res, error, t('停止任务失败，请稍后重试'))
  }
})

router.delete('/logs/:logId', (req: Request, res: Response) => {
  const parsed = LogIdSchema.safeParse(param(req.params.logId))
  if (!parsed.success) {
    return res.status(400).json({ code: 1, msg: t('任务日志 ID 不正确') })
  }
  try {
    const result = deleteTaskLog(parsed.data)
    if (result === 'not_found') {
      return res.status(404).json({ code: 1, msg: t('未找到任务日志') })
    }
    if (result === 'active') {
      return res.status(409).json({ code: 1, msg: t('请先停止正在执行的任务') })
    }
    return res.json({ code: 0, data: { deleted: true } })
  }
  catch (error) {
    return errorResponse(res, error, t('删除任务记录失败，请稍后重试'))
  }
})

router.post('/sync', async (_req: Request, res: Response) => {
  try {
    return res.json({ code: 0, data: await syncTasks() })
  }
  catch (error) {
    return errorResponse(res, error, t('同步任务失败，请稍后重试'))
  }
})

router.post('/:taskId/run', async (req: Request, res: Response) => {
  const parsed = TaskIdSchema.safeParse(param(req.params.taskId))
  if (!parsed.success) {
    return res.status(400).json({ code: 1, msg: t('任务 ID 不正确') })
  }
  try {
    const log = await runTaskNow(parsed.data)
    return res.status(202).json({
      code: 0,
      data: { logId: log.id, status: log.status },
    })
  }
  catch (error) {
    return errorResponse(res, error, t('启动任务失败，请稍后重试'))
  }
})

export default router
