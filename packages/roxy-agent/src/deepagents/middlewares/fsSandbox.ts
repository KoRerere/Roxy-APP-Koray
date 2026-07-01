import type { FileCollectorStore } from '../fileCollector'
import { ToolMessage } from '@langchain/core/messages'
import { createMiddleware } from 'langchain'
import fs from 'node:fs'
import path from 'node:path'

function resolveVirtualPath(workspaceDir: string, filePath: string): string | undefined {
  const vpath = filePath.startsWith('/') ? filePath : `/${filePath}`
  if (vpath.includes('..') || vpath.startsWith('~'))
    return undefined

  const full = path.resolve(workspaceDir, vpath.substring(1))
  const relative = path.relative(workspaceDir, full)
  if (relative.startsWith('..') || path.isAbsolute(relative))
    return undefined

  return full
}

function isSuccessfulToolMessage(result: unknown): boolean {
  if (!ToolMessage.isInstance(result))
    return false

  const content = result.content
  if (typeof content !== 'string')
    return false

  return content.startsWith('Successfully wrote to ')
    || content.startsWith('Successfully replaced ')
}

export function createFsSandboxMiddleware(options: {
  store: FileCollectorStore
  workspaceDir: string
}) {
  return createMiddleware({
    name: 'FsSandboxMiddleware',
    wrapToolCall: async (request: any, handler: any) => {
      const result = await handler(request)
      const toolName = request.tool?.name ?? request.toolCall?.name
      if (toolName !== 'write_file' && toolName !== 'edit_file')
        return result

      if (!isSuccessfulToolMessage(result))
        return result

      const filePath = request.toolCall?.args?.file_path
      if (typeof filePath !== 'string' || !filePath)
        return result

      const realPath = resolveVirtualPath(options.workspaceDir, filePath)
      if (!realPath)
        return result

      try {
        if (!fs.statSync(realPath).isFile())
          return result
      }
      catch {
        return result
      }

      const virtualPath = filePath.startsWith('/') ? filePath : `/${filePath}`
      options.store.record({
        virtualPath,
        realPath,
        op: toolName === 'write_file' ? 'write' : 'edit',
      })

      return result
    },
  })
}
