import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- agent-console tests use Node's built-in runner
import { describe, it } from 'node:test'
import { getClipboardFiles } from './clipboardFiles'

function createFileLike(lastModified: number) {
  return {
    lastModified,
    name: 'image.png',
    size: 1024,
    type: 'image/png',
  } as File
}

describe('getClipboardFiles', () => {
  it('does not materialize the same clipboard image from both files and items', () => {
    const fileFromFiles = createFileLike(1_000)
    const fileFromItem = createFileLike(1_001)
    let getAsFileCalls = 0

    const result = getClipboardFiles({
      files: [fileFromFiles],
      items: [{
        kind: 'file',
        getAsFile: () => {
          getAsFileCalls += 1
          return fileFromItem
        },
      }],
    })

    assert.deepEqual(result, [fileFromFiles])
    assert.equal(getAsFileCalls, 0)
  })

  it('falls back to file-kind clipboard items when files is empty', () => {
    const image = createFileLike(1_000)

    const result = getClipboardFiles({
      files: [],
      items: [
        { kind: 'string', getAsFile: () => null },
        { kind: 'file', getAsFile: () => image },
        { kind: 'file', getAsFile: () => null },
      ],
    })

    assert.deepEqual(result, [image])
  })

  it('returns an empty list when clipboard data is unavailable', () => {
    assert.deepEqual(getClipboardFiles(null), [])
  })
})
