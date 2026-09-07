import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- agent-console tests use Node's built-in runner
import { describe, it } from 'node:test'
import { createClipboardPathAttachment, getClipboardFileSources, getClipboardFiles, splitClipboardFilesByLocalPath } from './clipboardFiles'

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

  it('preserves directory entries from clipboard items', () => {
    const folder = createFileLike(1_000)
    const entry = { isDirectory: true, isFile: false, name: 'workspace' }

    const result = getClipboardFileSources({
      files: [folder],
      items: [{
        kind: 'file',
        getAsFile: () => folder,
        webkitGetAsEntry: () => entry,
      }],
    })

    assert.deepEqual(result, [{ file: folder, entry }])
  })
})

describe('splitClipboardFilesByLocalPath', () => {
  it('keeps local-path files separate from files that need upload fallback', () => {
    const localFile = createFileLike(1_000)
    const clipboardImage = createFileLike(1_001)

    const result = splitClipboardFilesByLocalPath(
      [localFile, clipboardImage],
      file => file === localFile ? 'C:\\Users\\test\\document.pdf' : '',
    )

    assert.deepEqual(result.localPathFiles, [{
      file: localFile,
      path: 'C:\\Users\\test\\document.pdf',
    }])
    assert.deepEqual(result.uploadFiles, [clipboardImage])
  })

  it('does not lose files when no local path can be resolved', () => {
    const files = [createFileLike(1_000), createFileLike(1_001)]

    const result = splitClipboardFilesByLocalPath(files, () => '')

    assert.deepEqual(result, {
      localPathFiles: [],
      uploadFiles: files,
    })
  })
})

describe('createClipboardPathAttachment', () => {
  it('maps a directory path to a folder attachment', () => {
    assert.deepEqual(
      createClipboardPathAttachment(
        'workspace',
        'C:\\Users\\test\\workspace',
        { isDirectory: true, isFile: false, name: 'workspace' },
      ),
      {
        kind: 'folder',
        name: 'workspace',
        path: 'C:\\Users\\test\\workspace',
      },
    )
  })

  it('falls back to a file attachment when path information is unavailable', () => {
    assert.deepEqual(
      createClipboardPathAttachment('', 'C:\\Users\\test\\document.pdf', null),
      {
        kind: 'file',
        name: 'document.pdf',
        path: 'C:\\Users\\test\\document.pdf',
      },
    )
  })
})
