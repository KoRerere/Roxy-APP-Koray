import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import { replaceSelectedLinksWithMarkdown } from './markdownSelection'

describe('replaceSelectedLinksWithMarkdown', () => {
  it('replaces rendered link labels with their complete Markdown sources', () => {
    const selectedText = '查看完整报告并继续'

    assert.equal(
      replaceSelectedLinksWithMarkdown(selectedText, [{
        start: 2,
        end: 6,
        markdown: '[完整报告](https://example.com/report)',
      }]),
      '查看[完整报告](https://example.com/report)并继续',
    )
  })

  it('keeps link replacements aligned when visible labels repeat', () => {
    const selectedText = '报告和报告'

    assert.equal(
      replaceSelectedLinksWithMarkdown(selectedText, [{
        start: 3,
        end: 5,
        markdown: '[报告](https://example.com/report)',
      }]),
      '报告和[报告](https://example.com/report)',
    )
  })

  it('restores the full link when only part of its rendered label is selected', () => {
    assert.equal(
      replaceSelectedLinksWithMarkdown('报告', [{
        start: 0,
        end: 2,
        markdown: '[完整报告](https://example.com/report)',
      }]),
      '[完整报告](https://example.com/report)',
    )
  })
})
