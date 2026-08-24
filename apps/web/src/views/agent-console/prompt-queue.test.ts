import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import { describe, it } from 'node:test'
import { createQueuedPrompt, queuedPromptDisplayContent, removeQueuedPrompt, reorderQueuedPrompt } from './prompt-queue'

describe('agent prompt queue', () => {
  it('retains attachment metadata without changing the queued display content', () => {
    const attachments = [{
      fileId: 'local-file-1',
      kind: 'file' as const,
      fileName: 'tiktok_upload_publish.ts',
      mimeType: 'text/typescript',
      localPath: 'D:\\workspaces\\tiktok_upload_publish\\tiktok_upload_publish.ts',
    }]

    const queued = createQueuedPrompt(
      'conversation-1',
      '',
      1,
      { attachments, draftContent: '' },
    )

    assert.equal(queued.content, '')
    assert.equal(queued.draftContent, '')
    assert.deepEqual(queued.attachments, attachments)
    assert.equal(queuedPromptDisplayContent(queued), 'tiktok_upload_publish.ts')
  })

  it('removes a specific queued prompt without affecting the others', () => {
    const queue = [
      createQueuedPrompt('conversation-1', 'first', 1),
      createQueuedPrompt('conversation-1', 'second', 2),
    ]

    const removed = removeQueuedPrompt(queue, queue[0]!.id)

    assert.equal(removed?.content, 'first')
    assert.deepEqual(queue.map(item => item.content), ['second'])
  })

  it('moves a queued prompt to the requested position', () => {
    const queue = [
      createQueuedPrompt('conversation-1', 'first', 1),
      createQueuedPrompt('conversation-1', 'second', 2),
      createQueuedPrompt('conversation-1', 'third', 3),
    ]

    assert.equal(reorderQueuedPrompt(queue, queue[2]!.id, 0), true)
    assert.deepEqual(queue.map(item => item.content), ['third', 'first', 'second'])
  })
})
