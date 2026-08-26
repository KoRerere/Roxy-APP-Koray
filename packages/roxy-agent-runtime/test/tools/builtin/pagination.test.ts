/**
 * Pagination tests for grep.
 * Verifies max_results / offset slicing, footer content, and edge cases.
 */
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { grepTool } from '../../../src/tools/builtin/grep.ts'

function ctx() {
  return { agentId: 'a', traceId: 't1', signal: new AbortController().signal }
}

// ── fixture helpers ─────────────────────────────────────────────────────────

let tmpDir = ''

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'roxy-pagination-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

/** Create M files each containing N lines that match "needle" */
async function makeGrepFiles(files: number, matchesPerFile: number): Promise<void> {
  for (let f = 0; f < files; f++) {
    const lines = Array.from({ length: matchesPerFile }, (_, i) => `needle match ${f}_${i}`)
    await writeFile(join(tmpDir, `f${f}.txt`), lines.join('\n') + '\n')
  }
}

// ── grep pagination ──────────────────────────────────────────────────────────

describe('grep — pagination', () => {
  it('max_results limits returned matches in content mode', async () => {
    await makeGrepFiles(5, 4) // 20 total matches
    const tool = grepTool()
    const res = await tool.handler({ pattern: 'needle', path: tmpDir, max_results: 6 }, ctx())
    expect(res.isError).toBe(false)
    const matchLines = res.content.split('\n').filter((l) => l.includes('needle'))
    expect(matchLines.length).toBeLessThanOrEqual(6)
  })

  it('offset advances past the first N matches', async () => {
    await makeGrepFiles(1, 10) // 10 matches in one file
    const tool = grepTool()
    const p1 = await tool.handler({ pattern: 'needle', path: tmpDir, max_results: 3, offset: 0 }, ctx())
    const p2 = await tool.handler({ pattern: 'needle', path: tmpDir, max_results: 3, offset: 3 }, ctx())
    const nums1 = (p1.content.match(/(\d+):/g) ?? []).map((m) => parseInt(m, 10))
    const nums2 = (p2.content.match(/(\d+):/g) ?? []).map((m) => parseInt(m, 10))
    // page2 line-numbers must be strictly greater than page1 (sorted file, sequential lines)
    expect(Math.min(...nums2)).toBeGreaterThan(Math.max(...nums1))
  })

  it('footer reports total matches and next-page hint', async () => {
    await makeGrepFiles(3, 4) // 12 total matches
    const tool = grepTool()
    const res = await tool.handler({ pattern: 'needle', path: tmpDir, max_results: 5, offset: 0 }, ctx())
    expect(res.content).toMatch(/offset=5/)
  })

  it('no footer when all matches fit', async () => {
    await makeGrepFiles(1, 3)
    const tool = grepTool()
    const res = await tool.handler({ pattern: 'needle', path: tmpDir, max_results: 50 }, ctx())
    expect(res.content).not.toContain('offset=')
  })

  it('files_with_matches mode paginates over files, not lines', async () => {
    await makeGrepFiles(8, 2) // 8 files each with 2 matches
    const tool = grepTool()
    const res = await tool.handler(
      {
        pattern: 'needle',
        path: tmpDir,
        output_mode: 'files_with_matches',
        max_results: 3,
        offset: 0,
      },
      ctx(),
    )
    const fileLines = res.content.split('\n').filter((l) => l.endsWith('.txt'))
    expect(fileLines.length).toBe(3)
    expect(res.content).toMatch(/offset=3/)
  })
})
