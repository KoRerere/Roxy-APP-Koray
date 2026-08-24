import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ToolContext } from '../../../src/core/interfaces.ts'
import { applyPatchInputSchema, applyPatchTool, parseApplyPatch } from '../../../src/tools/builtin/apply_patch.ts'
import { makeTempDir } from '../../helpers/tempDir.ts'

const ctx: ToolContext = {
  agentId: 'test-agent',
  traceId: 'test-trace',
  signal: new AbortController().signal,
}

const deepSeekPatchSamples = {
  create: ['*** Begin Patch', '*** Add File: notes/alpha.txt', '+alpha', '+created by DeepSeek', '*** End Patch'].join(
    '\n',
  ),
  update: [
    '*** Begin Patch',
    '*** Update File: config.ini',
    '@@',
    ' [server]',
    ' host=127.0.0.1',
    '-port=8080',
    '+port=9090',
    '+enabled=true',
    '*** End Patch',
  ].join('\n'),
  delete: ['*** Begin Patch', '*** Delete File: obsolete.txt', '*** End Patch'].join('\n'),
  mixed: [
    '*** Begin Patch',
    '*** Update File: app/settings.json',
    '@@',
    '-  "theme": "light",',
    '+  "theme": "dark",',
    '*** Add File: docs/new.md',
    '+# New Guide',
    '+This guide is current.',
    '*** Delete File: docs/old.md',
    '*** End Patch',
  ].join('\n'),
  absolute: [
    '*** Begin Patch',
    '*** Update File: /opt/demo/app.env',
    '@@',
    '-DEBUG=true',
    '+DEBUG=false',
    '*** Add File: /var/tmp/deepseek-created.txt',
    '+created',
    '*** Delete File: /srv/demo/obsolete.md',
    '*** End Patch',
  ].join('\n'),
} as const

describe('apply_patch', () => {
  let workspaceDir: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: workspaceDir, cleanup } = await makeTempDir())
  })

  afterEach(() => cleanup())

  it('is a destructive semantic apply_patch tool with provider-neutral input', () => {
    const { descriptor } = applyPatchTool()
    expect(descriptor.name).toBe('apply_patch')
    expect(descriptor.kind).toBe('custom')
    expect(descriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: false })
    expect(descriptor.description).toContain('Add File')
    expect(descriptor.description).toContain('*** Begin Patch')
    expect(descriptor.description).toContain('File paths may be absolute or relative')
    expect(descriptor.description).toContain('prefer the exact absolute path')
    expect(descriptor.description).toContain('no workspace or cwd argument')
    expect(descriptor.description).toContain('do not wrap it in JSON')
    expect(applyPatchInputSchema.safeParse('*** Begin Patch').success).toBe(true)
    expect(
      applyPatchInputSchema.safeParse({
        patch: '*** Begin Patch\n*** Delete File: old.txt\n*** End Patch',
      }).success,
    ).toBe(false)
    expect(
      applyPatchInputSchema.safeParse({
        operation: { type: 'create_file', path: 'new.txt', diff: '+hello\n' },
      }).success,
    ).toBe(false)
  })

  it('parses the observed DeepSeek create, update, delete, mixed, and absolute-path inputs', () => {
    // Regression: DeepSeek emits a complete Codex patch envelope as free-form custom-tool input.
    // Fixed by: keep the envelope parser compatible with every observed single and mixed operation shape.
    expect(parseApplyPatch(deepSeekPatchSamples.create)).toEqual([
      { type: 'add', path: 'notes/alpha.txt', diff: '+alpha\n+created by DeepSeek' },
    ])
    expect(parseApplyPatch(deepSeekPatchSamples.update)).toEqual([
      {
        type: 'update',
        path: 'config.ini',
        diff: '@@\n [server]\n host=127.0.0.1\n-port=8080\n+port=9090\n+enabled=true',
      },
    ])
    expect(parseApplyPatch(deepSeekPatchSamples.delete)).toEqual([{ type: 'delete', path: 'obsolete.txt' }])
    expect(parseApplyPatch(deepSeekPatchSamples.mixed)).toEqual([
      {
        type: 'update',
        path: 'app/settings.json',
        diff: '@@\n-  "theme": "light",\n+  "theme": "dark",',
      },
      { type: 'add', path: 'docs/new.md', diff: '+# New Guide\n+This guide is current.' },
      { type: 'delete', path: 'docs/old.md' },
    ])
    expect(parseApplyPatch(deepSeekPatchSamples.absolute)).toEqual([
      { type: 'update', path: '/opt/demo/app.env', diff: '@@\n-DEBUG=true\n+DEBUG=false' },
      { type: 'add', path: '/var/tmp/deepseek-created.txt', diff: '+created' },
      { type: 'delete', path: '/srv/demo/obsolete.md' },
    ])
  })

  it('executes the observed DeepSeek relative-path inputs from the process directory', async () => {
    // Regression: parser-only coverage did not prove that the observed free-form inputs work through applyDiff and file IO.
    // Fixed by: execute the exact relative-path samples against a temporary process directory.
    await mkdir(join(workspaceDir, 'app'), { recursive: true })
    await mkdir(join(workspaceDir, 'docs'), { recursive: true })
    await writeFile(join(workspaceDir, 'config.ini'), '[server]\nhost=127.0.0.1\nport=8080\n', 'utf8')
    await writeFile(join(workspaceDir, 'obsolete.txt'), 'obsolete\n', 'utf8')
    await writeFile(join(workspaceDir, 'app/settings.json'), '{\n  "theme": "light",\n}\n', 'utf8')
    await writeFile(join(workspaceDir, 'docs/old.md'), '# Old Guide\n', 'utf8')

    const originalCwd = process.cwd()
    process.chdir(workspaceDir)
    try {
      const { handler } = applyPatchTool()
      for (const patch of [
        deepSeekPatchSamples.create,
        deepSeekPatchSamples.update,
        deepSeekPatchSamples.delete,
        deepSeekPatchSamples.mixed,
      ]) {
        const result = await handler(patch, ctx)
        expect(result).toMatchObject({ isError: false })
      }
    } finally {
      process.chdir(originalCwd)
    }

    expect(await readFile(join(workspaceDir, 'notes/alpha.txt'), 'utf8')).toBe('alpha\ncreated by DeepSeek')
    expect(await readFile(join(workspaceDir, 'config.ini'), 'utf8')).toBe(
      '[server]\nhost=127.0.0.1\nport=9090\nenabled=true\n',
    )
    await expect(access(join(workspaceDir, 'obsolete.txt'))).rejects.toThrow()
    expect(await readFile(join(workspaceDir, 'app/settings.json'), 'utf8')).toBe('{\n  "theme": "dark",\n}\n')
    expect(await readFile(join(workspaceDir, 'docs/new.md'), 'utf8')).toBe('# New Guide\nThis guide is current.')
    await expect(access(join(workspaceDir, 'docs/old.md'))).rejects.toThrow()
  })

  it('executes an observed DeepSeek mixed patch with absolute paths', async () => {
    // Regression: absolute-path support was covered only by a single Add File operation.
    // Fixed by: cover update, add, and delete together using safe temporary absolute paths.
    const envPath = join(workspaceDir, 'opt/demo/app.env')
    const createdPath = join(workspaceDir, 'var/tmp/deepseek-created.txt')
    const obsoletePath = join(workspaceDir, 'srv/demo/obsolete.md')
    await mkdir(join(workspaceDir, 'opt/demo'), { recursive: true })
    await mkdir(join(workspaceDir, 'srv/demo'), { recursive: true })
    await writeFile(envPath, 'DEBUG=true\n', 'utf8')
    await writeFile(obsoletePath, 'obsolete\n', 'utf8')

    const patch = [
      '*** Begin Patch',
      `*** Update File: ${envPath}`,
      '@@',
      '-DEBUG=true',
      '+DEBUG=false',
      `*** Add File: ${createdPath}`,
      '+created',
      `*** Delete File: ${obsoletePath}`,
      '*** End Patch',
    ].join('\n')
    const { handler } = applyPatchTool()
    const result = await handler(patch, ctx)

    expect(result).toMatchObject({ isError: false })
    expect(await readFile(envPath, 'utf8')).toBe('DEBUG=false\n')
    expect(await readFile(createdPath, 'utf8')).toBe('created')
    await expect(access(obsoletePath)).rejects.toThrow()
  })

  it('creates, updates, moves, and deletes files from one Codex patch', async () => {
    await writeFile(join(workspaceDir, 'existing.txt'), 'old value\nkeep\n', 'utf8')
    await writeFile(join(workspaceDir, 'remove.txt'), 'remove me\n', 'utf8')

    const patch = [
      '*** Begin Patch',
      `*** Add File: ${join(workspaceDir, 'nested/new.txt')}`,
      '+created',
      `*** Update File: ${join(workspaceDir, 'existing.txt')}`,
      `*** Move to: ${join(workspaceDir, 'moved.txt')}`,
      '@@',
      '-old value',
      '+new value',
      ' keep',
      `*** Delete File: ${join(workspaceDir, 'remove.txt')}`,
      '*** End Patch',
    ].join('\n')

    const { handler } = applyPatchTool()
    const result = await handler(patch, ctx)

    expect(result).toMatchObject({ isError: false })
    expect(result.content).toContain('Done!')
    expect(await readFile(join(workspaceDir, 'nested/new.txt'), 'utf8')).toBe('created')
    expect(await readFile(join(workspaceDir, 'moved.txt'), 'utf8')).toBe('new value\nkeep\n')
    await expect(access(join(workspaceDir, 'existing.txt'))).rejects.toThrow()
    await expect(access(join(workspaceDir, 'remove.txt'))).rejects.toThrow()
  })

  it('parses the documented V4A grammar, including anchors and end-of-file markers', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: src/example.ts',
      '@@ function run',
      ' const value = 1',
      '-return value',
      '+return value + 1',
      '*** End of File',
      '*** End Patch',
    ].join('\n')

    expect(parseApplyPatch(patch)).toEqual([
      {
        type: 'update',
        path: 'src/example.ts',
        diff: ['@@ function run', ' const value = 1', '-return value', '+return value + 1', '*** End of File'].join(
          '\n',
        ),
      },
    ])
  })

  it('rejects malformed V4A sections and duplicate file actions', () => {
    expect(() =>
      parseApplyPatch(
        ['*** Begin Patch', '*** Add File: new.txt', 'content without the required + prefix', '*** End Patch'].join(
          '\n',
        ),
      ),
    ).toThrow(/invalid Add File line/i)

    expect(() =>
      parseApplyPatch(
        ['*** Begin Patch', '*** Update File: file.txt', 'unexpected unprefixed line', '*** End Patch'].join('\n'),
      ),
    ).toThrow(/invalid Update File line/i)

    expect(() =>
      parseApplyPatch(
        ['*** Begin Patch', '*** Delete File: file.txt', '*** Delete File: file.txt', '*** End Patch'].join('\n'),
      ),
    ).toThrow(/duplicate file action/i)

    expect(() =>
      parseApplyPatch(
        ['*** Begin Patch', '*** Update File: file.txt', '@@ ', '-old', '+new', '*** End Patch'].join('\n'),
      ),
    ).toThrow(/anchor.*must not be empty/i)

    expect(() =>
      parseApplyPatch(
        ['*** Begin Patch', '*** Update File: file.txt', '@@', '-old', '*** End of File', '+new', '*** End Patch'].join(
          '\n',
        ),
      ),
    ).toThrow(/End of File.*end/i)
  })

  it('supports the documented move-only Update File action', async () => {
    await writeFile(join(workspaceDir, 'before.txt'), 'unchanged\n', 'utf8')
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${join(workspaceDir, 'before.txt')}`,
      `*** Move to: ${join(workspaceDir, 'after.txt')}`,
      '*** End Patch',
    ].join('\n')

    const { handler } = applyPatchTool()
    await expect(handler(patch, ctx)).resolves.toMatchObject({ isError: false })
    await expect(access(join(workspaceDir, 'before.txt'))).rejects.toThrow()
    expect(await readFile(join(workspaceDir, 'after.txt'), 'utf8')).toBe('unchanged\n')
  })

  it('preserves blank context lines in an update diff', async () => {
    await writeFile(join(workspaceDir, 'blank.txt'), 'top\n\nbottom\n', 'utf8')
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${join(workspaceDir, 'blank.txt')}`,
      '@@',
      ' top',
      ' ',
      '-bottom',
      '+changed',
      '*** End Patch',
    ].join('\n')

    const { handler } = applyPatchTool()
    await expect(handler(patch, ctx)).resolves.toMatchObject({ isError: false })
    expect(await readFile(join(workspaceDir, 'blank.txt'), 'utf8')).toBe('top\n\nchanged\n')
  })

  it('validates every operation before writing so a failed patch is atomic', async () => {
    await writeFile(join(workspaceDir, 'stable.txt'), 'before\n', 'utf8')
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${join(workspaceDir, 'stable.txt')}`,
      '@@',
      '-before',
      '+after',
      `*** Update File: ${join(workspaceDir, 'missing.txt')}`,
      '@@',
      '-missing',
      '+changed',
      '*** End Patch',
    ].join('\n')

    const { handler } = applyPatchTool()
    const result = await handler(patch, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('missing.txt')
    expect(await readFile(join(workspaceDir, 'stable.txt'), 'utf8')).toBe('before\n')
  })

  it('accepts an absolute path without binding the tool to a workspace', async () => {
    const path = join(workspaceDir, 'absolute.txt')
    const patch = ['*** Begin Patch', `*** Add File: ${path}`, '+created', '*** End Patch'].join('\n')

    const { handler } = applyPatchTool()
    const result = await handler(patch, ctx)

    expect(result.isError).toBe(false)
    expect(await readFile(path, 'utf8')).toBe('created')
  })

  it('rejects multiple actions for the same path in one envelope', async () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: staged.txt',
      '+first',
      '*** Update File: staged.txt',
      '@@',
      '-first',
      '+second',
      '*** End Patch',
    ].join('\n')

    const { handler } = applyPatchTool()
    await expect(handler(patch, ctx)).resolves.toMatchObject({
      isError: true,
      content: expect.stringMatching(/duplicate file action/i),
    })
    await expect(access(join(workspaceDir, 'staged.txt'))).rejects.toThrow()
  })

  it('updates a move destination later in the same patch', async () => {
    await writeFile(join(workspaceDir, 'source.txt'), 'first\n', 'utf8')
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${join(workspaceDir, 'source.txt')}`,
      `*** Move to: ${join(workspaceDir, 'destination.txt')}`,
      '@@',
      '-first',
      '+second',
      `*** Update File: ${join(workspaceDir, 'destination.txt')}`,
      '@@',
      '-second',
      '+third',
      '*** End Patch',
    ].join('\n')

    const { handler } = applyPatchTool()
    await expect(handler(patch, ctx)).resolves.toMatchObject({ isError: false })
    await expect(access(join(workspaceDir, 'source.txt'))).rejects.toThrow()
    expect(await readFile(join(workspaceDir, 'destination.txt'), 'utf8')).toBe('third\n')
  })
})
