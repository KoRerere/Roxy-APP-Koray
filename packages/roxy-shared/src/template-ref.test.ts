import { describe, expect, it } from 'vitest'
import {
  isTemplateRef,
  normalizeTemplateRef,
  parseTemplateRef,
  serializeTemplateRef,
  TemplateRefParseError,
} from './template-ref'

describe('template ref codec', () => {
  it.each([
    ['official:1', 'official', 1],
    ['user:42', 'user', 42],
    ['official:9007199254740991', 'official', Number.MAX_SAFE_INTEGER],
  ])('parses %s', (value, namespace, id) => {
    expect(parseTemplateRef(value)).toEqual({ namespace, id, value })
  })

  it.each([
    '',
    '42',
    'official:0',
    'user:-1',
    'official:042',
    'Official:42',
    'official:42 ',
    ' user:42',
    'workspace:42',
    'official:9007199254740992',
  ])('rejects %s', (value) => {
    expect(() => parseTemplateRef(value)).toThrow(TemplateRefParseError)
    expect(isTemplateRef(value)).toBe(false)
  })

  it('round-trips a canonical reference', () => {
    const value = serializeTemplateRef('user', 42)

    expect(normalizeTemplateRef(value)).toEqual({
      namespace: 'user',
      id: 42,
      value: 'user:42',
    })
  })
})
