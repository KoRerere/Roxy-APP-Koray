import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  getComposerSelectionBehavior,
  getNextSuggestionIndex,
  getPromptTokenTargets,
  shouldAppendComposerItemSpace,
} from './selection'

const skillRoot = '/tmp/roxy-agent/library/skills/installed'

describe('getComposerSelectionBehavior', () => {
  it('keeps the picker open for multi-select window mentions', () => {
    assert.deepEqual(getComposerSelectionBehavior('mention'), {
      closeAfterChoose: false,
      multiSelect: true,
    })
  })

  it('closes the picker for slash skills and scripts', () => {
    assert.deepEqual(getComposerSelectionBehavior('slash'), {
      closeAfterChoose: true,
      multiSelect: false,
    })
  })

  it('reads comma-separated profile dirIds from aggregate profile tokens', () => {
    assert.deepEqual(
      Array.from(getPromptTokenTargets('[@profile:2](profile-mou-72,profile-mou-89)', 'profile')),
      ['profile-mou-72', 'profile-mou-89'],
    )
  })

  it('tracks only canonical Script and Skill template references', () => {
    const prompt = [
      '[@script:Official script](official:8)',
      `[$User skill](${skillRoot}/user-skill/SKILL.md)`,
      '[@script:Legacy script](8)',
      '[$Legacy skill](/skills/legacy/SKILL.md)',
    ].join(' ')

    assert.deepEqual(Array.from(getPromptTokenTargets(prompt, 'script')), ['official:8'])
    assert.deepEqual(Array.from(getPromptTokenTargets(prompt, 'skill')), [`${skillRoot}/user-skill/SKILL.md`])
  })
})

describe('getNextSuggestionIndex', () => {
  it('moves in both directions and wraps at list boundaries', () => {
    assert.equal(getNextSuggestionIndex(0, 3, 'next'), 1)
    assert.equal(getNextSuggestionIndex(2, 3, 'next'), 0)
    assert.equal(getNextSuggestionIndex(2, 3, 'previous'), 1)
    assert.equal(getNextSuggestionIndex(0, 3, 'previous'), 2)
  })

  it('keeps an empty list at index zero', () => {
    assert.equal(getNextSuggestionIndex(3, 0, 'next'), 0)
  })
})

describe('shouldAppendComposerItemSpace', () => {
  it('appends a space for new items and typed suggestion ranges', () => {
    assert.equal(shouldAppendComposerItemSpace(undefined), true)
    assert.equal(shouldAppendComposerItemSpace(
      { type: { name: 'text' }, nodeSize: 8 },
      { from: 4, to: 6 },
    ), true)
  })

  it('preserves surrounding whitespace when replacing a complete token', () => {
    const range = { from: 4, to: 5 }

    assert.equal(shouldAppendComposerItemSpace(
      { type: { name: 'agentToken' }, nodeSize: 1 },
      range,
    ), false)
    assert.equal(shouldAppendComposerItemSpace(
      { type: { name: 'mention' }, nodeSize: 1 },
      range,
    ), false)
  })

  it('still appends a space when a range does not replace the complete token', () => {
    assert.equal(shouldAppendComposerItemSpace(
      { type: { name: 'agentToken' }, nodeSize: 1 },
      { from: 4, to: 6 },
    ), true)
  })
})
