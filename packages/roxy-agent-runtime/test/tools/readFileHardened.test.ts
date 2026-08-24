import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { zodToJsonSchema } from '../../src/tools/schema.ts'
import { read_fileTool } from '../../src/tools/builtin/read_file.ts'
import { READ_LIMIT, READ_MAX_LINE_LENGTH, READ_STREAM_MIN_SIZE } from '../../src/tools/builtin/limits.ts'
import { PathPermissions } from '../../src/tools/builtin/permissions.ts'
import type { ToolContext } from '../../src/core/interfaces.ts'

const ctx: ToolContext = { agentId: 'a', traceId: 't', signal: new AbortController().signal }

function setup(roots: string[] = []) {
  const permissions = new PathPermissions({ allowRoots: roots })
  return read_fileTool({ permissions })
}

function tmpFile(content: string | Buffer, name = 'f.txt') {
  const dir = mkdtempSync(join(tmpdir(), 'rf-h-'))
  const path = join(dir, name)
  writeFileSync(path, content)
  return { path, dir }
}

describe('read_file hardening', () => {
  it('advertises the DSH-compatible input contract', () => {
    // Regression: the tool schema described Roxy-specific offset=0,
    // line_numbers:false, and 100-line defaults.
    // Fixed by: expose DSH-compatible 1-based pagination descriptions.
    const tool = read_fileTool()
    const schema = zodToJsonSchema(tool.descriptor.inputSchema)

    expect(schema.properties).toMatchObject({
      path: {
        type: 'string',
        description: 'Path to read. Relative paths resolve from the current process working directory.',
      },
      offset: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: '1-based first line to return. Defaults to 1.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: READ_LIMIT,
        description: `Maximum number of lines to return. Defaults to ${READ_LIMIT}.`,
      },
    })
    expect(schema.properties).not.toHaveProperty('line_numbers')
  })

  it('returns DSH envelope output by default', async () => {
    // Regression: successful reads returned raw cat -n text with no envelope.
    // Fixed by: render the DSH <path>/<type>/<content> read envelope.
    const { path, dir } = tmpFile('hello world')
    const tool = setup([dir])
    const r = await tool.handler({ path }, ctx)

    expect(r.isError).toBe(false)
    expect(r.content).toBe(`<path>${path}</path>
<type>file</type>
<content>
1: hello world

(End of file - total 1 lines)
</content>`)
  })

  it('paginates with 1-based offset+limit and continuation footer', async () => {
    // Regression: offset skipped N lines, so offset=10 started at line 11.
    // Fixed by: treat offset as the 1-based first returned line.
    const lines = Array.from({ length: 50 }, (_, i) => `L${i + 1}`)
    const { path, dir } = tmpFile(lines.join('\n'))
    const tool = setup([dir])
    const r = await tool.handler({ path, offset: 10, limit: 5 }, ctx)

    expect(r.isError).toBe(false)
    expect(r.content).toContain('10: L10')
    expect(r.content).toContain('14: L14')
    expect(r.content).not.toContain('9: L9')
    expect(r.content).toContain('(Showing lines 10-14 of 50. Use offset=15 to continue.)')
  })

  it('defaults to READ_LIMIT lines and rejects limit above READ_LIMIT', async () => {
    // Regression: default limit was 100 and max limit was 1000, both unlike DSH.
    // Fixed by: use READ_LIMIT as both default and maximum.
    const lines = Array.from({ length: READ_LIMIT + 1 }, (_, i) => `L${i + 1}`)
    const { path, dir } = tmpFile(lines.join('\n'))
    const tool = setup([dir])
    const r = await tool.handler({ path }, ctx)

    expect(r.isError).toBe(false)
    expect(r.content).toContain(`1: L1`)
    expect(r.content).toContain(`${READ_LIMIT}: L${READ_LIMIT}`)
    expect(r.content).not.toContain(`${READ_LIMIT + 1}: L${READ_LIMIT + 1}`)
    expect(r.content).toContain(`Use offset=${READ_LIMIT + 1} to continue.`)

    const invalid = await tool.handler({ path, limit: READ_LIMIT + 1 }, ctx)
    expect(invalid.isError).toBe(true)
    expect(invalid.errorKind).toBe('input_invalid')
  })

  it('rejects removed legacy line_numbers and zero offset inputs', async () => {
    // Regression: read_file accepted line_numbers:false and offset=0, keeping
    // two incompatible output/pagination semantics alive.
    // Fixed by: make the schema strict and require positive 1-based offsets.
    const { path, dir } = tmpFile('hello')
    const tool = setup([dir])

    expect(await tool.handler({ path, line_numbers: false }, ctx)).toMatchObject({
      isError: true,
      errorKind: 'input_invalid',
    })
    expect(await tool.handler({ path, offset: 0 }, ctx)).toMatchObject({
      isError: true,
      errorKind: 'input_invalid',
    })
  })

  it('returns an empty-file EOF envelope', async () => {
    // Regression: empty files were rendered as one blank numbered line.
    // Fixed by: render no lines and an EOF footer with total 0.
    const { path, dir } = tmpFile('')
    const tool = setup([dir])
    const r = await tool.handler({ path }, ctx)

    expect(r.isError).toBe(false)
    expect(r.content).toBe(`<path>${path}</path>
<type>file</type>
<content>
(End of file - total 0 lines)
</content>`)
  })

  it('fails when offset is out of range', async () => {
    // Regression: offset past EOF returned a successful explanatory footer.
    // Fixed by: surface DSH-style offset range failures as tool errors.
    const { path, dir } = tmpFile('L1\nL2\nL3')
    const tool = setup([dir])
    const r = await tool.handler({ path, offset: 9, limit: 1 }, ctx)

    expect(r.isError).toBe(true)
    expect(r.content).toBe(`offset 9 is out of range for "${path}" (3 lines)`)
  })

  it('truncates overlong lines with a suffix', async () => {
    // Regression: overlong lines were split as N.1/N.2 continuation lines.
    // Fixed by: return one numbered line with DSH's truncation suffix.
    const long = 'x'.repeat(READ_MAX_LINE_LENGTH + 500)
    const { path, dir } = tmpFile(long)
    const tool = setup([dir])
    const r = await tool.handler({ path }, ctx)

    expect(r.isError).toBe(false)
    expect(r.content).toContain(
      `1: ${'x'.repeat(READ_MAX_LINE_LENGTH)}... (line truncated to ${READ_MAX_LINE_LENGTH} chars)`,
    )
    expect(r.content).not.toContain('1.1')
  })

  it('streams large files instead of rejecting whole-file reads', async () => {
    // Regression: whole-file reads above MAX_READ_BYTES failed unless a window
    // was explicitly requested.
    // Fixed by: route files at or above READ_STREAM_MIN_SIZE through streaming
    // text decoding and apply the normal default window.
    const dir = mkdtempSync(join(tmpdir(), 'rf-h-'))
    const path = join(dir, 'big.txt')
    const line = `${'a'.repeat(100)}\n`
    const repeats = Math.ceil((READ_STREAM_MIN_SIZE + 1024) / Buffer.byteLength(line))
    writeFileSync(path, line.repeat(repeats))
    const tool = setup([dir])
    const r = await tool.handler({ path }, ctx)

    expect(r.isError).toBe(false)
    expect(r.content).toContain('<type>file</type>')
    expect(r.content).toContain(`1: ${'a'.repeat(100)}`)
    expect(r.content).toContain('Use offset=')
  })

  it('rejects binary files and invalid UTF-8 text', async () => {
    // Regression: read_file decoded invalid UTF-8 with replacement characters
    // and only loosely sampled binary data.
    // Fixed by: use fatal UTF-8 decoding and NUL-byte binary rejection.
    const binary = tmpFile(Buffer.from([0x89, 0x50, 0x00, 0x0a]), 'blob')
    const invalid = tmpFile(Buffer.from([0xff, 0xfe, 0xfd]), 'bad.txt')

    const binaryResult = await setup([binary.dir]).handler({ path: binary.path }, ctx)
    expect(binaryResult.isError).toBe(true)
    expect(binaryResult.content).toBe(`cannot read "${binary.path}": binary file`)

    const invalidResult = await setup([invalid.dir]).handler({ path: invalid.path }, ctx)
    expect(invalidResult.isError).toBe(true)
    expect(invalidResult.content).toBe(`cannot read "${invalid.path}": not a UTF-8 text file`)
  })

  it('rejects missing and non-regular files with DSH-style messages', async () => {
    // Regression: raw Node errors leaked through the tool result.
    // Fixed by: normalize not-found and non-regular-file cases.
    const dir = mkdtempSync(join(tmpdir(), 'rf-h-'))
    mkdirSync(join(dir, 'subdir'))
    const tool = setup([dir])

    expect(await tool.handler({ path: join(dir, 'missing.txt') }, ctx)).toMatchObject({
      isError: true,
      content: `cannot read "${join(dir, 'missing.txt')}": not found`,
    })
    expect(await tool.handler({ path: join(dir, 'subdir') }, ctx)).toMatchObject({
      isError: true,
      content: `cannot read "${join(dir, 'subdir')}": not a regular file`,
    })
  })

  it('reports aborts as read aborted', async () => {
    // Regression: Node AbortError details could leak through the tool boundary.
    // Fixed by: map aborted read I/O to the stable DSH-style message.
    const { path, dir } = tmpFile('hello')
    const tool = setup([dir])
    const controller = new AbortController()
    controller.abort()

    const r = await tool.handler({ path }, { ...ctx, signal: controller.signal })
    expect(r).toMatchObject({ isError: true, content: 'read aborted' })
  })

  it('applies the permission guard before filesystem I/O', async () => {
    // Regression: permission denial must remain earlier than stat/open/read, so
    // sensitive or escaping paths do not leak existence or type information.
    // Fixed by: keep readPermissionGuard ahead of every filesystem operation.
    const dir = mkdtempSync(join(tmpdir(), 'rf-h-'))
    const tool = setup([dir])
    const deniedMissing = join(dir, '.env')

    const r = await tool.handler({ path: deniedMissing }, ctx)
    expect(r.isError).toBe(true)
    expect(r.content).toBe(`read_file: path not allowed: ${deniedMissing}`)
  })
})
