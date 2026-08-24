import { describe, expect, it } from 'vitest'
import {
  buildWindow,
  formatReadOutput,
  READ_MAX_BYTES,
  READ_MAX_LINE_LENGTH,
} from '../../src/tools/builtin/read_file_render.ts'

describe('read_file render parity', () => {
  it('builds a 1-based window across arbitrary chunks', async () => {
    // Regression: read_file used split('\n') on whole-file content and treated
    // offset as zero-based, which diverged from the DSH read contract.
    // Fixed by: build windows from decoded chunks with 1-based line numbers.
    const window = await buildWindow(
      ['L1\nL', '2\r\nL3'],
      {
        offset: 2,
        limit: 1,
        maxLineLength: READ_MAX_LINE_LENGTH,
        maxBytes: READ_MAX_BYTES,
      },
      '/tmp/file.txt',
    )

    expect(window).toEqual({
      lines: [{ number: 2, text: 'L2' }],
      totalLines: 3,
      truncatedByBytes: false,
    })
  })

  it('keeps empty files empty and allows offset 1', async () => {
    // Regression: splitting an empty string produced one empty line, so empty
    // files looked like they had line 1.
    // Fixed by: only flush a final line when buffered content exists.
    const window = await buildWindow(
      [''],
      {
        offset: 1,
        limit: 10,
        maxLineLength: READ_MAX_LINE_LENGTH,
        maxBytes: READ_MAX_BYTES,
      },
      '/tmp/empty.txt',
    )

    expect(window.lines).toEqual([])
    expect(window.totalLines).toBe(0)
  })

  it('truncates a giant line with the DSH suffix instead of continuation lines', async () => {
    // Regression: overlong lines were split into N.1/N.2 continuation rows,
    // which does not match DSH output and can confuse line references.
    // Fixed by: keep one numbered line with a truncation suffix.
    const window = await buildWindow(
      ['x'.repeat(READ_MAX_LINE_LENGTH + 500)],
      {
        offset: 1,
        limit: 1,
        maxLineLength: READ_MAX_LINE_LENGTH,
        maxBytes: READ_MAX_BYTES,
      },
      '/tmp/long.txt',
    )

    expect(window.lines).toHaveLength(1)
    expect(window.lines[0]!.text).toBe(
      `${'x'.repeat(READ_MAX_LINE_LENGTH)}... (line truncated to ${READ_MAX_LINE_LENGTH} chars)`,
    )
    expect(window.lines[0]!.number).toBe(1)
  })

  it('caps selected output bytes and renders the output-capped footer', async () => {
    // Regression: read_file relied on outer eviction and did not cap the
    // selected window itself.
    // Fixed by: stop collecting selected lines once readMaxBytes is reached.
    const window = await buildWindow(
      ['alpha\nbravo\ncharlie'],
      {
        offset: 1,
        limit: 3,
        maxLineLength: READ_MAX_LINE_LENGTH,
        maxBytes: 12,
      },
      '/tmp/capped.txt',
    )

    expect(window.lines).toEqual([
      { number: 1, text: 'alpha' },
      { number: 2, text: 'bravo' },
    ])
    expect(window.totalLines).toBe(3)
    expect(window.truncatedByBytes).toBe(true)
    expect(
      formatReadOutput('/tmp/capped.txt', {
        offset: 1,
        lines: window.lines,
        totalLines: window.totalLines,
        truncatedByBytes: true,
      }),
    ).toContain('(Output capped. Showing lines 1-2. Use offset=3 to continue.)')
  })

  it('throws when offset is past EOF', async () => {
    // Regression: offset beyond EOF returned a successful pseudo-footer instead
    // of an error, hiding bad pagination calls from the model.
    // Fixed by: treat out-of-range offsets as read errors.
    await expect(
      buildWindow(
        ['L1\nL2\nL3'],
        {
          offset: 9,
          limit: 1,
          maxLineLength: READ_MAX_LINE_LENGTH,
          maxBytes: READ_MAX_BYTES,
        },
        '/tmp/file.txt',
      ),
    ).rejects.toThrow('offset 9 is out of range for "/tmp/file.txt" (3 lines)')
  })

  it('formats the DSH read envelope and EOF footer', () => {
    const output = formatReadOutput('/tmp/file.txt', {
      offset: 2,
      lines: [{ number: 2, text: 'bravo' }],
      totalLines: 2,
    })

    expect(output).toBe(`<path>/tmp/file.txt</path>
<type>file</type>
<content>
2: bravo

(End of file - total 2 lines)
</content>`)
  })
})
