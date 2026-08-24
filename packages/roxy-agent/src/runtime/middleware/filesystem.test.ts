import { PathPermissions } from 'roxy-agent-runtime'
import { describe, expect, it } from 'vitest'
import { createRuntimeFileCollector } from '../file-collector'
import { createRuntimeFilesystemMiddleware } from './filesystem'

const ctx = {
  agentId: 'agent-1',
  sessionId: 'session-1',
  traceId: 'trace-1',
  toolName: 'apply_patch',
  toolSource: 'builtin' as const,
  toolUseId: 'tool-1',
  callIndex: 0,
}

describe('runtime filesystem middleware', () => {
  it('passes Codex patch text through and records every successful create or update', async () => {
    // Regression: the host middleware understood one JSON path per write/edit call,
    // so a free-form multi-file apply_patch could not publish generated artifacts.
    // Fixed by: parse every patch operation while preserving the custom-tool string.
    const collector = createRuntimeFileCollector()
    const workspaceDir = '/tmp/roxy-session'
    const middleware = createRuntimeFilesystemMiddleware({
      workspaceDir,
      permissions: new PathPermissions({ allowRoots: [workspaceDir] }),
      collector,
    })

    const input = [
      '*** Begin Patch',
      '*** Add File: /tmp/roxy-session/report.csv',
      '+ok',
      '*** Update File: /tmp/roxy-session/notes.txt',
      '@@',
      '-old',
      '+new',
      '*** Delete File: /tmp/roxy-session/removed.txt',
      '*** End Patch',
    ].join('\n')
    expect(await middleware.before?.(input, ctx)).toBe(input)
    await middleware.after?.({ toolUseId: 'tool-1', content: 'done', isError: false }, ctx)
    expect(collector.peek()).toEqual([
      expect.objectContaining({
        virtualPath: 'report.csv',
        realPath: '/tmp/roxy-session/report.csv',
        op: 'write',
        source: 'apply_patch',
      }),
      expect.objectContaining({
        virtualPath: 'notes.txt',
        realPath: '/tmp/roxy-session/notes.txt',
        op: 'edit',
        source: 'apply_patch',
      }),
    ])
  })

  it('normalizes preview paths without staging an artifact', async () => {
    // Regression: builtin file previews ran before workspace path resolution,
    // while reusing before() would stage artifacts before user approval.
    // Fixed by: a side-effect-free preview transform shares only path validation.
    const collector = createRuntimeFileCollector()
    const workspaceDir = '/tmp/roxy-session'
    const middleware = createRuntimeFilesystemMiddleware({
      workspaceDir,
      permissions: new PathPermissions({ allowRoots: [workspaceDir] }),
      collector,
    })

    const input = '*** Begin Patch\n*** Add File: /tmp/roxy-session/report.csv\n+ok\n*** End Patch'
    expect(await middleware.preview?.(input, ctx)).toBe(input)
    expect(collector.peek()).toEqual([])
  })

  it('rejects paths outside the conversation workspace', async () => {
    const workspaceDir = '/tmp/roxy-session'
    const middleware = createRuntimeFilesystemMiddleware({
      workspaceDir,
      permissions: new PathPermissions({ allowRoots: [workspaceDir] }),
      collector: createRuntimeFileCollector(),
    })

    const input = '*** Begin Patch\n*** Add File: /tmp/outside.txt\n+no\n*** End Patch'
    expect(() => middleware.before?.(input, ctx)).toThrow('path not allowed')
  })

  it('allows apply_patch absolute paths outside the conversation directory when permissions are unrestricted', async () => {
    const middleware = createRuntimeFilesystemMiddleware({
      workspaceDir: '/tmp/roxy-session',
      collector: createRuntimeFileCollector(),
    })

    const input = '*** Begin Patch\n*** Add File: /tmp/roxy-absolute.txt\n+ok\n*** End Patch'
    expect(await middleware.before?.(input, ctx)).toBe(input)
  })

  it('records a create action from free-form patch input', async () => {
    const collector = createRuntimeFileCollector()
    const middleware = createRuntimeFilesystemMiddleware({
      workspaceDir: '/tmp/roxy-session',
      collector,
    })

    const input = '*** Begin Patch\n*** Add File: /tmp/roxy-session/native.txt\n+native\n*** End Patch'
    expect(await middleware.before?.(input, ctx)).toBe(input)
    await middleware.after?.({ toolUseId: 'tool-1', content: 'done', isError: false }, ctx)
    expect(collector.peek()).toEqual([
      expect.objectContaining({
        virtualPath: 'native.txt',
        realPath: '/tmp/roxy-session/native.txt',
        op: 'write',
      }),
    ])
  })

  it('allows memory writes without collecting them as conversation artifacts', async () => {
    // Regression: filesystem writes outside the conversation workspace were
    // either rejected by write_file or uploaded as user-facing artifacts.
    // Fixed by: the configured memory root is writable and excluded from collection.
    const collector = createRuntimeFileCollector()
    const memoryDir = '/tmp/roxy-agent/memory'
    const middleware = createRuntimeFilesystemMiddleware({
      workspaceDir: '/tmp/roxy-session',
      additionalWriteRoots: [memoryDir],
      ignoredArtifactRoots: [memoryDir],
      collector,
    })
    const writeContext = { ...ctx, toolName: 'write_file', toolUseId: 'write-memory' }
    const memoryIndex = `${memoryDir}/MEMORY.md`

    expect(await middleware.before?.({ path: memoryIndex, content: '# Roxy Agent Memory Index' }, writeContext))
      .toEqual({ path: memoryIndex, content: '# Roxy Agent Memory Index' })
    await middleware.after?.(
      { toolUseId: 'write-memory', content: 'done', isError: false },
      writeContext,
    )

    const patchInput = [
      '*** Begin Patch',
      `*** Add File: ${memoryDir}/memory-name.md`,
      '+---',
      '+name: memory-name',
      '+description: Memory description',
      '+---',
      '+Memory content.',
      '*** End Patch',
    ].join('\n')
    const patchContext = { ...ctx, toolUseId: 'patch-memory' }
    expect(await middleware.before?.(patchInput, patchContext)).toBe(patchInput)
    await middleware.after?.(
      { toolUseId: 'patch-memory', content: 'done', isError: false },
      patchContext,
    )

    expect(collector.peek()).toEqual([])
  })
})
