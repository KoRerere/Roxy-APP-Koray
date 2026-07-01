import type { Request, Response } from 'express'
import { Router } from 'express'
import fsPromises from 'node:fs/promises'
import { z } from 'zod'
import { recordingManager, runRecordingProcessing, runRecordingRetry } from '@/recording'

const router: Router = Router()

const StartSchema = z.object({
  conversationId: z.string({ error: 'conversationId is required' }),
})

const StopSchema = z.object({
  conversationId: z.string({ error: 'conversationId is required' }),
})

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback
}

router.post('/start', async (req: Request, res: Response) => {
  const parsed = StartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({
      code: 1,
      msg: firstIssue(parsed.error, 'conversationId is required'),
    })
  }

  const { conversationId } = parsed.data

  try {
    const session = await recordingManager.start(conversationId)
    return res.json({
      code: 0,
      msg: 'Recording started',
      data: {
        recordingId: session.id,
        conversationId: session.conversationId,
        status: session.status,
        createdAt: session.createdAt,
      },
    })
  }
  catch (err: any) {
    console.error('[Recording API] Failed to start recording:', err.message)
    return res.json({
      code: 1,
      msg: `Failed to start recording: ${err.message}`,
    })
  }
})

router.post('/stop', async (req: Request, res: Response) => {
  const parsed = StopSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({
      code: 1,
      msg: firstIssue(parsed.error, 'conversationId is required'),
    })
  }

  const { conversationId } = parsed.data
  const session = recordingManager.stop(conversationId)

  if (!session) {
    return res.json({
      code: 1,
      msg: 'No active recording found for this conversation',
    })
  }

  if (session.status === 'done' || session.status === 'failed') {
    return res.json({
      code: 1,
      msg: `Recording already in status: ${session.status}`,
    })
  }

  res.json({
    code: 0,
    msg: 'Recording stopped, processing started',
    data: {
      recordingId: session.id,
      conversationId: session.conversationId,
      status: session.status,
      eventCount: session.eventSeq,
    },
  })

  const signal = recordingManager.getAbortSignal(conversationId)
  runRecordingProcessing(session, conversationId, signal).catch((err: any) => {
    console.error('[Recording API] Background processing error:', err.message)
  })
})

router.get('/status/:conversationId', async (req: Request, res: Response) => {
  const conversationId = Array.isArray(req.params.conversationId)
    ? req.params.conversationId[0]
    : req.params.conversationId

  const session = recordingManager.getSession(conversationId)

  if (!session) {
    return res.json({
      code: 0,
      data: null,
    })
  }

  let finalScript: string | undefined
  if (session.status === 'done' && session.finalScriptPath) {
    try {
      finalScript = await fsPromises.readFile(session.finalScriptPath, 'utf-8')
    }
    catch {
      finalScript = undefined
    }
  }

  return res.json({
    code: 0,
    data: {
      recordingId: session.id,
      conversationId: session.conversationId,
      status: session.status,
      phase: session.phase,
      primaryDirId: session.primaryDirId,
      eventCount: session.eventSeq,
      createdAt: session.createdAt,
      stoppedAt: session.stoppedAt,
      completedAt: session.completedAt,
      finalScriptPath: session.finalScriptPath,
      finalScript,
      finalScriptFileId: session.finalScriptFileId,
      finalScriptOssUrl: session.finalScriptOssUrl,
      errorMessage: session.errorMessage,
    },
  })
})

router.post('/cancel', async (req: Request, res: Response) => {
  const parsed = StopSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({
      code: 1,
      msg: firstIssue(parsed.error, 'conversationId is required'),
    })
  }

  const { conversationId } = parsed.data
  const session = recordingManager.getSession(conversationId)

  if (!session) {
    return res.json({
      code: 1,
      msg: 'No recording session found for this conversation',
    })
  }

  if (session.status !== 'processing') {
    return res.json({
      code: 1,
      msg: `Cannot cancel recording in status: ${session.status}`,
    })
  }

  const cancelled = recordingManager.cancelProcessing(conversationId)
  if (!cancelled) {
    return res.json({
      code: 1,
      msg: 'No active processing to cancel',
    })
  }

  return res.json({
    code: 0,
    msg: 'Recording generation cancelled',
    data: {
      recordingId: session.id,
      conversationId: session.conversationId,
      status: 'cancelled',
    },
  })
})

router.post('/retry', async (req: Request, res: Response) => {
  const parsed = StopSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({
      code: 1,
      msg: firstIssue(parsed.error, 'conversationId is required'),
    })
  }

  const { conversationId } = parsed.data
  const session = recordingManager.getSession(conversationId)

  if (!session) {
    return res.json({
      code: 1,
      msg: 'No recording session found for this conversation',
    })
  }

  if (session.status !== 'cancelled' && session.status !== 'failed' && session.status !== 'done') {
    return res.json({
      code: 1,
      msg: `Cannot retry recording in status: ${session.status}`,
    })
  }

  const retried = recordingManager.retryProcessing(conversationId)
  if (!retried) {
    return res.json({
      code: 1,
      msg: 'Failed to retry recording processing',
    })
  }

  res.json({
    code: 0,
    msg: 'Recording generation retry started',
    data: {
      recordingId: retried.id,
      conversationId: retried.conversationId,
      status: retried.status,
    },
  })

  const signal = recordingManager.getAbortSignal(conversationId)
  runRecordingRetry(retried, conversationId, signal).catch((err: any) => {
    console.error('[Recording API] Background retry processing error:', err.message)
  })
})

export default router
