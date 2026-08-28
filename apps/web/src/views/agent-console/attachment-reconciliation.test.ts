import { describe, expect, it } from 'vitest'
import type { AgentAttachment } from './types'
import { reconcilePendingAttachments } from './attachment-reconciliation'

describe('reconcilePendingAttachments', () => {
  it('replaces a local-path attachment id with the materialized event attachment', () => {
    // Regression: optimistic local-path attachments kept their temporary fileId until refresh,
    // so immediate downloads requested /api/files/local-path-* and returned 404.
    const pending: AgentAttachment[] = [{
      fileId: 'local-path-1',
      kind: 'file',
      fileName: '截图.png',
      mimeType: 'image/png',
      localPath: 'C:\\screenshots\\截图.png',
      preview: 'roxy-media:C:\\screenshots\\截图.png',
      uploadStatus: 'uploaded',
    }]
    const eventAttachments: AgentAttachment[] = [{
      fileId: 'stored-file-1',
      kind: 'file',
      fileName: '截图.png',
      mimeType: 'image/png',
      size: 1024,
      url: '/api/files/stored-file-1',
      localUrl: '/api/files/stored-file-1',
      uploadStatus: 'uploaded',
    }]

    expect(reconcilePendingAttachments(pending, eventAttachments)).toEqual([{
      fileId: 'stored-file-1',
      kind: 'file',
      fileName: '截图.png',
      mimeType: 'image/png',
      size: 1024,
      url: '/api/files/stored-file-1',
      localUrl: '/api/files/stored-file-1',
      preview: 'roxy-media:C:\\screenshots\\截图.png',
      uploadStatus: 'uploaded',
    }])
  })

  it('preserves display-only folders and does not append hidden event attachments', () => {
    const pending: AgentAttachment[] = [{
      fileId: 'local-folder-1',
      kind: 'folder',
      fileName: '资料',
      mimeType: 'inode/directory',
      uploadStatus: 'uploaded',
    }, {
      fileId: 'stored-file-1',
      kind: 'file',
      fileName: 'visible.txt',
      mimeType: 'text/plain',
      uploadStatus: 'uploaded',
    }]
    const eventAttachments: AgentAttachment[] = [{
      fileId: 'stored-file-1',
      kind: 'file',
      fileName: 'visible.txt',
      mimeType: 'text/plain',
      url: '/api/files/stored-file-1',
      uploadStatus: 'uploaded',
    }, {
      fileId: 'nested-file-1',
      kind: 'file',
      fileName: '资料/nested.txt',
      mimeType: 'text/plain',
      uploadStatus: 'uploaded',
    }]

    const result = reconcilePendingAttachments(pending, eventAttachments)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(pending[0])
    expect(result[1]?.url).toBe('/api/files/stored-file-1')
  })
})
