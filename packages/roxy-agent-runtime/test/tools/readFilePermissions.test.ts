import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { read_fileTool } from '../../src/tools/builtin/read_file.ts'
import { PathPermissions } from '../../src/tools/builtin/permissions.ts'
import { FakeHitlHandler } from '../helpers/makeFakeHandler.ts'
import type { ToolContext, IHITLHandler } from '../../src/core/interfaces.ts'

const ctx: ToolContext = { agentId: 'a', traceId: 't', signal: new AbortController().signal }

function setup(roots: string[], hitl?: IHITLHandler) {
  const permissions = new PathPermissions({ allowRoots: roots })
  return { permissions, tool: read_fileTool({ permissions, hitl }) }
}

describe('read_file permission layer', () => {
  it('denies .env even with no HITL (full mode)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    const { tool } = setup([root])
    const f = join(root, '.env')
    writeFileSync(f, 'SECRET=1')
    const r = await tool.handler({ path: f }, ctx)
    expect(r.isError).toBe(true)
    expect(r.content).toContain('not allowed')
  })

  it('auto-allows reading a skill-style file under an allow root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    mkdirSync(join(root, 'guides'), { recursive: true })
    writeFileSync(join(root, 'guides', 'x.md'), 'guide body')
    const { tool } = setup([root])
    const r = await tool.handler({ path: join(root, 'guides', 'x.md') }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('guide body')
  })

  it('does not allow a symlink inside a skill root to escape that root', async () => {
    // Regression: lexical-only containment allowed a skill-owned symlink to
    // expose arbitrary readable files outside its allow root.
    // Fixed by: classifying existing paths using canonical real paths.
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    const outside = mkdtempSync(join(tmpdir(), 'rf-'))
    const target = join(outside, 'secret.txt')
    writeFileSync(target, 'outside secret')
    const link = join(root, 'linked-secret.txt')
    symlinkSync(target, link)
    const { tool } = setup([root])

    const result = await tool.handler({ path: link }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('not allowed')
  })

  it('unrestricted (no permissions dep) reads anything including .env', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    const f = join(root, '.env')
    writeFileSync(f, 'SECRET=1')
    const tool = read_fileTool() // no deps
    const r = await tool.handler({ path: f }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('SECRET=1')
  })

  it('ask path in strict mode: approve → read, reject → isError', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    const outside = mkdtempSync(join(tmpdir(), 'rf-'))
    const target = join(outside, 'readme.md')
    writeFileSync(target, 'outside body')

    const approve = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const { tool: toolApprove } = setup([root], approve)
    const rOk = await toolApprove.handler({ path: target }, ctx)
    expect(rOk.isError).toBe(false)
    expect(rOk.content).toContain('outside body')
    expect(approve.requests).toHaveLength(1)
    expect(approve.requests[0]!.reason).toContain('outside allowed roots')

    const reject = new FakeHitlHandler({
      mode: 'strict',
      results: [{ decision: 'reject', feedback: 'nope' }],
    })
    const { tool: toolReject } = setup([root], reject)
    const rNo = await toolReject.handler({ path: target }, ctx)
    expect(rNo.isError).toBe(true)
    expect(rNo.content).toContain('nope')
  })

  it('ask path in full mode (no HITL) auto-allows', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    const outside = mkdtempSync(join(tmpdir(), 'rf-'))
    const target = join(outside, 'readme.md')
    writeFileSync(target, 'ok')
    const { tool } = setup([root]) // no hitl ⇒ full-mode behaviour
    const r = await tool.handler({ path: target }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('ok')
  })

  it('ask path that is also a deny pattern stays denied (not asked)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rf-'))
    const outside = mkdtempSync(join(tmpdir(), 'rf-'))
    const target = join(outside, '.env')
    writeFileSync(target, 'SECRET')
    const h = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const { tool } = setup([root], h)
    const r = await tool.handler({ path: target }, ctx)
    expect(r.isError).toBe(true)
    expect(h.requests).toHaveLength(0) // deny short-circuits, no approval prompted
  })
})
