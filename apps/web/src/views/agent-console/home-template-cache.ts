import type { OfficialTemplate, TemplateLabel, TemplateLabelCategory } from './template-store'

export const HOME_TEMPLATE_CACHE_STORAGE_KEY = 'agent-console:home-official-templates:v1'
export const HOME_TEMPLATE_CACHE_LIMIT = 8

const CACHE_VERSION = 1

type HomeTemplateCacheStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface HomeTemplateCache {
  templates: OfficialTemplate[]
  updatedAt: number
}

interface StoredHomeTemplateCache extends HomeTemplateCache {
  version: typeof CACHE_VERSION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
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

function isOfficialTemplate(value: unknown): value is OfficialTemplate {
  return isRecord(value)
    && isFiniteNumber(value.id)
    && typeof value.slug === 'string'
    && typeof value.templateType === 'string'
    && 'name' in value
    && 'description' in value
    && (value.iconInfo === null || isRecord(value.iconInfo))
    && isFiniteNumber(value.sortOrder)
    && typeof value.isHot === 'boolean'
    && isRecord(value.metadata)
    && Array.isArray(value.labels)
    && value.labels.every(isTemplateLabel)
    && Array.isArray(value.labelIds)
    && value.labelIds.every(isFiniteNumber)
    && isNullableString(value.createdAt)
    && isNullableString(value.updatedAt)
}

function isStoredHomeTemplateCache(value: unknown): value is StoredHomeTemplateCache {
  return isRecord(value)
    && value.version === CACHE_VERSION
    && isFiniteNumber(value.updatedAt)
    && value.updatedAt >= 0
    && Array.isArray(value.templates)
    && value.templates.every(isOfficialTemplate)
}

function resolveStorage(storage?: HomeTemplateCacheStorage | null) {
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

export function readHomeTemplateCache(
  storage?: HomeTemplateCacheStorage | null,
): HomeTemplateCache | undefined {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage)
    return undefined

  try {
    const raw = targetStorage.getItem(HOME_TEMPLATE_CACHE_STORAGE_KEY)
    if (!raw)
      return undefined

    const parsed: unknown = JSON.parse(raw)
    if (!isStoredHomeTemplateCache(parsed))
      return undefined

    return {
      templates: parsed.templates,
      updatedAt: parsed.updatedAt,
    }
  }
  catch {
    return undefined
  }
}

export function writeHomeTemplateCache(
  templates: OfficialTemplate[],
  storage?: HomeTemplateCacheStorage | null,
  updatedAt = Date.now(),
) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage)
    return

  const payload: StoredHomeTemplateCache = {
    version: CACHE_VERSION,
    templates: templates.slice(0, HOME_TEMPLATE_CACHE_LIMIT),
    updatedAt,
  }

  try {
    targetStorage.setItem(HOME_TEMPLATE_CACHE_STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
    // Caching is best-effort and must not block the home page.
  }
}
