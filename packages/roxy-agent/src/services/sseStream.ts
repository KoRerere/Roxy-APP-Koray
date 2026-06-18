import type { Response } from 'express'
import path from 'node:path'
import { env } from '../config'

/**
 * 设置 SSE 响应头并 flush（chat / image 两条流式链路逐字相同的初始化）。
 */
export function initSSEHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
}

/**
 * 生成 assistant 消息的 SSE 落盘文件名与路径。
 */
export function resolveSSEFilePath() {
  const fileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const sseFilePath = path.join(env.CHECKPOINT_DIR!, 'sse', `${fileName}.sse`)
  return { fileName, sseFilePath }
}

/**
 * 构造写 res + log + flush 的 streamCallback。
 * - `onEvent` 钩子：解析每个 SSE data 行后回调（chat 用它检测 `orchestrator_stopped`）。
 */
export function createStreamCallback(
  res: Response,
  sseLogger: { log: (event: string) => void },
  options: { onEvent?: (parsed: any) => void } = {},
) {
  return (event: any) => {
    res.write(event)
    sseLogger.log(event)

    if (options.onEvent) {
      try {
        const matched = typeof event === 'string' ? event.match(/^data: (.*)$/m) : null
        const parsed = matched?.[1] ? JSON.parse(matched[1]) : null
        if (parsed) {
          options.onEvent(parsed)
        }
      }
      catch {
        // Ignore malformed diagnostic data; the SSE event was already written.
      }
    }

    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }
}
