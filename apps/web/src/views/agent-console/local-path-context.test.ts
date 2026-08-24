import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import { describe, it } from 'node:test'
import type { AgentAttachment } from './types'
import { collectLocalPathAttachments } from './local-path-context'

function createAttachment(overrides: Partial<AgentAttachment>): AgentAttachment {
  return {
    fileId: 'file-1',
    fileName: 'tiktok_upload_publish.ts',
    kind: 'file',
    mimeType: 'text/typescript',
    ...overrides,
  }
}

describe('agent local path context', () => {
  it('serializes local attachment metadata without prompt text', () => {
    const result = collectLocalPathAttachments([
      createAttachment({ localPath: 'D:\\workspaces\\tiktok_upload_publish\\tiktok_upload_publish.ts' }),
    ])

    assert.deepEqual(result, [{
      kind: 'file',
      fileName: 'tiktok_upload_publish.ts',
      mimeType: 'text/typescript',
      localPath: 'D:\\workspaces\\tiktok_upload_publish\\tiktok_upload_publish.ts',
    }])
  })

  it('ignores uploaded attachments that have no local path', () => {
    const result = collectLocalPathAttachments([createAttachment({ fileId: 'uploaded-file' })])

    assert.deepEqual(result, [])
  })
})
