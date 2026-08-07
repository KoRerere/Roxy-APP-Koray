import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FeedbackImageCandidate } from './feedback'
import {
  getFeedbackErrorMessage,
  MAX_FEEDBACK_IMAGES,
  readFeedbackSubmission,
  readFeedbackUpload,
  resolveFeedbackPlatform,
  selectFeedbackImages,
} from './feedback'

function image(name: string, overrides: Partial<FeedbackImageCandidate> = {}): FeedbackImageCandidate {
  return {
    lastModified: 1,
    name,
    size: 100,
    type: 'image/png',
    ...overrides,
  }
}

describe('selectFeedbackImages', () => {
  it('keeps unique images and reports invalid, duplicate, and overflow items', () => {
    const existing = Array.from({ length: MAX_FEEDBACK_IMAGES - 1 }, (_, index) => image(`${index}.png`))
    const selection = selectFeedbackImages(existing, [
      image('0.png'),
      image('notes.txt', { type: 'text/plain' }),
      image('accepted.png'),
      image('overflow.png'),
    ])

    assert.deepEqual(selection.accepted.map(file => file.name), ['accepted.png'])
    assert.equal(selection.duplicateCount, 1)
    assert.equal(selection.invalidCount, 1)
    assert.equal(selection.overflowCount, 1)
  })
})

describe('feedback API response readers', () => {
  it('reads uploaded OSS file information', () => {
    const uploaded = readFeedbackUpload({
      code: 0,
      data: {
        file_id: 'file-1',
        filename: 'image.png',
        content_type: 'image/png',
        size: 123,
        url: 'https://cdn.example.com/image.png',
      },
      message: 'ok',
    }, 'upload failed')

    assert.equal(uploaded.file_id, 'file-1')
  })

  it('preserves the backend error message for a rejected submission', () => {
    assert.throws(
      () => readFeedbackSubmission({ code: 400, message: '联系方式与反馈内容不能为空' }, 'submit failed'),
      /联系方式与反馈内容不能为空/,
    )
  })

  it('reads a successful feedback record', () => {
    const feedback = readFeedbackSubmission({
      code: 0,
      data: {
        id: 42,
        userId: 'user-1',
        contact: 'hello@example.com',
        content: 'Please add this feature.',
        status: 'pending',
      },
      message: 'ok',
    }, 'submit failed')

    assert.equal(feedback.id, 42)
  })

  it('reads a backend message from a rejected HTTP response', () => {
    assert.equal(getFeedbackErrorMessage({
      message: 'Request failed with status code 400',
      response: { data: { message: '最多 9 张图片' } },
    }, 'submit failed'), '最多 9 张图片')
  })
})

describe('resolveFeedbackPlatform', () => {
  it('prefers userAgentData and limits the persisted value to 64 characters', () => {
    const platform = resolveFeedbackPlatform({
      platform: 'MacIntel',
      userAgent: 'fallback',
      userAgentData: { platform: 'Windows'.repeat(20) },
    })

    assert.equal(platform, 'Windows'.repeat(20).slice(0, 64))
  })
})
