import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  buildConversationTitlePrompt,
  generateConversationTitleWithRetry,
} from './conversationTitle'

describe('conversation title prompt language', () => {
  it('passes the Agent locale through and keeps the generator prompt in English', () => {
    // Regression: the title prompt tried to hardcode language selection, which
    // duplicated locale logic and drifted away from the actual Agent setting.
    // Fixed by: forwarding the raw SYSTEM_LANGUAGE locale and letting the model
    // infer the title language from it.
    const prompt = buildConversationTitlePrompt({
      messageContent: 'Keep the script running while I edit files',
      systemLanguage: 'zh-CN',
    })

    expect(prompt).toContain('You are a professional conversation title generator.')
    expect(prompt).toContain('System language locale: zh-CN')
    expect(prompt).toContain('Infer the target title language from the system language locale.')
  })

  it('passes English locale unchanged', () => {
    const prompt = buildConversationTitlePrompt({
      messageContent: '脚本持续运行修改',
      systemLanguage: 'en',
    })

    expect(prompt).toContain('System language locale: en')
  })

  it('falls back to unknown when the Agent language is missing', () => {
    const prompt = buildConversationTitlePrompt({
      messageContent: '12345',
    })

    expect(prompt).toContain('System language locale: unknown')
  })
})

describe('conversation title retry', () => {
  it('retries once with the first generated content and validation error appended to the original prompt', async () => {
    const prompts: string[] = []
    const candidates = [
      { title: 'This title is longer than forty characters and must be retried' },
      { title: 'Concise retry title' },
    ]
    const schema = z.object({
      title: z.string().max(40, 'Title must not exceed 40 characters'),
    })

    const title = await generateConversationTitleWithRetry({
      originalPrompt: 'Original title prompt',
      generate: async (prompt) => {
        prompts.push(prompt)
        return candidates.shift()!
      },
      validate: candidate => schema.parse(candidate).title,
    })

    expect(title).toBe('Concise retry title')
    expect(prompts).toHaveLength(2)
    expect(prompts[1]).toContain('Original title prompt')
    expect(prompts[1]).toContain('This title is longer than forty characters and must be retried')
    expect(prompts[1]).toContain('Title must not exceed 40 characters')
  })

  it('does not retry when the first title is valid', async () => {
    const prompts: string[] = []

    const title = await generateConversationTitleWithRetry({
      originalPrompt: 'Original title prompt',
      generate: async (prompt) => {
        prompts.push(prompt)
        return { title: 'Valid title' }
      },
      validate: candidate => candidate.title,
    })

    expect(title).toBe('Valid title')
    expect(prompts).toEqual(['Original title prompt'])
  })

  it('does not retry errors rejected by the retry policy', async () => {
    const cancelled = new DOMException('User cancelled', 'AbortError')
    let attempts = 0

    await expect(generateConversationTitleWithRetry({
      originalPrompt: 'Original title prompt',
      generate: async () => {
        attempts++
        throw cancelled
      },
      validate: () => 'unused',
      shouldRetry: () => false,
    })).rejects.toBe(cancelled)

    expect(attempts).toBe(1)
  })

  it('does not perform a third attempt when retry validation also fails', async () => {
    let attempts = 0

    await expect(generateConversationTitleWithRetry({
      originalPrompt: 'Original title prompt',
      generate: async () => {
        attempts++
        return { title: 'still invalid' }
      },
      validate: () => {
        throw new Error('invalid title')
      },
    })).rejects.toThrow('invalid title')

    expect(attempts).toBe(2)
  })
})
