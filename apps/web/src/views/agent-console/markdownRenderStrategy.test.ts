import { describe, expect, it, vi } from 'vitest'
import { resolveMarkdownRenderContent } from './markdownRenderStrategy'

describe('resolveMarkdownRenderContent', () => {
  it('keeps streaming output as plain text without invoking the Markdown renderer', () => {
    // Regression: every 50 ms content delta reparsed the complete accumulated
    // answer as Markdown, making long streamed answers progressively slower.
    // Fixed by: rendering lightweight text while streaming and Markdown once terminal.
    const render = vi.fn((content: string) => `<p>${content}</p>`)

    expect(resolveMarkdownRenderContent('**partial**', true, render)).toEqual({
      kind: 'text',
      content: '**partial**',
    })
    expect(render).not.toHaveBeenCalled()

    expect(resolveMarkdownRenderContent('**done**', false, render)).toEqual({
      kind: 'html',
      content: '<p>**done**</p>',
    })
    expect(render).toHaveBeenCalledOnce()
  })
})
