import type { ParamsSchema } from '@/modes/sandbox-api'
import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  extractScriptParamsDefaults,
  findMissingRequiredScriptParams,
  mergeScriptParams,
} from './scriptParams'

it('extracts nested schema defaults without replacing explicit object defaults', () => {
  const schema: ParamsSchema = {
    type: 'object',
    properties: {
      keyword: { type: 'string', default: 'Roxy' },
      enabled: { type: 'boolean', default: true },
      profile: {
        type: 'object',
        default: { retries: 2 },
        properties: {
          retries: { type: 'integer', default: 3 },
          region: { type: 'string', default: 'cn' },
        },
      },
    },
  }

  assert.deepEqual(extractScriptParamsDefaults(schema), {
    keyword: 'Roxy',
    enabled: true,
    profile: { retries: 2, region: 'cn' },
  })
})

it('merges nested overrides while preserving zero, false, empty and null values', () => {
  assert.deepEqual(mergeScriptParams({
    count: 3,
    enabled: true,
    profile: { region: 'cn', retries: 2 },
  }, {
    count: 0,
    enabled: false,
    profile: { retries: 0 },
    note: '',
    tags: [],
    nullable: null,
  }), {
    count: 0,
    enabled: false,
    profile: { region: 'cn', retries: 0 },
    note: '',
    tags: [],
    nullable: null,
  })
})

it('reports missing required fields with nested paths and skips the internal debug field', () => {
  const schema: ParamsSchema = {
    type: 'object',
    properties: {
      keyword: { type: 'string' },
      profile: {
        type: 'object',
        properties: {
          username: { type: 'string' },
        },
        required: ['username'],
      },
      debug: { type: 'object' },
    },
    required: ['keyword', 'profile', 'debug'],
  }

  assert.deepEqual(findMissingRequiredScriptParams(schema, {
    keyword: '   ',
    profile: {},
  }), ['keyword', 'profile.username'])
})
