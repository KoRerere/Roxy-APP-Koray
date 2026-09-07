export type TemplateKind = 'script' | 'skill' | 'prompt'

export interface TemplateFilterOption {
  label: string
  value: number | 'all'
}

export interface TemplateLabelCategory {
  id: number
  slug: string
  name: unknown
  sortOrder: number
  enabled: number
}

export interface TemplateLabel {
  id: number
  categoryId: number
  category: TemplateLabelCategory
  slug: string
  name: unknown
  color: string | null
  sortOrder: number
  enabled: number
}

export interface TemplateThemePair {
  light?: string
  dark?: string
}

export interface TemplateIconInfo {
  icon?: TemplateThemePair
  primaryColor?: TemplateThemePair
  bgColor?: TemplateThemePair
}

export interface OfficialTemplate {
  id: number
  slug: string
  templateType: string
  name: unknown
  description: unknown
  iconInfo: TemplateIconInfo | null
  sortOrder: number
  isHot: boolean
  isTopped?: boolean
  toppedAt?: string | null
  approxPoints?: number | null
  metadata: Record<string, unknown>
  labels: TemplateLabel[]
  labelIds: number[]
  createdAt: string | null
  updatedAt: string | null
}

export interface TemplateFilterCategory {
  id: number
  label: string
  options: TemplateFilterOption[]
}

export interface TemplateStoreTag {
  id: number
  label: string
}

export interface TemplateStoreItem {
  id: number
  slug: string
  title: string
  description: string
  kind: TemplateKind
  iconInfo: TemplateIconInfo | null
  labels: TemplateStoreTag[]
  isHot: boolean
  approxPoints?: number | null
  version?: string
  official: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeThemePair(value: unknown): TemplateThemePair | undefined {
  if (!isRecord(value))
    return undefined

  const light = typeof value.light === 'string' ? value.light.trim() : ''
  const dark = typeof value.dark === 'string' ? value.dark.trim() : ''
  if (!light && !dark)
    return undefined

  return {
    ...(light ? { light } : {}),
    ...(dark ? { dark } : {}),
  }
}

export function normalizeTemplateIconInfo(value: unknown): TemplateIconInfo | null {
  if (!isRecord(value))
    return null

  const icon = normalizeThemePair(value.icon)
  const primaryColor = normalizeThemePair(value.primaryColor)
  const bgColor = normalizeThemePair(value.bgColor)
  if (!icon && !primaryColor && !bgColor)
    return null

  return {
    ...(icon ? { icon } : {}),
    ...(primaryColor ? { primaryColor } : {}),
    ...(bgColor ? { bgColor } : {}),
  }
}

export function pickTemplateThemeValue(value: TemplateThemePair | undefined, darkTheme: boolean): string {
  if (!value)
    return ''
  return darkTheme
    ? (value.dark || value.light || '')
    : (value.light || value.dark || '')
}

export function isTemplateImageIconSource(value: string): boolean {
  return /^(?:https?:)?\/\//.test(value)
    || /^(?:data|blob|file):/.test(value)
    || value.startsWith('/')
    || value.startsWith('./')
    || value.startsWith('../')
    || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(value)
}

/**
 * 与官方脚本列表保持一致：按站点语言取 i18n 对象，并兼容后端历史 cn 与当前 zh 键。
 */
function normalizeLocalizedText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim() ? value : ''
  }
  if (!Array.isArray(value)) {
    return ''
  }

  return value
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .join('\n\n')
}

export function pickLocalized(value: unknown, locale?: string): string {
  const directValue = normalizeLocalizedText(value)
  if (directValue) {
    return directValue
  }
  if (!isRecord(value)) {  
    return ''
  }

  const primaryLanguage = locale?.split('-')[0]?.toLowerCase()
  const preferredKeys = primaryLanguage === 'zh'
    ? ['zh', 'cn']
    : [primaryLanguage, primaryLanguage === 'en' ? 'us' : undefined, 'en', 'zh', 'cn', 'ru']

  for (const key of preferredKeys) {
    const candidate = key ? value[key] : undefined
    const normalizedCandidate = normalizeLocalizedText(candidate)
    if (normalizedCandidate) {
      return normalizedCandidate
    }
  }

  for (const candidate of Object.values(value)) {
    const normalizedCandidate = normalizeLocalizedText(candidate)
    if (normalizedCandidate) {
      return normalizedCandidate
    }  
  }

  return ''
}

export function pickOfficialTemplatePrompt(template: OfficialTemplate | undefined, locale?: string): string {
  if (!template)
    return ''

  const value = template.templateType === 'skill'
    ? template.metadata.usageExample
    : template.metadata.prompt
  return pickLocalized(value, locale)
}

export function readCatalogList<T>(response: unknown, fallbackMessage: string): T[] {
  if (!isRecord(response))
    throw new Error(fallbackMessage)

  if (response.code !== 0)
    throw new Error(typeof response.message === 'string' ? response.message : fallbackMessage)

  if (!Array.isArray(response.data))
    throw new Error(fallbackMessage)

  return response.data as T[]
}

export interface OfficialTemplatePage {
  items: OfficialTemplate[]
  total: number
  limit: number
  offset: number
}

export function readOfficialTemplatePage(response: unknown, fallbackMessage: string): OfficialTemplatePage {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  const { items, total, limit, offset } = response.data
  if (!Array.isArray(items) || typeof total !== 'number' || typeof limit !== 'number' || typeof offset !== 'number')
    throw new Error(fallbackMessage)

  return response.data as unknown as OfficialTemplatePage
}

export function serializeTemplateQuery(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value == null)
      return

    if (Array.isArray(value)) {
      value.forEach(item => searchParams.append(key, String(item)))
      return
    }

    searchParams.append(key, String(value))
  })

  return searchParams.toString()
}

function normalizeTemplateKind(value: string): TemplateKind {
  if (value === 'script' || value === 'scripts')
    return 'script'
  if (value === 'skill' || value === 'skills')
    return 'skill'
  if (value === 'prompt')
    return 'prompt'
  return 'prompt'
}

export function mapTemplateStoreItem(row: OfficialTemplate, locale?: string): TemplateStoreItem {
  return {
    id: row.id,
    slug: row.slug,
    title: pickLocalized(row.name, locale) || row.slug,
    description: pickLocalized(row.description, locale),
    kind: normalizeTemplateKind(row.templateType),
    iconInfo: normalizeTemplateIconInfo(row.iconInfo),
    labels: row.labels.map(label => ({
      id: label.id,
      label: pickLocalized(label.name, locale) || label.slug,
    })),
    isHot: row.isHot,
    approxPoints: typeof row.approxPoints === 'number' && Number.isFinite(row.approxPoints)
      ? row.approxPoints
      : undefined,
    version: typeof row.metadata.version === 'string' ? row.metadata.version : undefined,
    official: true,
  }
}
