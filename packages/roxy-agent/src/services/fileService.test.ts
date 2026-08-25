import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLocalAttachmentContent, buildNonImageAttachmentContent, buildUserMessageContent, materializeLocalAttachments, saveUpload } from './fileService'

const exists = vi.hoisted(() => vi.fn(() => true))
const readBuffer = vi.hoisted(() => vi.fn(() => Buffer.from('image-bytes')))
const saveBuffer = vi.hoisted(() => vi.fn())
const getRuntimeModel = vi.hoisted(() => vi.fn())

vi.mock('@/core/fileManager', () => ({
  fileManager: { exists, readBuffer, saveBuffer, getLocalPath: vi.fn((fileId: string) => `/tmp/${fileId}`) },
  resolveFileMimeType: vi.fn((mimeType: string | undefined) => mimeType || 'application/octet-stream'),
}))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    sessionUploadsDir: (conversationId: string) => `/tmp/${conversationId}/uploads`,
  },
}))
vi.mock('@/database/conversations', () => ({ FileRecordStore: {} }))
vi.mock('@/runtime/provider', () => ({ getRuntimeModel }))
vi.mock('../config', () => ({ env: { SYSTEM_LANGUAGE: 'en' } }))

const tempDirs: string[] = []

describe('attachment message content', () => {
  beforeEach(() => {
    exists.mockClear()
    readBuffer.mockClear()
    saveBuffer.mockReset()
    getRuntimeModel.mockReset()
  })

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('uses an upstream file block for a forwarded VLM image', () => {
    const blocks = buildUserMessageContent('Describe this', [{
      fileId: 'image-1',
      fileName: 'image.png',
      mimeType: 'image/png',
      upstreamFileId: 'file-api-1',
      upstreamFileService: 'deepseek',
    }])

    expect(blocks).toEqual([
      { type: 'text', text: 'Describe this' },
      { type: 'file', fileId: 'file-api-1' },
    ])
    expect(readBuffer).not.toHaveBeenCalled()
  })

  it('keeps a non-VLM image out of visible content and in hidden attachment context', () => {
    const attachment = {
      fileId: 'image-1',
      fileName: 'image.png',
      mimeType: 'image/png',
    }

    expect(buildUserMessageContent('Describe this', [attachment])).toEqual([
      { type: 'text', text: 'Describe this' },
    ])
    expect(buildNonImageAttachmentContent([attachment])).toBe(
      '[attachment] filename: image.png, local path: /tmp/image-1, type: image/png',
    )
    expect(readBuffer).not.toHaveBeenCalled()
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

  it('materializes Electron-selected VLM images as upstream file blocks', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'roxy-local-image-'))
    tempDirs.push(tempDir)
    const imagePath = path.join(tempDir, 'screen.png')
    writeFileSync(imagePath, Buffer.from('local-image-bytes'))

    getRuntimeModel.mockResolvedValue({
      model: 'deepseek-v4-flash-vision-exp',
      modelType: 'vlm_model',
    })
    saveBuffer.mockResolvedValue({
      file_id: 'local-image',
      mime_type: 'image/png',
      size: 17,
      oss_url: 'https://oss.example/image.png',
      upstream_file_id: 'file-api-1',
      upstream_file_service: 'deepseek',
    })

    const materialized = await materializeLocalAttachments([{
      kind: 'file',
      fileName: 'screen.png',
      mimeType: 'image/png',
      localPath: imagePath,
    }], 'conversation-1')
    const blocks = buildUserMessageContent('Describe this', materialized.attachments)

    expect(blocks).toEqual([
      { type: 'text', text: 'Describe this' },
      { type: 'file', fileId: 'file-api-1' },
    ])
    expect(materialized.remainingLocalAttachments).toEqual([])
    expect(saveBuffer).toHaveBeenCalledWith(expect.objectContaining({
      uploadNow: true,
      uploadOptions: {
        forward: true,
        model: 'deepseek-v4-flash-vision-exp',
      },
    }))
  })

  it('keeps remaining local folders in hidden attachment content', () => {
    const content = buildLocalAttachmentContent([
      {
        kind: 'folder',
        fileName: 'work',
        mimeType: 'inode/directory',
        localPath: '/tmp/work',
      },
    ])

    expect(content).toBe('[folder] name: work, local path: /tmp/work')
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

  it('forwards supported images only when the selected runtime model is vlm_model', async () => {
    getRuntimeModel.mockResolvedValue({
      model: 'deepseek-v4-flash-vision-exp',
      modelType: 'vlm_model',
    })
    saveBuffer.mockResolvedValue({
      file_id: 'local-image',
      mime_type: 'image/png',
      size: 3,
      oss_url: 'https://oss.example/image.png',
      upstream_file_id: 'file-api-1',
      upstream_file_service: 'deepseek',
    })

    const result = await saveUpload({
      data: Buffer.from('png').toString('base64'),
      mimeType: 'image/png',
      fileName: 'image.png',
      conversationId: 'conversation-1',
    })

    expect(saveBuffer).toHaveBeenCalledWith(expect.objectContaining({
      uploadNow: true,
      uploadOptions: {
        forward: true,
        model: 'deepseek-v4-flash-vision-exp',
      },
    }))
    expect(result.remoteUrl).toBe('https://oss.example/image.png')
  })

  it('uploads a text-model image to OSS without forwarding it', async () => {
    getRuntimeModel.mockResolvedValue({
      model: 'deepseek-v4-flash',
      modelType: 'text_model',
    })
    saveBuffer.mockResolvedValue({
      file_id: 'local-image',
      mime_type: 'image/png',
      size: 3,
      oss_url: 'https://oss.example/image.png',
    })

    await saveUpload({
      data: Buffer.from('png').toString('base64'),
      mimeType: 'image/png',
      fileName: 'image.png',
    })

    expect(saveBuffer).toHaveBeenCalledWith(expect.not.objectContaining({ uploadOptions: expect.anything() }))
  })

  it('uploads non-image attachments to OSS without resolving a runtime model', async () => {
    saveBuffer.mockResolvedValue({
      file_id: 'local-text',
      mime_type: 'text/plain',
      size: 4,
      oss_url: 'https://oss.example/notes.txt',
    })

    await saveUpload({
      data: Buffer.from('text').toString('base64'),
      mimeType: 'text/plain',
      fileName: 'notes.txt',
    })

    expect(getRuntimeModel).not.toHaveBeenCalled()
    expect(saveBuffer).toHaveBeenCalledWith(expect.objectContaining({ uploadNow: true }))
    expect(saveBuffer).toHaveBeenCalledWith(expect.not.objectContaining({ uploadOptions: expect.anything() }))
  })
})
