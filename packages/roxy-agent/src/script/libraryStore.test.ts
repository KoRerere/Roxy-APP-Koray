import assert from 'node:assert/strict'
import fs, { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it, vi } from 'vitest'

it('extracts library script metadata statically without evaluating top-level code', async () => {
  const scriptDir = mkdtempSync(path.join(os.tmpdir(), 'roxy-agent-library-test-'))
  fs.mkdirSync(scriptDir, { recursive: true })
  fs.writeFileSync(path.join(scriptDir, 'static-meta.ts'), `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

type Params = { searchQuery: string }

defineMetadata({ name: 'Static metadata', description: 'Read without running' })
defineParams({
  type: 'object',
  properties: {
    searchQuery: { type: 'string' },
  },
  required: ['searchQuery'],
})

throw new Error('top-level code must not run')

export async function main(params: Params): Promise<void> {
  console.log(params.searchQuery)
}
`, 'utf-8')

  try {
    vi.resetModules()
    vi.doMock('@/core/storage/agentPaths', () => ({
      agentPaths: {
        scriptsRoot: scriptDir,
        scriptFile: (slug: string) => path.join(scriptDir, `${slug}.ts`),
      },
    }))

    const { LibraryStore } = await import('./libraryStore')
    const script = LibraryStore.get('static-meta')

    assert.equal(script?.name, 'Static metadata')
    assert.equal(script?.description, 'Read without running')
  }
  finally {
    vi.doUnmock('@/core/storage/agentPaths')
    rmSync(scriptDir, { recursive: true, force: true })
  }
})
