import type { RolloutEvent } from 'roxy-agent-runtime'
import type { FileHandle } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { mkdir, open } from 'node:fs/promises'
import path from 'node:path'

export const MEMORY_INDEX_MAX_ENTRIES = 200
export const MEMORY_INDEX_MAX_BYTES = 25 * 1024
export const MEMORY_INDEX_TITLE = '# Roxy Agent Memory Index\n'

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function limitIndexEntries(content: string): string {
  const lines = content.split('\n')
  const kept: string[] = []
  let entries = 0

  for (const line of lines) {
    const isEntry = line.startsWith('- [')
    if (isEntry && entries >= MEMORY_INDEX_MAX_ENTRIES) {
      break
    }

    kept.push(line)
    if (isEntry) {
      entries++
      if (entries >= MEMORY_INDEX_MAX_ENTRIES) {
        break
      }
    }
  }

  return kept.join('\n')
}

async function readBoundedPrefix(filePath: string): Promise<string | undefined> {
  let handle: FileHandle
  try {
    handle = await open(filePath, 'r')
  }
  catch (error) {
    if (isMissingFile(error)) {
      return undefined
    }
    throw error
  }

  try {
    const info = await handle.stat()
    const length = Math.min(info.size, MEMORY_INDEX_MAX_BYTES)
    if (length === 0) {
      return ''
    }

    const buffer = Buffer.alloc(length)
    let bytesRead = 0
    while (bytesRead < length) {
      const result = await handle.read(buffer, bytesRead, length - bytesRead, bytesRead)
      if (result.bytesRead === 0) {
        break
      }
      bytesRead += result.bytesRead
    }
    let content = buffer.subarray(0, bytesRead).toString('utf8')

    // A byte-bounded read can end inside a UTF-8 code point or Markdown item.
    // Keep only complete lines when more file content remains on disk.
    if (info.size > bytesRead && !content.endsWith('\n')) {
      const lastNewline = content.lastIndexOf('\n')
      content = lastNewline >= 0 ? content.slice(0, lastNewline + 1) : ''
    }

    return content
  }
  finally {
    await handle.close()
  }
}

export async function ensureMemoryDirectory(memoryDir: string): Promise<void> {
  await mkdir(memoryDir, { recursive: true })
}

/** Create the agent-owned index once without overwriting an existing user file. */
export async function ensureMemoryIndex(indexFile: string): Promise<void> {
  await ensureMemoryDirectory(path.dirname(indexFile))
  let handle: FileHandle | undefined
  try {
    handle = await open(indexFile, 'wx')
    await handle.writeFile(MEMORY_INDEX_TITLE, 'utf8')
  }
  catch (error) {
    if (!isMissingFile(error) && !(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
  finally {
    await handle?.close()
  }
}

function hasIndexEntries(content: string): boolean {
  return content.split('\n').some(line => line.startsWith('- ['))
}

/** Read the agent-owned index without rewriting it, bounded only for model context. */
export async function loadMemoryIndex(indexFile: string): Promise<string | undefined> {
  await ensureMemoryIndex(indexFile)
  const content = await readBoundedPrefix(indexFile)
  if (!content?.trim() || !hasIndexEntries(content)) {
    return ''
  }
  return limitIndexEntries(content)
}

/** A session remains new until its rollout contains one user-visible request. */
export function shouldLoadMemoryIndex(events: readonly RolloutEvent[]): boolean {
  return !events.some(event => event.type === 'user_input' && event.message.visible !== false)
}
