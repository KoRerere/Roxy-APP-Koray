import { describe, expect, it } from 'vitest'
import { buildConversationTitlePrompt } from './conversationTitle'

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
