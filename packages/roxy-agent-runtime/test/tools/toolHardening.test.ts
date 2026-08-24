import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lsTool } from '../../src/tools/builtin/ls.ts'
import { globTool } from '../../src/tools/builtin/glob.ts'
import { execCommandTool } from '../../src/tools/builtin/exec_command.ts'
import { PathPermissions } from '../../src/tools/builtin/permissions.ts'
import { MAX_LS_ENTRIES } from '../../src/tools/builtin/limits.ts'
import type { ToolContext } from '../../src/core/interfaces.ts'

const ctx: ToolContext = { agentId: 'a', traceId: 't', signal: new AbortController().signal }

describe('ls cap', () => {
  it('caps entries above MAX_LS_ENTRIES with a footer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ls-cap-'))
    for (let i = 0; i < MAX_LS_ENTRIES + 10; i++) {
      writeFileSync(join(dir, `f${i}.txt`), '')
    }
    const tool = lsTool({ permissions: new PathPermissions({ allowRoots: [dir] }) })
    const r = await tool.handler({ path: dir }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain(`showing ${MAX_LS_ENTRIES} of ${MAX_LS_ENTRIES + 10}`)
  })
})

describe('glob cap + sort', () => {
  it('caps results and sorts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glob-cap-'))
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(dir, `z${i}.ts`), '')
    }
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(dir, `a${i}.ts`), '')
    }
    const tool = globTool({ permissions: new PathPermissions({ allowRoots: [dir] }) })
    const r = await tool.handler({ pattern: '*.ts', cwd: dir }, ctx)
    // 10 results, under cap → all present, sorted a* before z*
    expect(r.isError).toBe(false)
    const lines = String(r.content).split('\n')
    expect(lines[0]).toMatch(/^a0\.ts$/)
    expect(lines.at(-1)).toMatch(/^z4\.ts$/)
  })
})

describe('exec_command exit code status', () => {
  it('reports success status for exit 0', async () => {
    const tool = execCommandTool()
    const r = await tool.handler({ cmd: 'true' }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('Process exited with code 0')
  })

  it('reports non-zero process exit without marking the tool result as an error', async () => {
    const tool = execCommandTool()
    const r = await tool.handler({ cmd: 'false' }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('Process exited with code 1')
  })
})
