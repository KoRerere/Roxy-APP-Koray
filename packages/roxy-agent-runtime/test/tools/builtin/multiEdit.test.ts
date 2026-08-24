import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ToolContext } from '../../../src/core/interfaces.ts'
import { edit_fileTool } from '../../../src/tools/builtin/edit_file.ts'
import { zodToJsonSchema } from '../../../src/tools/schema.ts'
import { makeTempDir } from '../../helpers/tempDir.ts'

const ctx: ToolContext = {
  agentId: 'test-agent',
  traceId: 'test-trace',
  signal: new AbortController().signal,
}

describe('edit_file multi-edit', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
  })
  afterEach(() => cleanup())

  it('applies edits sequentially and reports replacement counts', async () => {
    // Regression: multi-edit coverage was removed even though edit_file still
    // accepts the edits array whenever custom apply_patch is not enabled.
    // Fixed by: restore the sequential multi-edit contract test.
    const file = join(tmpPath, 'sequence.txt')
    await writeFile(file, 'alpha alpha\n')
    const { handler } = edit_fileTool()

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: 'alpha', new_str: 'beta', replace_all: true },
          { old_str: 'beta beta', new_str: 'gamma' },
        ],
      },
      ctx,
    )

    expect(result).toMatchObject({ isError: false })
    expect(result.content).toContain('2 edits')
    expect(result.content).toContain('3 replacements')
    expect(await readFile(file, 'utf8')).toBe('gamma\n')
  })

  it('is atomic when a later edit fails', async () => {
    const file = join(tmpPath, 'atomic.txt')
    await writeFile(file, 'one two\n')
    const { handler } = edit_fileTool()

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: 'one', new_str: 'ONE' },
          { old_str: 'missing', new_str: 'x' },
        ],
      },
      ctx,
    )

    expect(result).toMatchObject({ isError: true })
    expect(result.content).toContain('edit #2')
    expect(await readFile(file, 'utf8')).toBe('one two\n')
  })

  it('rejects invalid mode combinations', async () => {
    const file = join(tmpPath, 'invalid.txt')
    await writeFile(file, 'content\n')
    const { handler } = edit_fileTool()

    expect(await handler({ path: file, edits: [] }, ctx)).toMatchObject({ isError: true })
    expect(
      await handler(
        {
          path: file,
          old_str: 'content',
          new_str: 'x',
          edits: [{ old_str: 'content', new_str: 'y' }],
        },
        ctx,
      ),
    ).toMatchObject({ isError: true })
    expect(await readFile(file, 'utf8')).toBe('content\n')
  })

  it('advertises a top-level object schema for Responses function tools', () => {
    const schema = zodToJsonSchema(edit_fileTool().descriptor.inputSchema) as {
      type?: unknown
      properties?: Record<string, unknown>
    }

    expect(schema.type).toBe('object')
    expect(schema.properties?.edits).toBeDefined()
  })
})
