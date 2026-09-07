import { describe, expect, it } from 'vitest'
import { extractAgentProfileDirIds, inspectAgentComposerTemplateInputs, validateAgentComposerTemplatePrompt } from './agent-composer-protocol'

describe('validateAgentComposerTemplatePrompt', () => {
  it('extracts and deduplicates profile ids from all profile references', () => {
    expect(extractAgentProfileDirIds(
      '在 [@profile:2](window-a, window-b) 和 [@profile:2](window-b,window-c) 中运行',
    )).toEqual(['window-a', 'window-b', 'window-c'])
  })

  it('accepts reusable input and URL tokens without a window token', () => {
    expect(validateAgentComposerTemplatePrompt(
      '在 [url:目标网址](https://example.com) 打开页面，搜索 [input:关键词](示例)。',
    )).toEqual({ valid: true, issues: [] })
  })

  it.each([
    '[input:关键词]()',
    '[input:关键词]',
    '[input:关键词](   )',
    '[url:关键词]()',
    '[textarea:关键词](\n  \n)',
  ])('rejects unfilled template parameters: %s', (prompt) => {
    expect(validateAgentComposerTemplatePrompt(prompt).valid).toBe(false)
    expect(inspectAgentComposerTemplateInputs(prompt).missingInputLabels).toEqual(['关键词'])
  })

  it.each([
    '[@profile:0]()',
    '[@profile:1](01a8e607e20e9b53fdaed89aaa890886)',
    '[@profile:2](window-a,window-b)',
  ])('rejects browser selection regardless of selected count: %s', (prompt) => {
    expect(inspectAgentComposerTemplateInputs(prompt).hasProfileSelection).toBe(true)
    expect(validateAgentComposerTemplatePrompt(prompt).valid).toBe(false)
  })

  it('deduplicates missing labels and keeps filled or plain content valid', () => {
    expect(inspectAgentComposerTemplateInputs('[input:关键词]() [url:网址] [textarea:关键词]()')).toEqual({
      hasProfileSelection: false,
      missingInputLabels: ['关键词', '网址'],
    })
    for (const prompt of ['', '普通提示词', '[input:数量](0) [textarea:备注](第一行\n第二行) [url:网址](https://example.com)']) {
      expect(inspectAgentComposerTemplateInputs(prompt)).toEqual({
        hasProfileSelection: false,
        missingInputLabels: [],
      })
    }
    expect(validateAgentComposerTemplatePrompt('[textarea:备注](第一行\n第二行)').valid).toBe(true)
  })

  it('rejects profile tokens and unsupported variables', () => {
    const result = validateAgentComposerTemplatePrompt('在 [@profile:0]() 使用 {{window}} 和 $TOKEN 执行任务。')

    expect(result.valid).toBe(false)
    expect(result.issues).toContain('Composer prompt must not contain browser-window selection tokens; select windows when using the template.')
    expect(result.issues).toContain('Composer prompt must not use double-brace variables.')
    expect(result.issues).toContain('Composer prompt must not use dollar variables.')
  })
})
