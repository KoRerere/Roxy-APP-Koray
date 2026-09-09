import type { RolloutEvent } from 'roxy-agent-runtime'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadMemoryIndex,
  MEMORY_INDEX_MAX_BYTES,
  MEMORY_INDEX_MAX_ENTRIES,
  shouldLoadMemoryIndex,
} from './memory-index'

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-memory-index-'))
  try {
    await run(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

function indexEntry(index: number, description = `Memory description ${index}`): string {
  return `- [Memory summary ${index}](memory-${index}.md) - ${description}`
}

describe('memory index loading', () => {
  it('initializes a missing MEMORY.md with the default title and treats it as empty', async () => {
    // Regression: a new agent session had no MEMORY.md, so the model could not
    // distinguish an empty index from a missing memory subsystem.
    // Fixed by: initialization creates the default index title and the loader
    // returns an explicit empty-index snapshot.
    await withTempDir(async (root) => {
      const indexFile = path.join(root, 'memory', 'MEMORY.md')

      await expect(loadMemoryIndex(indexFile)).resolves.toBe('')
      await expect(readFile(indexFile, 'utf8')).resolves.toBe('# Roxy Agent Memory Index\n')
    })
  })

  it('treats a title-only MEMORY.md as an empty index', async () => {
    await withTempDir(async (root) => {
      const indexFile = path.join(root, 'memory', 'MEMORY.md')
      await mkdir(path.dirname(indexFile), { recursive: true })
      await writeFile(indexFile, '# Roxy Agent Memory Index\n', 'utf8')

      await expect(loadMemoryIndex(indexFile)).resolves.toBe('')
    })
  })

  it('loads only the first 200 index entries and never rewrites the source file', async () => {
    // Regression: enforcing the old quota during writes either rejected or
    // programmatically regenerated an agent-owned index.
    // Fixed by: loading applies a bounded view while leaving the full file untouched.
    await withTempDir(async (root) => {
      const indexFile = path.join(root, 'memory', 'MEMORY.md')
      const entries = Array.from({ length: MEMORY_INDEX_MAX_ENTRIES + 5 }, (_, index) => indexEntry(index + 1))
      const source = `# Roxy Agent Memory Index\n\n${entries.join('\n')}\n`
      await mkdir(path.dirname(indexFile), { recursive: true })
      await writeFile(indexFile, source, 'utf8')

      const loaded = await loadMemoryIndex(indexFile)

      expect(loaded).toContain(indexEntry(1))
      expect(loaded).toContain(indexEntry(MEMORY_INDEX_MAX_ENTRIES))
      expect(loaded).not.toContain(indexEntry(MEMORY_INDEX_MAX_ENTRIES + 1))
      expect((loaded?.match(/^- \[/gm) ?? [])).toHaveLength(MEMORY_INDEX_MAX_ENTRIES)
      await expect(readFile(indexFile, 'utf8')).resolves.toBe(source)
    })
  })

  it('caps loaded UTF-8 content at 25 KiB without returning a partial line', async () => {
    // Regression: reading an unbounded index could consume arbitrary memory,
    // while byte slicing could split a multibyte character or Markdown link.
    // Fixed by: the loader reads a bounded prefix and drops an incomplete trailing line.
    await withTempDir(async (root) => {
      const indexFile = path.join(root, 'memory', 'MEMORY.md')
      const entries = Array.from(
        { length: MEMORY_INDEX_MAX_ENTRIES },
        (_, index) => indexEntry(index + 1, `权威记忆描述-${index + 1}-${'细节'.repeat(120)}`),
      )
      await mkdir(path.dirname(indexFile), { recursive: true })
      await writeFile(indexFile, `# Roxy Agent Memory Index\n\n${entries.join('\n')}\n`, 'utf8')

      const loaded = await loadMemoryIndex(indexFile)

      expect(Buffer.byteLength(loaded ?? '', 'utf8')).toBeLessThanOrEqual(MEMORY_INDEX_MAX_BYTES)
      expect(loaded).not.toContain('\uFFFD')
      expect(loaded?.endsWith('\n')).toBe(true)
      for (const line of loaded?.split('\n').filter(line => line.startsWith('- [')) ?? []) {
        expect(line).toMatch(/\.md\) - 权威记忆描述-\d+-细节/)
      }
    })
  })

  it('loads memory only before the first visible user input', () => {
    // Regression: using session_start alone skipped memory after an agent was
    // assembled but failed before it accepted a real user turn.
    // Fixed by: hidden context does not close the first-turn window; a visible user input does.
    const sessionOnly: RolloutEvent[] = [
      { type: 'session_start', sessionId: 'session-1', createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: '<metadata />', visible: false } },
    ]
    const withUser: RolloutEvent[] = [
      ...sessionOnly,
      { type: 'user_input', message: { role: 'user', content: 'real request' } },
    ]

    expect(shouldLoadMemoryIndex(sessionOnly)).toBe(true)
    expect(shouldLoadMemoryIndex(withUser)).toBe(false)
    expect(shouldLoadMemoryIndex([
      ...sessionOnly,
      { type: 'user_input', message: { role: 'user', content: 'received', metadata: { turnId: 'turn-1' } } },
    ], 'turn-1')).toBe(true)
    expect(shouldLoadMemoryIndex([
      ...withUser,
      { type: 'user_input', message: { role: 'user', content: 'received', metadata: { turnId: 'turn-1' } } },
    ], 'turn-1')).toBe(false)
  })
})
