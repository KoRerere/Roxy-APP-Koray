import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { reactive, ref } from 'vue'
import {
  buildScriptParams,
  createScriptParamsData,
  createScriptParamsFormSchema,
  createScriptParamsFormUISchema,
  localizedSchemaText,
  localizeScriptParamsSchema,
  parseScriptParamsSchema,
  validateScriptParamsData,
} from './script-template-params'

const schema = parseScriptParamsSchema(JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    keyword: {
      type: 'string',
      description: { zh: '搜索关键词', us: 'Search keyword', ru: 'Поисковый запрос' },
    },
    mode: { type: 'string', enum: ['fast', 'safe'], default: 'safe' },
    profile: {
      type: 'object',
      title: { zh: '浏览器配置', en: 'Browser profile' },
      properties: { retries: { type: 'integer', default: 3 } },
      default: {},
    },
  },
  required: ['keyword'],
  additionalProperties: false,
}))!

test('parses object schemas and rejects invalid JSON or explicit non-object roots', () => {
  assert.equal(schema.type, 'object')
  assert.throws(() => parseScriptParamsSchema('{'), /合法的 JSON/)
  assert.throws(() => parseScriptParamsSchema({ type: 'array' }), /type 必须/)
})

test('localizes presentation text without changing schema keywords or values', () => {
  const localized = localizeScriptParamsSchema(schema, 'zh-CN')
  assert.equal(localized.properties?.keyword?.description, '搜索关键词')
  assert.equal(localized.properties?.profile?.title, '浏览器配置')
  assert.deepEqual(localized.properties?.mode?.enum, ['fast', 'safe'])
  assert.equal(localizedSchemaText({ us: ['Line 1', 'Line 2'] }, 'en'), 'Line 1\nLine 2')
})

test('preserves schemas and default data when property names match annotation keywords', () => {
  const localized = localizeScriptParamsSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: { zh: '标题字段', en: 'Title field' },
        default: 'title',
      },
      config: {
        type: 'object',
        default: { description: { zh: '这是数据，不是 Schema 注解' } },
        properties: {
          description: {
            type: 'string',
            description: { zh: '描述字段', en: 'Description field' },
          },
        },
      },
    },
  }, 'zh-CN')

  assert.equal(localized.properties?.title?.type, 'string')
  assert.equal(localized.properties?.title?.title, '标题字段')
  assert.equal(localized.properties?.config?.properties?.description?.description, '描述字段')
  assert.deepEqual(localized.properties?.config?.default, {
    description: { zh: '这是数据，不是 Schema 注解' },
  })
})

test('initializes defaults once and lets persisted non-empty values win', () => {
  assert.deepEqual(createScriptParamsData(schema), {
    mode: 'safe',
    profile: { retries: 3 },
  })
  assert.deepEqual(createScriptParamsData(schema, { keyword: 'Roxy' }), {
    keyword: 'Roxy',
    mode: 'safe',
    profile: { retries: 3 },
  })

  const source = reactive({
    keyword: 'Roxy',
    profile: { retries: 3 },
  })
  const paramsRef = ref({ ...source })
  const first = createScriptParamsData(schema, paramsRef.value)
  const second = createScriptParamsData(schema, paramsRef.value)

  assert.deepEqual(first, {
    keyword: 'Roxy',
    mode: 'safe',
    profile: { retries: 3 },
  })
  assert.deepEqual(second, first)
  assert.notEqual(first, second)
  assert.notEqual(first.profile, source.profile)
})

test('fills empty persisted fields from defaults without replacing zero or false', () => {
  const editSchema = parseScriptParamsSchema({
    type: 'object',
    properties: {
      keyword: { type: 'string', default: 'Roxy' },
      probability: { type: 'number', default: 0.2 },
      enabled: { type: 'boolean', default: true },
      tags: { type: 'array', default: ['news'] },
      profile: {
        type: 'object',
        default: {},
        properties: {
          retries: { type: 'integer', default: 3 },
        },
      },
    },
  })!

  assert.deepEqual(createScriptParamsData(editSchema, {
    keyword: '   ',
    probability: 0,
    enabled: false,
    tags: [],
    profile: { retries: null },
  }), {
    keyword: 'Roxy',
    probability: 0,
    enabled: false,
    tags: ['news'],
    profile: { retries: 3 },
  })
})

test('returns valid form data and surfaces JSON Forms validation errors', () => {
  assert.deepEqual(buildScriptParams({ keyword: 'Roxy' }), { keyword: 'Roxy' })
  assert.deepEqual(buildScriptParams(reactive({
    keyword: 'Roxy',
    profile: { retries: 3 },
  })), {
    keyword: 'Roxy',
    profile: { retries: 3 },
  })
  assert.throws(() => buildScriptParams({}, [{
    instancePath: '',
    schemaPath: '#/required',
    keyword: 'required',
    params: { missingProperty: 'keyword' },
    message: 'must have required property keyword',
  }]), /keyword/)
})

test('hides debug fields and excludes them from form validation without changing source schema', () => {
  const sourceSchema = parseScriptParamsSchema({
    type: 'object',
    properties: {
      keyword: { type: 'string' },
      account: {
        type: 'object',
        properties: {
          username: { type: 'string' },
        },
        required: ['username'],
      },
      debug: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
        },
        required: ['endpoint'],
      },
    },
    required: ['keyword', 'debug'],
    additionalProperties: false,
  })!

  const formSchema = createScriptParamsFormSchema(sourceSchema)
  const formUISchema = createScriptParamsFormUISchema(sourceSchema)
  const serializedUISchema = JSON.stringify(formUISchema)

  assert.deepEqual(formSchema.required, ['keyword'])
  assert.deepEqual(formSchema.properties?.debug, {})
  assert.deepEqual(formSchema.properties?.account?.required, ['username'])
  assert.equal(serializedUISchema.includes('#/properties/debug'), false)
  assert.equal(serializedUISchema.includes('#/properties/keyword'), true)
  assert.deepEqual(validateScriptParamsData(formSchema, {
    keyword: 'Roxy',
    account: { username: 'roxy' },
    debug: {},
  }), [])

  assert.deepEqual(sourceSchema.required, ['keyword', 'debug'])
  assert.deepEqual(sourceSchema.properties?.debug?.required, ['endpoint'])
})
