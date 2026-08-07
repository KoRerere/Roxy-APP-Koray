import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- agent-console tests use Node's built-in runner
import test from 'node:test'
import {
  HOME_TEMPLATE_CACHE_LIMIT,
  HOME_TEMPLATE_CACHE_STORAGE_KEY,
  readHomeTemplateCache,
  writeHomeTemplateCache,
} from './home-template-cache'
import type { OfficialTemplate, TemplateLabelCategory } from './template-store'

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))
  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

function createTemplate(id = 1): OfficialTemplate {
  const category: TemplateLabelCategory = {
    id: 1,
    slug: 'platform',
    name: { en: 'Platform', zh: '平台' },
    sortOrder: 1,
    enabled: 1,
  }

  return {
    id,
    slug: `template-${id}`,
    templateType: 'prompt',
    name: { en: `Template ${id}`, zh: `模板 ${id}` },
    description: { en: 'Description', zh: '描述' },
    iconInfo: null,
    sortOrder: id,
    isHot: false,
    metadata: { prompt: { en: 'Run it', zh: '运行它' } },
    labels: [{
      id: 10,
      categoryId: category.id,
      category,
      slug: 'amazon',
      name: { en: 'Amazon', zh: '亚马逊' },
      color: null,
      sortOrder: 1,
      enabled: 1,
    }],
    labelIds: [10],
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
  }
}

test('writes and reads raw official templates for immediate rendering', () => {
  const storage = createStorage()
  const templates = [createTemplate()]

  writeHomeTemplateCache(templates, storage, 123)

  assert.deepEqual(readHomeTemplateCache(storage), {
    templates,
    updatedAt: 123,
  })
})

test('stores at most the eight home page templates', () => {
  const storage = createStorage()
  const templates = Array.from({ length: HOME_TEMPLATE_CACHE_LIMIT + 2 }, (_, index) => createTemplate(index + 1))

  writeHomeTemplateCache(templates, storage, 123)

  assert.deepEqual(
    readHomeTemplateCache(storage)?.templates.map(template => template.id),
    Array.from({ length: HOME_TEMPLATE_CACHE_LIMIT }, (_, index) => index + 1),
  )
})

test('ignores malformed, incompatible, or structurally invalid caches', () => {
  const malformedStorage = createStorage({
    [HOME_TEMPLATE_CACHE_STORAGE_KEY]: '{not-json',
  })
  const incompatibleStorage = createStorage({
    [HOME_TEMPLATE_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 2,
      updatedAt: 123,
      templates: [],
    }),
  })
  const invalidStorage = createStorage({
    [HOME_TEMPLATE_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      updatedAt: 123,
      templates: [{ id: 1, labels: 'invalid' }],
    }),
  })

  assert.equal(readHomeTemplateCache(malformedStorage), undefined)
  assert.equal(readHomeTemplateCache(incompatibleStorage), undefined)
  assert.equal(readHomeTemplateCache(invalidStorage), undefined)
})

test('treats storage failures as a cache miss without throwing', () => {
  const storage = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
  }

  assert.doesNotThrow(() => writeHomeTemplateCache([createTemplate()], storage))
  assert.equal(readHomeTemplateCache(storage), undefined)
})
