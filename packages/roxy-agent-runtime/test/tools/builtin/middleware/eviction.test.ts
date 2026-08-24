import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEvictionMiddleware } from '../../../../src/tools/builtin/middleware/eviction.ts'
import type { ToolMiddlewareContext, ToolResult } from '../../../../src/core/interfaces.ts'

function ctx(toolUseId = 'tu_1', sessionId = 's1'): ToolMiddlewareContext {
  return {
    agentId: 'a',
    sessionId,
    traceId: 't',
    toolName: 'read_file',
    toolSource: 'builtin',
    toolUseId,
    callIndex: 0,
  }
}

function result(content: string, isError = false, toolUseId = 'tu_1'): ToolResult {
  return { toolUseId, content, isError }
}

function tmpScratch() {
  return mkdtempSync(join(tmpdir(), 'roxy-evict-'))
}

describe('eviction middleware', () => {
  it('passes small results through unchanged (no file written)', async () => {
    const scratch = tmpScratch()
    const mw = createEvictionMiddleware({ scratchDir: scratch, maxChars: 1000 })
    const small = result('hello world', false, 'tu_small')
    const out = await mw.after!(small, ctx('tu_small'))
    expect(out).toEqual(small)
    expect(existsSync(join(scratch, 'tu_small.txt'))).toBe(false)
  })

  it('evicts a large result: writes file + returns preview snippet', async () => {
    const scratch = tmpScratch()
    const mw = createEvictionMiddleware({ scratchDir: scratch, maxChars: 1000 })
    // 50 lines of ~40 chars = ~2000 chars > 1000
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}-padding-padding-padding`)
    const content = lines.join('\n')
    const big = result(content, false, 'tu_big')

    const out = await mw.after!(big, ctx('tu_big'))
    const file = join(scratch, 'tu_big.txt')
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf-8')).toBe(content) // full content persisted
    expect(out.isError).toBe(false) // preserved
    expect(out.content).toContain('too large')
    expect(out.content).toContain(file)
    expect(out.content).toContain('read_file')
    expect(out.content).toContain('offset')
    expect(out.content).toContain('line-0') // head
    expect(out.content).toContain('line-49') // tail
  })

  it('preserves isError on evicted error results', async () => {
    const scratch = tmpScratch()
    const mw = createEvictionMiddleware({ scratchDir: scratch, maxChars: 100 })
    const big = result('x'.repeat(500), true, 'tu_err')
    const out = await mw.after!(big, ctx('tu_err'))
    expect(out.isError).toBe(true)
  })

  it('uses ctx.toolUseId as the filename', async () => {
    const scratch = tmpScratch()
    const mw = createEvictionMiddleware({ scratchDir: scratch, maxChars: 100 })
    await mw.after!(result('x'.repeat(500), false, 'ID'), ctx('ID'))
    expect(existsSync(join(scratch, 'ID.txt'))).toBe(true)
  })

  it('honours a custom maxChars', async () => {
    const scratch = tmpScratch()
    const mw = createEvictionMiddleware({ scratchDir: scratch, maxChars: 10_000 })
    const justUnder = result('x'.repeat(9_999), false, 'tu_u')
    expect(await mw.after!(justUnder, ctx('tu_u'))).toEqual(justUnder)
    const justOver = result('x'.repeat(10_001), false, 'tu_o')
    const out = await mw.after!(justOver, ctx('tu_o'))
    expect(out.content).toContain('too large')
  })
})
