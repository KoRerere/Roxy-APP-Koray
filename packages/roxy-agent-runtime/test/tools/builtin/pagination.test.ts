/**
 * Pagination tests for glob and grep tools.
 * Verifies max_results / offset slicing, footer content, and edge cases.
 */
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { globTool } from '../../../src/tools/builtin/glob.ts'
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

/** Create N files named file_000.ts … file_N-1.ts */
async function makeFiles(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    const name = `file_${String(i).padStart(3, '0')}.ts`
    await writeFile(join(tmpDir, name), `// file ${i}\nexport const x${i} = ${i};\n`)
  }
}

/** Create M files each containing N lines that match "needle" */
async function makeGrepFiles(files: number, matchesPerFile: number): Promise<void> {
  for (let f = 0; f < files; f++) {
    const lines = Array.from({ length: matchesPerFile }, (_, i) => `needle match ${f}_${i}`)
    await writeFile(join(tmpDir, `f${f}.txt`), lines.join('\n') + '\n')
  }
}

// ── glob pagination ──────────────────────────────────────────────────────────

describe('glob — pagination', () => {
  it('max_results limits returned entries', async () => {
    await makeFiles(20)
    const tool = globTool()
    const res = await tool.handler({ pattern: '*.ts', cwd: tmpDir, max_results: 5 }, ctx())
    expect(res.isError).toBe(false)
    const lines = res.content.split('\n').filter((l) => l && !l.startsWith('('))
    expect(lines.length).toBe(5)
  })

  it('offset skips the first N entries', async () => {
    await makeFiles(10)
    const tool = globTool()
    const page1 = await tool.handler({ pattern: '*.ts', cwd: tmpDir, max_results: 3, offset: 0 }, ctx())
    const page2 = await tool.handler({ pattern: '*.ts', cwd: tmpDir, max_results: 3, offset: 3 }, ctx())
    const lines1 = page1.content.split('\n').filter((l) => l && !l.startsWith('('))
    const lines2 = page2.content.split('\n').filter((l) => l && !l.startsWith('('))
    // No overlap
    expect(lines1.some((l) => lines2.includes(l))).toBe(false)
    // Together cover 6 distinct files
    expect(new Set([...lines1, ...lines2]).size).toBe(6)
  })

  it('footer reports total count and next-page hint when more results exist', async () => {
    await makeFiles(10)
    const tool = globTool()
    const res = await tool.handler({ pattern: '*.ts', cwd: tmpDir, max_results: 4, offset: 0 }, ctx())
    expect(res.content).toMatch(/10/) // total
    expect(res.content).toMatch(/offset=4/) // next-page hint
  })

  it('no footer when all results fit on one page', async () => {
    await makeFiles(3)
    const tool = globTool()
    const res = await tool.handler({ pattern: '*.ts', cwd: tmpDir, max_results: 10 }, ctx())
    expect(res.content).not.toContain('offset=')
  })

  it('offset beyond total returns empty with footer', async () => {
    await makeFiles(3)
    const tool = globTool()
    const res = await tool.handler({ pattern: '*.ts', cwd: tmpDir, max_results: 10, offset: 100 }, ctx())
    expect(res.isError).toBe(false)
    expect(res.content).toContain('3') // total still reported
  })
})

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
