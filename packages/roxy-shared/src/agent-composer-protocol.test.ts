import { describe, expect, it } from 'vitest'
import { extractAgentProfileDirIds, validateAgentComposerTemplatePrompt } from './agent-composer-protocol'

describe('validateAgentComposerTemplatePrompt', () => {
  it('extracts and deduplicates profile ids from all profile references', () => {
    expect(extractAgentProfileDirIds(
      '在 [@profile:2](window-a, window-b) 和 [@profile:2](window-b,window-c) 中运行',
    )).toEqual(['window-a', 'window-b', 'window-c'])
  })

  it('accepts reusable input and URL tokens without a window token', () => {
    expect(validateAgentComposerTemplatePrompt(
      '在 [url:目标网址](https://example.com) 打开页面，搜索 [input:关键词]()。',
    )).toEqual({ valid: true, issues: [] })
  })

  it('rejects profile tokens and unsupported variables', () => {
    const result = validateAgentComposerTemplatePrompt('在 [@profile:0]() 使用 {{window}} 和 $TOKEN 执行任务。')

    expect(result.valid).toBe(false)
    expect(result.issues).toContain('Composer prompt must not contain browser-window selection tokens; select windows when using the template.')
    expect(result.issues).toContain('Composer prompt must not use double-brace variables.')
    expect(result.issues).toContain('Composer prompt must not use dollar variables.')
  })
})
