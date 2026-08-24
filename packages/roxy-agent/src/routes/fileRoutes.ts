import type { Request, Response } from 'express'
import { Router } from 'express'
import path from 'node:path'
import { z } from 'zod'
import * as chatService from '@/services/chatService'
import * as fileService from '@/services/fileService'

const router: Router = Router()

const UploadSchema = z.object({
  data: z.string({ error: 'data, mimeType and fileName are required' }),
  mimeType: z.string({ error: 'data, mimeType and fileName are required' }),
  fileName: z.string({ error: 'data, mimeType and fileName are required' }),
  conversationId: z.string().optional(),
})

function toContentDisposition(fileName: string, disposition: 'inline' | 'attachment') {
  const fallback = fileName.replace(/[^\w.-]+/g, '_') || 'download'
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

// 上传附件文件
router.post('/upload', async (req: Request, res: Response) => {
  const parsed = UploadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: parsed.error.issues[0]?.message ?? 'data, mimeType and fileName are required' })
  }
  try {
    if (parsed.data.conversationId && !chatService.getConversation(parsed.data.conversationId)) {
      return res.json({ code: 1, msg: 'conversation not found', error: 'conversation not found' })
    }
    const data = await fileService.saveUpload(parsed.data)
    res.json({
      code: 0,
      msg: 'File uploaded successfully',
      data,
    })
  }
  catch (error: any) {
    console.error('Error uploading file:', error)
    res.json({ code: 1, msg: error.message || 'Failed to upload file', error: error.message })
  }
})

// 提供附件文件访问
router.get('/files/:fileId', (req: Request, res: Response) => {
  try {
    const fileId = Array.isArray(req.params.fileId)
      ? req.params.fileId[0]
      : req.params.fileId
    if (!fileId) {
      return res.status(400).json({ code: 1, msg: 'File ID is required' })
    }

    const resolved = fileService.resolveServeFile(fileId)
    if (!resolved.ok) {
      return res.status(resolved.status).json({ code: 1, msg: resolved.msg })
    }

    // 去重条目的物理文件名可能与 fileId 不同，按真实 local_path 发送
    return res.sendFile(path.basename(resolved.filePath), {
      root: path.dirname(resolved.filePath),
      headers: {
        'Content-Type': resolved.mimeType,
        'Content-Disposition': toContentDisposition(
          typeof req.query.filename === 'string' && req.query.filename ? req.query.filename : resolved.fileName,
          req.query.download === '1' ? 'attachment' : 'inline',
        ),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }, (error) => {
      if (!error) {
        return
      }

      console.error('Error sending file:', error)
      if (!res.headersSent) {
        const sendError = error as Error & { statusCode?: number }
        res.status(sendError.statusCode || 500).json({
          code: 1,
          msg: 'Failed to serve file',
          error: sendError.message,
        })
      }
    })
  }
  catch (error: any) {
    console.error('Error serving file:', error)
    return res.status(500).json({ code: 1, msg: 'Failed to serve file', error: error.message })
  }
})

export default router
