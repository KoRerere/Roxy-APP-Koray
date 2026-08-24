import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- agent-console tests use Node's built-in runner
import { describe, it } from 'node:test'
import { shouldConvertPastedTextToFile } from './pasteText'

describe('shouldConvertPastedTextToFile', () => {
  it('converts a stack trace with pathological long selector lines', () => {
    // Regression: a 3.5 KiB stack trace stayed below the 4 KiB/40-line limits,
    // entered Tiptap, and caused sustained CPU usage during link detection.
    const selectorLine = `button#target.${'utility-class.'.repeat(80)}`
    const stackTrace = [
      selectorLine,
      selectorLine,
      ...Array.from({ length: 9 }, (_, index) => `    at frame${index} (file:///tmp/script.mjs:${index + 1}:1)`),
    ].join('\n')

    assert.ok(stackTrace.length < 4000)
    assert.ok(stackTrace.split('\n').length < 40)
    assert.equal(shouldConvertPastedTextToFile(stackTrace), true)
  })

  it('keeps ordinary short multiline text in the composer', () => {
    assert.equal(shouldConvertPastedTextToFile('first line\nsecond line'), false)
  })

  it('keeps the existing total-length and line-count boundaries', () => {
    assert.equal(shouldConvertPastedTextToFile('a'.repeat(4000)), true)
    assert.equal(shouldConvertPastedTextToFile(Array.from({ length: 40 }).fill('line').join('\n')), true)
  })
})
