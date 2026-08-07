import type { TemplateLabel, TemplateLabelCategory } from './template-store'

export const TEMPLATE_LABEL_CATALOG_STORAGE_KEY = 'agent-console:template-label-catalog:v1'

const CACHE_VERSION = 1

type TemplateLabelCatalogStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface TemplateLabelCatalogCache {
  categories: TemplateLabelCategory[]
  labels: TemplateLabel[]
  updatedAt: number
}

interface StoredTemplateLabelCatalog extends TemplateLabelCatalogCache {
  version: typeof CACHE_VERSION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTemplateLabelCategory(value: unknown): value is TemplateLabelCategory {
  return isRecord(value)
    && isFiniteNumber(value.id)
    && typeof value.slug === 'string'
    && 'name' in value
    && isFiniteNumber(value.sortOrder)
    && isFiniteNumber(value.enabled)
}

function isTemplateLabel(value: unknown): value is TemplateLabel {
  return isRecord(value)
    && isFiniteNumber(value.id)
    && isFiniteNumber(value.categoryId)
    && isTemplateLabelCategory(value.category)
    && typeof value.slug === 'string'
    && 'name' in value
    && (typeof value.color === 'string' || value.color === null)
    && isFiniteNumber(value.sortOrder)
    && isFiniteNumber(value.enabled)
}

function isStoredTemplateLabelCatalog(value: unknown): value is StoredTemplateLabelCatalog {
  return isRecord(value)
    && value.version === CACHE_VERSION
    && isFiniteNumber(value.updatedAt)
    && value.updatedAt >= 0
    && Array.isArray(value.categories)
    && value.categories.every(isTemplateLabelCategory)
    && Array.isArray(value.labels)
    && value.labels.every(isTemplateLabel)
}

function resolveStorage(storage?: TemplateLabelCatalogStorage | null) {
  if (storage !== undefined)
    return storage ?? undefined
  if (typeof window === 'undefined')
    return undefined

  try {
    return window.localStorage
  }
  catch {
    return undefined
  }
}

export function readTemplateLabelCatalogCache(
  storage?: TemplateLabelCatalogStorage | null,
): TemplateLabelCatalogCache | undefined {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage)
    return undefined

  try {
    const raw = targetStorage.getItem(TEMPLATE_LABEL_CATALOG_STORAGE_KEY)
    if (!raw)
      return undefined

    const parsed: unknown = JSON.parse(raw)
    if (!isStoredTemplateLabelCatalog(parsed))
      return undefined

    return {
      categories: parsed.categories,
      labels: parsed.labels,
      updatedAt: parsed.updatedAt,
    }
  }
  catch {
    return undefined
  }
}

export function writeTemplateLabelCatalogCache(
  categories: TemplateLabelCategory[],
  labels: TemplateLabel[],
  storage?: TemplateLabelCatalogStorage | null,
  updatedAt = Date.now(),
) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage)
    return

  const payload: StoredTemplateLabelCatalog = {
    version: CACHE_VERSION,
    categories,
    labels,
    updatedAt,
  }

  try {
    targetStorage.setItem(TEMPLATE_LABEL_CATALOG_STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
    // Caching is best-effort and must not block the template store.
  }
}
