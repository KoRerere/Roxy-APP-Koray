import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ComposerLink } from './extensions'

describe('composer link boundaries', () => {
  it('only auto-links URLs with an explicit HTTP protocol', () => {
    const shouldAutoLink = ComposerLink.options.shouldAutoLink

    assert.equal(shouldAutoLink('http://example.com/docs'), true)
    assert.equal(shouldAutoLink('https://example.com/docs'), true)
    assert.equal(shouldAutoLink('HTTPS://EXAMPLE.COM/docs'), true)
    assert.equal(shouldAutoLink('example.com/docs'), false)
    assert.equal(shouldAutoLink('www.example.com/docs'), false)
    assert.equal(shouldAutoLink('Object.click'), false)
    assert.equal(shouldAutoLink('cds-reset.group/btn.relative.cursor-[var(--interactive)]'), false)
    assert.equal(shouldAutoLink('file:///tmp/script.mjs:1:1'), false)
  })

  it('does not extend a pasted link when typing at its trailing edge', () => {
    const schema = getSchema([
      StarterKit.configure({ link: false }),
      ComposerLink,
    ])

    assert.equal(schema.marks.link.spec.inclusive, false)
    assert.equal(schema.marks.link.spec.attrs?.markdownSource?.default, null)
    assert.equal(ComposerLink.options.autolink, true)
  })

  it('adds a favicon target to web links without changing their href', () => {
    const schema = getSchema([
      StarterKit.configure({ link: false }),
      ComposerLink,
    ])
    const linkMark = schema.marks.link.create({ href: 'https://example.com/docs' })
    const rendered = ComposerLink.config.renderHTML?.call({
      options: ComposerLink.options,
    } as never, { HTMLAttributes: { href: 'https://example.com/docs' } })

    assert.deepEqual(rendered, [
      'a',
      {
        'target': '_blank',
        'rel': 'noopener noreferrer nofollow',
        'class': null,
        'href': 'https://example.com/docs',
        'data-agent-favicon-url': 'https://example.com/favicon.ico',
      },
      0,
    ])
    assert.equal(linkMark.attrs.href, 'https://example.com/docs')
  })
})
