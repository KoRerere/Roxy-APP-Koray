import { describe, expect, it } from 'vitest'
import { splitOverlongLine, createContentPreview, capEntries } from '../../src/tools/builtin/truncate.ts'

describe('splitOverlongLine', () => {
  it('returns the line unchanged when under the max', () => {
    expect(splitOverlongLine('hello', 10, 5)).toEqual(['5\thello'])
  })

  it('splits a long line into numbered continuation chunks', () => {
    const long = 'x'.repeat(25)
    const parts = splitOverlongLine(long, 10, 5)
    // first chunk carries the base number; continuations are 5.1, 5.2, ...
    expect(parts[0]).toMatch(/^5\t/)
    expect(parts.length).toBeGreaterThan(1)
    // every chunk body ≤ 10 chars
    for (const p of parts) {
      expect(p.split('\t')[1]!.length).toBeLessThanOrEqual(10)
    }
  })
})

describe('createContentPreview', () => {
  it('returns all lines (numbered) when content fits head+tail', () => {
    const { preview } = createContentPreview('a\nb\nc', 5, 5)
    expect(preview).toContain('1\ta')
    expect(preview).toContain('3\tc')
  })

  it('shows head + elision + tail for larger content', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `L${i}`).join('\n')
    const { preview, omitted } = createContentPreview(lines, 5, 5)
    expect(omitted).toBe(10)
    expect(preview).toContain('L0')
    expect(preview).toContain('L19')
    expect(preview).toContain('lines truncated')
    expect(preview).not.toContain('L10')
  })
})

describe('capEntries', () => {
  it('returns entries unchanged under the cap', () => {
    expect(capEntries(['a', 'b'], 5, 'X')).toEqual(['a', 'b'])
  })

  it('caps and appends a footer noting the total', () => {
    const entries = Array.from({ length: 10 }, (_, i) => `e${i}`)
    const out = capEntries(entries, 3, '(capped)')
    expect(out).toEqual(['e0', 'e1', 'e2', '(capped)'])
    expect(capEntries(entries, 3, 'X')[3]).toBe('X')
  })
})
