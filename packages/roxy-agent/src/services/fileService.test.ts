import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLocalAttachmentContent, buildNonImageAttachmentContent, buildUserMessageContent } from './fileService'

const exists = vi.hoisted(() => vi.fn(() => true))
const readBuffer = vi.hoisted(() => vi.fn(() => Buffer.from('image-bytes')))

vi.mock('@/core/fileManager', () => ({
  fileManager: { exists, readBuffer, getLocalPath: vi.fn((fileId: string) => `/tmp/${fileId}`) },
  resolveFileMimeType: vi.fn((mimeType: string | undefined) => mimeType || 'application/octet-stream'),
}))

vi.mock('@/core/storage/agentPaths', () => ({ agentPaths: {} }))
vi.mock('@/database/conversations', () => ({ FileRecordStore: {} }))
vi.mock('../config', () => ({ env: { SYSTEM_LANGUAGE: 'en' } }))

const tempDirs: string[] = []

describe('attachment message content', () => {
  beforeEach(() => {
    exists.mockClear()
    readBuffer.mockClear()
  })

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('encodes supported image attachments as raw base64 image blocks without prompt text', () => {
    const blocks = buildUserMessageContent('Describe this', [{
      fileId: 'image-1',
      fileName: 'image.png',
      mimeType: 'image/png',
    }])

    expect(blocks).toEqual([
      { type: 'text', text: 'Describe this' },
      { type: 'image', mimeType: 'image/png', data: Buffer.from('image-bytes').toString('base64') },
    ])
  })

  it('aggregates non-image attachments into one separate text message', () => {
    const content = buildNonImageAttachmentContent([
      { fileId: 'text-1', fileName: 'notes.txt', mimeType: 'text/plain' },
      { fileId: 'archive-1', fileName: 'bundle.zip', mimeType: 'application/zip' },
    ])

    expect(content).toBe([
      '[file: notes.txt]\nimage-bytes',
      '[attachment] filename: bundle.zip, local path: /tmp/archive-1, type: application/zip',
    ].join('\n\n'))
  })

  it('reads Electron-selected local images as raw base64 blocks', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'roxy-local-image-'))
    tempDirs.push(tempDir)
    const imagePath = path.join(tempDir, 'screen.png')
    writeFileSync(imagePath, Buffer.from('local-image-bytes'))

    const blocks = buildUserMessageContent('Describe this', [], [{
      kind: 'file',
      fileName: 'screen.png',
      mimeType: 'image/png',
      localPath: imagePath,
    }])

    expect(blocks).toEqual([
      { type: 'text', text: 'Describe this' },
      { type: 'image', mimeType: 'image/png', data: Buffer.from('local-image-bytes').toString('base64') },
    ])
  })

  it('keeps local non-image files and folders in hidden attachment content', () => {
    const content = buildLocalAttachmentContent([
      {
        kind: 'file',
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        localPath: '/tmp/notes.txt',
      },
      {
        kind: 'folder',
        fileName: 'work',
        mimeType: 'inode/directory',
        localPath: '/tmp/work',
      },
      {
        kind: 'file',
        fileName: 'screen.png',
        mimeType: 'image/png',
        localPath: '/tmp/screen.png',
      },
    ])

    expect(content).toBe([
      '[file] name: notes.txt, local path: /tmp/notes.txt',
      '[folder] name: work, local path: /tmp/work',
    ].join('\n'))
  })

  it('does not add unsupported image prompt text to the visible user message', () => {
    const blocks = buildUserMessageContent('', [{
      fileId: 'image-2',
      fileName: 'vector.svg',
      mimeType: 'image/svg+xml',
    }])

    expect(blocks).toEqual([])
    expect(readBuffer).not.toHaveBeenCalled()
  })

  it('keeps unsupported local image formats in hidden attachment content', () => {
    const content = buildLocalAttachmentContent([{
      kind: 'file',
      fileName: 'vector.svg',
      mimeType: 'image/svg+xml',
      localPath: '/tmp/vector.svg',
    }])

    expect(content).toBe('[file] name: vector.svg, local path: /tmp/vector.svg')
  })
})
