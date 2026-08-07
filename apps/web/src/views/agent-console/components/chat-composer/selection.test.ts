import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  getComposerSelectionBehavior,
  getNextSuggestionIndex,
  getPromptTokenTargets,
} from './selection'

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
      '[$User skill](user:42)',
      '[@script:Legacy script](8)',
      '[$Legacy skill](/skills/legacy/SKILL.md)',
    ].join(' ')

    assert.deepEqual(Array.from(getPromptTokenTargets(prompt, 'script')), ['official:8'])
    assert.deepEqual(Array.from(getPromptTokenTargets(prompt, 'skill')), ['user:42'])
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
