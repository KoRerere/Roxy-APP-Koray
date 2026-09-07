import type { MyTemplateItem, MyTemplateKind, UserTemplateDTO } from '../../my-templates'
import type { TemplateNamespace, TemplateRef } from '@roxy/shared'
import {
  normalizeTemplateRef,
  serializeAgentProfileReference,
  serializeAgentScriptReference,
  serializeTemplateRef,
} from '@roxy/shared'
import type { OfficialTemplate } from '../../template-store'
import { pickLocalized, pickOfficialTemplatePrompt } from '../../template-store'
import { HOME_TEMPLATE_CACHE_LIMIT } from '../../home-template-cache'
import { templateItemToPrompt } from './protocol'
import type { AgentComposerItem } from './types'

type UserTemplateComposerSource = UserTemplateDTO | MyTemplateItem

export const TEMPLATE_DRAWER_OFFICIAL_LIMIT = HOME_TEMPLATE_CACHE_LIMIT

export function selectTemplateDrawerOfficialItems<T>(rows: readonly T[]): T[] {
  return rows.slice(0, TEMPLATE_DRAWER_OFFICIAL_LIMIT)
}

let agentSkillInstalledRoot = ''

export function setAgentSkillInstalledRoot(root: string | undefined) {
  agentSkillInstalledRoot = typeof root === 'string' ? root.trim() : ''
}

export function getAgentSkillInstalledRoot() {
  return agentSkillInstalledRoot
}

function toSafeSkillDirName(name: string): string {
  return name.trim().replace(/[^\w-]/g, '_').replace(/_+/g, '_')
}

function normalizeSkillStorageSlug(slug: string | undefined): string {
  const trimmed = slug?.trim()
  if (!trimmed) {
    return ''
  }

  const normalizedInput = trimmed.replace(/\\/g, '/')
  if (!normalizedInput || normalizedInput.startsWith('/') || /^[a-z]:/i.test(normalizedInput)) {
    return ''
  }

  const segments = normalizedInput.split('/')
  if (segments.includes('..')) {
    return ''
  }

  const normalized = segments.filter(segment => segment && segment !== '.').join('/')
  if (!normalized) {
    return ''
  }
  return toSafeSkillDirName(normalized)
}

export function buildAgentSkillMarkdownPath(slug: string | undefined): string {
  const normalizedSlug = normalizeSkillStorageSlug(slug)
  if (!agentSkillInstalledRoot || !normalizedSlug) {
    return ''
  }

  return `${agentSkillInstalledRoot.replace(/[\\/]+$/, '')}/${normalizedSlug}/SKILL.md`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeTemplateKind(value: unknown): MyTemplateKind {
  if (value === 'script' || value === 'scripts') {
    return 'script'
  }
  if (value === 'skill' || value === 'skills') {
    return 'skill'
  }

  return value === 'prompt' ? value : 'prompt'
}

function readString(value: unknown, locale?: string): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  return pickLocalized(value, locale).trim()
}

function readFirstString(source: Record<string, unknown>, keys: string[], locale?: string): string {
  for (const key of keys) {
    const value = readString(source[key], locale)
    if (value) {
      return value
    }
  }

  return ''
}

function normalizeTemplateSlugAsSkillSlug(slug: string): string {
  return slug.startsWith('official-') ? slug.slice('official-'.length) : slug
}

export function readSkillSlugFromMetadata(metadata: Record<string, unknown>): string {
  const direct = readFirstString(metadata, [
    'packageSlug',
    'package_slug',
    'skillSlug',
    'skill_slug',
  ])
  if (direct) {
    const normalized = normalizeSkillStorageSlug(normalizeTemplateSlugAsSkillSlug(direct))
    if (normalized) {
      return normalized
    }
  }

  if (isRecord(metadata.skillMetadata)) {
    const nestedDirect = readFirstString(metadata.skillMetadata, ['packageSlug', 'package_slug', 'skillSlug', 'skill_slug'])
    if (nestedDirect) {
      const normalized = normalizeSkillStorageSlug(normalizeTemplateSlugAsSkillSlug(nestedDirect))
      if (normalized) {
        return normalized
      }
    }

    const nestedTemplateSlug = readString(metadata.skillMetadata.slug)
    if (nestedTemplateSlug) {
      return normalizeSkillStorageSlug(normalizeTemplateSlugAsSkillSlug(nestedTemplateSlug))
    }
  }

  const templateSlug = readString(metadata.slug)
  if (!templateSlug) {
    return ''
  }

  return normalizeSkillStorageSlug(normalizeTemplateSlugAsSkillSlug(templateSlug))
}

function readRecommendedSkillSlug(template: Pick<RecommendedTemplateComposerSource, 'metadata' | 'slug'>): string {
  const metadataSlug = readSkillSlugFromMetadata(template.metadata ?? {})
  if (metadataSlug) {
    return metadataSlug
  }

  const templateSlug = template.slug?.trim() ?? ''
  return normalizeTemplateSlugAsSkillSlug(templateSlug)
}

function readTemplatePrompt(metadata: Record<string, unknown>, locale?: string): string {
  return readFirstString(metadata, [
    'prompt',
    'promptText',
    'prompt_text',
    'templatePrompt',
    'template_prompt',
    'content',
    'text',
  ], locale)
}

function readTemplateType(row: UserTemplateComposerSource): MyTemplateKind {
  return normalizeTemplateKind('kind' in row ? row.kind : row.templateType)
}

function createTemplateToken(options: {
  id: number
  kind: 'script' | 'skill'
  namespace: TemplateNamespace
  skillSlug?: string
  title: string
  description: string
}): AgentComposerItem {
  const templateRef = serializeTemplateRef(options.namespace, options.id)
  const skillPath = options.kind === 'skill'
    ? buildAgentSkillMarkdownPath(options.skillSlug)
    : ''

  if (options.kind === 'skill') {
    console.info('[skill-template-debug] create skill template token', {
      id: options.id,
      namespace: options.namespace,
      title: options.title,
      skillSlug: options.skillSlug,
      installedRoot: getAgentSkillInstalledRoot(),
      skillPath,
    })
  }

  return {
    id: skillPath || templateRef,
    kind: options.kind,
    title: options.title,
    label: options.title,
    description: options.description,
    iconName: options.kind === 'skill' ? 'roxy-agent/rx-ic-skills' : 'roxy-agent/rx-ic-scripts',
    group: options.kind === 'skill' ? 'Skills' : 'Scripts',
    payload: options.kind === 'skill'
      ? {
          ...(options.skillSlug ? { skillSlug: options.skillSlug } : {}),
          ...(skillPath ? { skillPath } : {}),
        }
      : { templateRef },
  }
}

export function mapUserTemplateComposerItem(row: UserTemplateComposerSource, locale?: string): AgentComposerItem {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const templateKind = readTemplateType(row)
  const title = pickLocalized(row.name, locale) || String(row.id)
  const prompt = readTemplatePrompt(metadata, locale)
  const description = pickLocalized(row.description, locale) || prompt
  const skillSlug = templateKind === 'skill' ? readSkillSlugFromMetadata(metadata) : ''
  if (templateKind === 'skill') {
    console.info('[skill-template-debug] map user skill template composer item', {
      id: row.id,
      title,
      officialTemplateId: row.officialTemplateId,
      metadataKeys: Object.keys(metadata),
      packageSlug: metadata.packageSlug,
      skillSlug: metadata.skillSlug,
      normalizedSkillSlug: skillSlug,
      skillMdPath: metadata.skillMdPath,
      nestedSkillSlug: isRecord(metadata.skillMetadata) ? metadata.skillMetadata.slug : undefined,
      installedRoot: getAgentSkillInstalledRoot(),
    })
  }
  const tokens = templateKind === 'script' || templateKind === 'skill'
    ? [createTemplateToken({
        id: row.id,
        kind: templateKind,
        namespace: 'user',
        skillSlug: templateKind === 'skill' ? skillSlug : undefined,
        title,
        description,
      })]
    : []
  const payload: Record<string, string> = {
    templateType: templateKind === 'skill' ? 'skills' : templateKind,
    userTemplateId: String(row.id),
    workspaceId: row.workspaceId,
  }

  if (typeof row.officialTemplateId === 'number') {
    payload.officialTemplateId = String(row.officialTemplateId)
  }

  return {
    id: `user-template-${row.id}`,
    kind: 'template',
    title,
    label: title,
    description,
    iconName: 'roxy-agent/rx-ic-templates',
    group: 'Templates',
    isTopped: Boolean(row.isTopped),
    toppedAt: row.toppedAt ?? null,
    templateId: row.id,
    templateSource: 'user',
    payload,
    template: {
      prompt,
      tokens,
    },
  }
}

interface RecommendedTemplateComposerSource {
  id: number
  kind: MyTemplateKind
  metadata?: Record<string, unknown>
  slug?: string
  title: string
  description: string
  iconName: string
  prompt: string
  isTopped?: boolean
  toppedAt?: string | null
}

export function mapRecommendedTemplateComposerItem(
  template: RecommendedTemplateComposerSource,
): AgentComposerItem {
  const tokens = template.kind === 'script' || template.kind === 'skill'
    ? [createTemplateToken({
        id: template.id,
        kind: template.kind,
        namespace: 'official',
        skillSlug: template.kind === 'skill'
          ? readRecommendedSkillSlug(template)
          : undefined,
        title: template.title,
        description: template.description,
      })]
    : []

  return {
    id: `recommended-template-${template.id}`,
    kind: 'template',
    title: template.title,
    label: template.title,
    description: template.description,
    iconName: template.iconName,
    group: 'Templates',
    isTopped: Boolean(template.isTopped),
    toppedAt: template.toppedAt ?? null,
    templateId: template.id,
    templateSource: 'official',
    payload: {
      officialTemplateId: String(template.id),
      templateType: template.kind === 'skill' ? 'skills' : template.kind,
    },
    template: {
      prompt: template.kind === 'script' ? '' : template.prompt,
      tokens,
    },
  }
}

export function mapOfficialTemplateComposerItem(
  template: OfficialTemplate,
  locale?: string,
): AgentComposerItem {
  return mapRecommendedTemplateComposerItem({
    id: template.id,
    kind: normalizeTemplateKind(template.templateType),
    metadata: template.metadata,
    slug: template.slug,
    title: pickLocalized(template.name, locale) || template.slug,
    description: pickLocalized(template.description, locale),
    iconName: 'roxy-agent/rx-ic-templates',
    prompt: pickOfficialTemplatePrompt(template, locale),
    isTopped: template.isTopped,
    toppedAt: template.toppedAt,
  })
}

function toppedTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

export function sortTemplateComposerItems(items: AgentComposerItem[]): AgentComposerItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const toppedDifference = Number(Boolean(right.item.isTopped)) - Number(Boolean(left.item.isTopped))
      if (toppedDifference) {
        return toppedDifference
      }

      if (left.item.isTopped && right.item.isTopped) {
        const timestampDifference = toppedTimestamp(right.item.toppedAt) - toppedTimestamp(left.item.toppedAt)
        if (timestampDifference) {
          return timestampDifference
        }
      }

      return left.index - right.index
    })
    .map(entry => entry.item)
}

export function mergeTemplateComposerItems(
  recommendedItems: AgentComposerItem[],
  userItems: AgentComposerItem[],
): AgentComposerItem[] {
  const recommendedItemIds = new Set(recommendedItems.map(item => item.id))
  const recommendedOfficialTemplateIds = new Set(
    recommendedItems
      .map(item => item.payload.officialTemplateId)
      .filter((id): id is string => Boolean(id)),
  )
  const userItemByOfficialTemplateId = new Map<string, AgentComposerItem>()

  userItems.forEach((item) => {
    const officialTemplateId = item.payload.officialTemplateId
    if (officialTemplateId && !userItemByOfficialTemplateId.has(officialTemplateId)) {
      userItemByOfficialTemplateId.set(officialTemplateId, item)
    }
  })

  const mergedItems = [
    ...recommendedItems.map((item) => {
      const officialTemplateId = item.payload.officialTemplateId
      return officialTemplateId
        ? userItemByOfficialTemplateId.get(officialTemplateId) ?? item
        : item
    }),
    ...userItems.filter((item) => {
      if (recommendedItemIds.has(item.id)) {
        return false
      }

      const officialTemplateId = item.payload.officialTemplateId
      return !officialTemplateId || !recommendedOfficialTemplateIds.has(officialTemplateId)
    }),
  ]

  return sortTemplateComposerItems(mergedItems)
}

export function userTemplateToPrompt(row: UserTemplateComposerSource, locale?: string): string {
  return templateItemToPrompt(mapUserTemplateComposerItem(row, locale))
}

export function userTemplateToChatPrompt(row: UserTemplateComposerSource, locale?: string): string {
  if (readTemplateType(row) === 'script') {
    return userScriptTemplateToRunPrompt(row, locale) || userTemplateToPrompt(row, locale)
  }

  return userTemplateToPrompt(row, locale)
}

export function recommendedTemplateToChatPrompt(
  template: RecommendedTemplateComposerSource,
  userTemplate?: UserTemplateComposerSource,
  locale?: string,
): string {
  if (userTemplate?.officialTemplateId === template.id) {
    return userTemplateToChatPrompt(userTemplate, locale)
  }

  if (template.kind === 'script') {
    return scriptTemplateToRunPrompt(
      template.title,
      serializeTemplateRef('official', template.id),
    )
  }

  return templateItemToPrompt(mapRecommendedTemplateComposerItem(template))
}

export function userTemplateToReference(row: UserTemplateComposerSource, locale?: string): string {
  return templateItemToPrompt(mapUserTemplateComposerItem(row, locale), { includeAuxiliaryPrompt: false })
}

export function scriptTemplateToRunPrompt(name: string, templateRef: TemplateRef | string): string {
  const normalizedName = name.trim()
  if (!normalizedName) {
    return ''
  }

  try {
    const ref = normalizeTemplateRef(templateRef)
    return $t('在 {profile} 窗口中运行 {script}', {
      profile: serializeAgentProfileReference([]),
      script: serializeAgentScriptReference(normalizedName, ref),
    })
  }
  catch {
    return ''
  }
}

export function userScriptTemplateToRunPrompt(row: UserTemplateComposerSource, locale?: string): string {
  const scriptReference = userTemplateToReference(row, locale)
  return scriptReference
    ? $t('在 {profile} 窗口中运行 {script}', {
        profile: serializeAgentProfileReference([]),
        script: scriptReference,
      })
    : ''
}
