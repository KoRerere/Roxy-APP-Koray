import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { ToolContext } from '../../../src/core/interfaces.ts'
import { edit_fileTool } from '../../../src/tools/builtin/edit_file.ts'
import { execCommandTool } from '../../../src/tools/builtin/exec_command.ts'
import { ExecCommandProcessManager } from '../../../src/tools/builtin/exec_command_process_manager.ts'
import { globTool } from '../../../src/tools/builtin/glob.ts'
import { grepTool } from '../../../src/tools/builtin/grep.ts'
import { lsTool } from '../../../src/tools/builtin/ls.ts'
import { read_fileTool } from '../../../src/tools/builtin/read_file.ts'
import { write_fileTool } from '../../../src/tools/builtin/write_file.ts'
import { makeTempDir } from '../../helpers/tempDir.ts'

const ctx: ToolContext = {
  agentId: 'test-agent',
  traceId: 'test-trace',
  signal: new AbortController().signal,
}

describe('read_file', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
  })
  afterEach(() => cleanup())

  it('returns file content in the DSH read envelope', async () => {
    // Regression: read_file returned bare cat -n output, while the model-facing
    // read contract now requires the DSH envelope.
    // Fixed by: format every successful read with path/type/content tags.
    const file = join(tmpPath, 'hello.txt')
    await writeFile(file, 'hello world')
    const { handler } = read_fileTool()
    const result = await handler({ path: file }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toBe(`<path>${file}</path>
<type>file</type>
<content>
1: hello world

(End of file - total 1 lines)
</content>`)
  })

  it('returns isError when file not found', async () => {
    const { handler } = read_fileTool()
    const result = await handler({ path: join(tmpPath, 'missing.txt') }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('missing.txt')
  })

  it('returns isError when path is missing from input', async () => {
    const { handler } = read_fileTool()
    const result = await handler({}, ctx)
    expect(result.isError).toBe(true)
  })

  it('descriptor is read-only', () => {
    const { descriptor } = read_fileTool()
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
    expect(descriptor.source).toBe('builtin')
  })
})

describe('write_file', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
  })
  afterEach(() => cleanup())

  it('creates, overwrites, and makes parent directories', async () => {
    // Regression: write_file remained a default builtin while its behavior tests
    // were deleted during the apply_patch migration.
    // Fixed by: restore coverage for the still-registered fallback write tool.
    const file = join(tmpPath, 'nested', 'out.txt')
    const { handler } = write_fileTool()

    expect(await handler({ path: file, content: 'first' }, ctx)).toMatchObject({ isError: false })
    expect(await readFile(file, 'utf8')).toBe('first')
    expect(await handler({ path: file, content: 'second' }, ctx)).toMatchObject({ isError: false })
    expect(await readFile(file, 'utf8')).toBe('second')
  })

  it('is mutating and rejects missing paths', async () => {
    const { descriptor, handler } = write_fileTool()

    expect(descriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: false })
    expect(await handler({ content: 'x' }, ctx)).toMatchObject({ isError: true })
  })
})

describe('edit_file', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
  })
  afterEach(() => cleanup())

  it('replaces a unique occurrence', async () => {
    // Regression: edit_file remained a default builtin while its behavior tests
    // were deleted during the apply_patch migration.
    // Fixed by: restore coverage for the still-registered fallback edit tool.
    const file = join(tmpPath, 'code.ts')
    await writeFile(file, 'const value = 1\n')
    const { handler } = edit_fileTool()

    expect(await handler({ path: file, old_str: '1', new_str: '2' }, ctx)).toMatchObject({ isError: false })
    expect(await readFile(file, 'utf8')).toBe('const value = 2\n')
  })

  it('rejects missing and non-unique matches and remains mutating', async () => {
    const file = join(tmpPath, 'dup.txt')
    await writeFile(file, 'foo foo\n')
    const { descriptor, handler } = edit_fileTool()

    expect(descriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: false })
    expect(await handler({ path: file, old_str: 'bar', new_str: 'x' }, ctx)).toMatchObject({ isError: true })
    expect(await handler({ path: file, old_str: 'foo', new_str: 'x' }, ctx)).toMatchObject({ isError: true })
    expect(await readFile(file, 'utf8')).toBe('foo foo\n')
  })
})

describe('exec_command', () => {
  it('captures stdout and returns exit_code 0', async () => {
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'echo hello' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('hello')
    expect(result.content).toContain('Process exited with code 0')
  })

  it('reports non-zero exit code without marking the tool result as an error', async () => {
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'exit 1' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('Process exited with code 1')
  })

  it('kills the process on manager lifetime timeout and returns isError', async () => {
    const processManager = new ExecCommandProcessManager({ lifetimeMs: 100 })
    const { handler } = execCommandTool({ processManager })
    const result = await handler({ cmd: 'sleep 60', yield_time_ms: 5_000 }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toMatch(/timeout/i)
  })

  it.skipIf(process.platform === 'win32')('runs Bash syntax on Unix-like hosts', async () => {
    // Regression: command execution used Node's default `/bin/sh` on macOS, so model-generated
    // Bash syntax like process substitution failed with a shell parse error.
    // Fixed by: prefer Bash for Unix-like hosts while keeping Windows shell-specific.
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'diff <(printf a) <(printf a)' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('Process exited with code 0')
  })

  it.skipIf(process.platform === 'win32')('times out a pipeline without waiting for child commands', async () => {
    // Regression: timeout killed only the top-level shell; long-running children in
    // a pipeline kept stdout/stderr open, so a 30s timeout could surface minutes later.
    // Fixed by: run Unix shell commands in their own process group and kill the group.
    const processManager = new ExecCommandProcessManager({ lifetimeMs: 100 })
    const { handler } = execCommandTool({ processManager })
    const startedAt = Date.now()
    const result = await handler({ cmd: 'sleep 60 | cat', yield_time_ms: 5_000 }, ctx)
    const elapsedMs = Date.now() - startedAt
    expect(result.isError).toBe(true)
    expect(result.content).toMatch(/timeout/i)
    expect(elapsedMs).toBeLessThan(2_000)
  })

  it('truncates stdout by max_output_tokens', async () => {
    const { handler } = execCommandTool()
    // generate ~6000 chars of output
    const result = await handler(
      {
        cmd: 'node -e "process.stdout.write(\'x\'.repeat(6000))"',
        max_output_tokens: 100,
      },
      ctx,
    )
    expect(result.isError).toBe(false)
    expect(result.content).toContain('Warning: truncated output')
  })

  it('descriptor is destructive and open-world', () => {
    const { descriptor } = execCommandTool()
    expect(descriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: true })
  })

  it('returns isError when cmd is missing', async () => {
    const { handler } = execCommandTool()
    const result = await handler({}, ctx)
    expect(result.isError).toBe(true)
  })
})

describe('glob', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
    await writeFile(join(tmpPath, 'a.ts'), '')
    await writeFile(join(tmpPath, 'b.ts'), '')
    await writeFile(join(tmpPath, 'c.txt'), '')
    await mkdir(join(tmpPath, 'sub'))
    await writeFile(join(tmpPath, 'sub', 'd.ts'), '')
  })
  afterEach(() => cleanup())

  it('matches files by extension', async () => {
    const { handler } = globTool()
    const result = await handler({ pattern: '*.ts', cwd: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    const lines = result.content.split('\n').filter(Boolean)
    expect(lines).toContain('a.ts')
    expect(lines).toContain('b.ts')
    expect(lines).not.toContain('c.txt')
  })

  it('matches nested files with **', async () => {
    const { handler } = globTool()
    const result = await handler({ pattern: '**/*.ts', cwd: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    const lines = result.content.split('\n').filter(Boolean)
    expect(lines.some((l) => l.includes('d.ts'))).toBe(true)
  })

  it('returns empty string for no matches (not an error)', async () => {
    const { handler } = globTool()
    const result = await handler({ pattern: '*.xyz', cwd: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content.trim()).toBe('')
  })

  it('descriptor is read-only', () => {
    const { descriptor } = globTool()
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })
})

describe('ls', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
    await writeFile(join(tmpPath, 'file.txt'), '')
    await mkdir(join(tmpPath, 'subdir'))
  })
  afterEach(() => cleanup())

  it('lists entries with type info', async () => {
    const { handler } = lsTool()
    const result = await handler({ path: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toMatch(/file\.txt.*file|file.*file\.txt/i)
    expect(result.content).toMatch(/subdir.*dir|dir.*subdir/i)
  })

  it('returns isError for non-existent directory', async () => {
    const { handler } = lsTool()
    const result = await handler({ path: join(tmpPath, 'ghost') }, ctx)
    expect(result.isError).toBe(true)
  })

  it('descriptor is read-only', () => {
    const { descriptor } = lsTool()
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })
})

describe('grep', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
    await writeFile(join(tmpPath, 'a.ts'), 'const x = 1;\nconst y = 2;\n')
    await writeFile(join(tmpPath, 'b.ts'), 'function foo() {}\n')
  })
  afterEach(() => cleanup())

  it('returns matching lines grouped by file', async () => {
    const { handler } = grepTool()
    const result = await handler({ pattern: 'const', path: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('a.ts')
    expect(result.content).toContain('1: const x = 1;')
    expect(result.content).toContain('2: const y = 2;')
  })

  it('searches within a single file when path is a file', async () => {
    const { handler } = grepTool()
    const result = await handler({ pattern: 'function', path: join(tmpPath, 'b.ts') }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('function')
  })

  it('returns empty string for no matches (not an error)', async () => {
    const { handler } = grepTool()
    const result = await handler({ pattern: 'zzznomatch', path: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content.trim()).toBe('')
  })

  it('literal-matches special regex chars (NOT regex)', async () => {
    const { handler } = grepTool()
    const result = await handler({ pattern: '[invalid', path: tmpPath }, ctx)
    // literal substring — never an error, simply no matches here
    expect(result.isError).toBe(false)
  })

  it('case_insensitive:true matches across case', async () => {
    const { handler } = grepTool()
    const result = await handler({ pattern: 'CONST', case_insensitive: true, path: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('const')
  })

  it('descriptor is read-only', () => {
    const { descriptor } = grepTool()
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })
})
