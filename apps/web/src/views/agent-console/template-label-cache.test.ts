import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- agent-console tests use Node's built-in runner
import test from 'node:test'
import {
  readTemplateLabelCatalogCache,
  TEMPLATE_LABEL_CATALOG_STORAGE_KEY,
  writeTemplateLabelCatalogCache,
} from './template-label-cache'
import { pickLocalized } from './template-store'
import type { TemplateLabel, TemplateLabelCategory } from './template-store'

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

function createCatalog() {
  const category: TemplateLabelCategory = {
    id: 1,
    slug: 'platform',
    name: { en: 'Platform', zh: '平台' },
    sortOrder: 1,
    enabled: 1,
  }
  const label: TemplateLabel = {
    id: 10,
    categoryId: category.id,
    category,
    slug: 'amazon',
    name: { en: 'Amazon', zh: '亚马逊' },
    color: null,
    sortOrder: 1,
    enabled: 1,
  }

  return { categories: [category], labels: [label] }
}

test('writes and reads the raw multilingual label catalog', () => {
  const storage = createStorage()
  const catalog = createCatalog()

  writeTemplateLabelCatalogCache(catalog.categories, catalog.labels, storage, 123)

  assert.deepEqual(readTemplateLabelCatalogCache(storage), {
    ...catalog,
    updatedAt: 123,
  })
})

test('ignores malformed, incompatible, or structurally invalid caches', () => {
  const malformedStorage = createStorage({
    [TEMPLATE_LABEL_CATALOG_STORAGE_KEY]: '{not-json',
  })
  const incompatibleStorage = createStorage({
    [TEMPLATE_LABEL_CATALOG_STORAGE_KEY]: JSON.stringify({
      version: 2,
      updatedAt: 123,
      categories: [],
      labels: [],
    }),
  })
  const invalidStorage = createStorage({
    [TEMPLATE_LABEL_CATALOG_STORAGE_KEY]: JSON.stringify({
      version: 1,
      updatedAt: 123,
      categories: [{ id: 'invalid' }],
      labels: [],
    }),
  })

  assert.equal(readTemplateLabelCatalogCache(malformedStorage), undefined)
  assert.equal(readTemplateLabelCatalogCache(incompatibleStorage), undefined)
  assert.equal(readTemplateLabelCatalogCache(invalidStorage), undefined)
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
  const catalog = createCatalog()

  assert.doesNotThrow(() => writeTemplateLabelCatalogCache(catalog.categories, catalog.labels, storage))
  assert.equal(readTemplateLabelCatalogCache(storage), undefined)
})

test('keeps raw names available for localization after hydration', () => {
  const storage = createStorage()
  const catalog = createCatalog()
  writeTemplateLabelCatalogCache(catalog.categories, catalog.labels, storage, 123)

  const cached = readTemplateLabelCatalogCache(storage)

  assert.equal(pickLocalized(cached?.categories[0]?.name, 'zh-CN'), '平台')
  assert.equal(pickLocalized(cached?.labels[0]?.name, 'en-US'), 'Amazon')
})
