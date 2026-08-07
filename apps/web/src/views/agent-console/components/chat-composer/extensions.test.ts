import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ComposerLink } from './extensions'

describe('composer link boundaries', () => {
  it('does not extend a pasted link when typing at its trailing edge', () => {
    const schema = getSchema([
      StarterKit.configure({ link: false }),
      ComposerLink,
    ])

    assert.equal(schema.marks.link.spec.inclusive, false)
    assert.equal(schema.marks.link.spec.attrs?.markdownSource?.default, null)
    assert.equal(ComposerLink.options.autolink, true)
  })
})
