import { describe, expect, it } from 'vitest'
import { applyDiff } from '../../../src/tools/builtin/apply_diff.ts'

describe('applyDiff', () => {
  it('creates file content from plus-prefixed lines', () => {
    expect(applyDiff('', '+alpha\n+beta', 'create')).toBe('alpha\nbeta')
  })

  it('applies an anchored update with multiple chunks', () => {
    const input = ['before', 'function run() {', '  const one = 1', '  const two = 2', '}', 'after', ''].join('\n')
    const diff = [
      '@@ function run() {',
      '-  const one = 1',
      '+  const one = 10',
      '   const two = 2',
      '-}',
      '+  return one + two',
      '+}',
    ].join('\n')

    expect(applyDiff(input, diff)).toBe(
      [
        'before',
        'function run() {',
        '  const one = 10',
        '  const two = 2',
        '  return one + two',
        '}',
        'after',
        '',
      ].join('\n'),
    )
  })

  it('matches anchors and context after trimming whitespace', () => {
    const input = ['header', '  function run() {  ', '    return 1  ', '  }', ''].join('\n')
    const diff = ['@@ function run() {', '-return 1', '+return 2'].join('\n')

    expect(applyDiff(input, diff)).toBe(['header', '  function run() {  ', 'return 2', '  }', ''].join('\n'))
  })

  it('uses end-of-file context and preserves the original trailing newline', () => {
    const input = ['same', 'target', 'same', 'target', ''].join('\n')
    const diff = ['@@', ' same', '-target', '+updated', ' ', '*** End of File'].join('\n')

    expect(applyDiff(input, diff)).toBe(['same', 'target', 'same', 'updated', ''].join('\n'))
  })

  it('rejects malformed create and update diffs', () => {
    expect(() => applyDiff('', 'missing-plus', 'create')).toThrow(/Invalid Add File Line/)
    expect(() => applyDiff('alpha\n', '@@\n-beta\n+gamma')).toThrow(/Invalid Context/)
    expect(() => applyDiff('alpha\n', '@@\ninvalid')).toThrow(/Invalid Line/)
  })
})
