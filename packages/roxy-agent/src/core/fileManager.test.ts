import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ root: '' }))
const upload = vi.hoisted(() => vi.fn())
const insert = vi.hoisted(() => vi.fn(input => ({
  ...input,
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
})))

vi.mock('@/api/agentApiClient', () => ({ agentFilesApi: { upload } }))
vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    get orphanedUploadsDir() {
      return path.join(state.root, 'uploads')
    },
  },
}))
vi.mock('@/database/conversations', () => ({
  FileRecordStore: {
    getByHashAny: vi.fn(() => null),
    insert,
  },
}))

import { FileManager, generatedArtifactMimeType } from './fileManager'

describe('generatedArtifactMimeType', () => {
  it('maps accepted binary and script artifacts to upload MIME types', () => {
    expect(generatedArtifactMimeType('screen.png')).toBe('image/png')
    expect(generatedArtifactMimeType('bundle.zip')).toBe('application/zip')
    expect(generatedArtifactMimeType('automation.js')).toBe('text/javascript')
    expect(generatedArtifactMimeType('automation.ts')).toBe('text/typescript')
  })

  it('normalizes markdown and document-like text to text/plain', () => {
    expect(generatedArtifactMimeType('report.md')).toBe('text/plain')
    expect(generatedArtifactMimeType('page.html')).toBe('text/plain')
    expect(generatedArtifactMimeType('config.yaml')).toBe('text/plain')
  })

  it('returns undefined for unsupported binary extensions', () => {
    expect(generatedArtifactMimeType('archive.exe')).toBeUndefined()
    expect(generatedArtifactMimeType('unknown.bin')).toBeUndefined()
  })
})

describe('FileManager v3 uploads', () => {
  beforeEach(() => {
    state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-file-manager-'))
    upload.mockReset()
    insert.mockClear()
  })

  afterEach(() => {
    fs.rmSync(state.root, { recursive: true, force: true })
  })

  it('persists the OSS URL and upstream file reference for forwarded images', async () => {
    upload.mockResolvedValue({
      file_id: 'backend-file-1',
      filename: 'image.png',
      content_type: 'image/png',
      size: 3,
      url: 'https://oss.example/image.png',
      upstream_file_id: 'file-api-1',
      upstream_service: 'deepseek',
    })

    const record = await new FileManager().saveBuffer({
      buffer: Buffer.from('png'),
      fileName: 'image.png',
      mimeType: 'image/png',
      uploadNow: true,
      uploadOptions: {
        forward: true,
        model: 'deepseek-v4-flash-vision-exp',
      },
    })

    expect(upload).toHaveBeenCalledWith(
      expect.any(Blob),
      'image.png',
      { forward: true, model: 'deepseek-v4-flash-vision-exp' },
    )
    expect(record).toMatchObject({
      oss_url: 'https://oss.example/image.png',
      upstream_file_id: 'file-api-1',
      upstream_file_service: 'deepseek',
    })
  })
})
