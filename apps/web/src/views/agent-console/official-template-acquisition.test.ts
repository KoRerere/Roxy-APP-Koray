import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import type { OfficialTemplate } from './template-store'
import { prepareOfficialTemplateAcquisition } from './official-template-acquisition'

function officialTemplate(
  templateType: string,
  metadata: Record<string, unknown> = {},
): OfficialTemplate {
  return {
    id: 9,
    slug: 'official-demo',
    templateType,
    name: { en: 'Official name' },
    description: null,
    iconInfo: null,
    sortOrder: 0,
    isHot: false,
    metadata,
    labels: [],
    labelIds: [],
    createdAt: null,
    updatedAt: null,
  }
}

test('skips confirmation and snapshots defaults when script params are valid', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy' },
      },
      required: ['keyword'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: { keyword: 'Roxy' } },
  })
  assert.equal('name' in acquisition.request, false)
})

test('requires confirmation instead of synthesizing missing defaults from field types', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        count: { type: 'number' },
        enabled: { type: 'boolean' },
      },
      required: ['keyword', 'count', 'enabled'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, true)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: {} },
  })
})

test('requires confirmation when required defaults are empty', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: '   ' },
        tags: { type: 'array', default: [] },
      },
      required: ['keyword', 'tags'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, true)
})

test('skips confirmation when only optional parameters have no defaults', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy' },
        note: { type: 'string' },
      },
      required: ['keyword'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: { keyword: 'Roxy' } },
  })
})

test('treats an empty optional default as a parsed default value', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy' },
        note: { type: 'string', default: '' },
      },
      required: ['keyword'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: { keyword: 'Roxy', note: '' } },
  })
})

test('ignores missing required values inside the debug field', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy' },
        debug: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            token: { type: 'string' },
          },
          required: ['endpoint', 'token'],
        },
      },
      required: ['keyword', 'debug'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: { keyword: 'Roxy' } },
  })
})

test('keeps debug defaults in the automatic acquisition request', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy' },
        debug: {
          type: 'object',
          default: { endpoint: 'http://localhost:3000' },
          properties: {
            endpoint: { type: 'string' },
            token: { type: 'string' },
          },
          required: ['endpoint', 'token'],
        },
      },
      required: ['keyword', 'debug'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: {
      params: {
        keyword: 'Roxy',
        debug: { endpoint: 'http://localhost:3000' },
      },
    },
  })
})

test('still requires confirmation for missing required values outside the debug field', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        account: {
          type: 'object',
          default: {},
          properties: {
            username: { type: 'string' },
          },
          required: ['username'],
        },
        debug: {
          type: 'object',
          default: {},
          properties: {
            token: { type: 'string' },
          },
          required: ['token'],
        },
      },
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, true)
})

test('treats zero and false required defaults as filled values', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: false },
        count: { type: 'number', default: 0 },
      },
      required: ['enabled', 'count'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
})

test('does not require confirmation when filled defaults fail optional schema constraints', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy', minLength: 3 },
        note: { type: 'string', default: 'x', minLength: 10 },
      },
      required: ['keyword'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: { keyword: 'Roxy', note: 'x' } },
  })
})

test('does not require confirmation when a required default is filled but violates another schema rule', () => {
  const acquisition = prepareOfficialTemplateAcquisition(officialTemplate('script', {
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: { type: 'string', default: 'Roxy', minLength: 10 },
      },
      required: ['keyword'],
    }),
  }))

  assert.equal(acquisition.requiresConfirmation, false)
  assert.deepEqual(acquisition.request, {
    official_template_id: 9,
    metadata: { params: { keyword: 'Roxy' } },
  })
})

test('Skill skips confirmation while an empty Prompt requires it', () => {
  assert.equal(
    prepareOfficialTemplateAcquisition(officialTemplate('skill')).requiresConfirmation,
    false,
  )
  assert.equal(
    prepareOfficialTemplateAcquisition(officialTemplate('prompt', { prompt: { en: '' } }), 'en').requiresConfirmation,
    true,
  )
  assert.equal(
    prepareOfficialTemplateAcquisition(officialTemplate('prompt', { prompt: { en: 'Write a report' } }), 'en').requiresConfirmation,
    false,
  )
})
