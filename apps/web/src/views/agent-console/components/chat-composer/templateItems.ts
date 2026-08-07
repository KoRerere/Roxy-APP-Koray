import type { MyTemplateItem, MyTemplateKind, UserTemplateDTO } from '../../my-templates'
import type { TemplateNamespace, TemplateRef } from '@roxy/shared'
import {
  normalizeTemplateRef,
  serializeAgentProfileReference,
  serializeAgentScriptReference,
  serializeTemplateRef,
} from '@roxy/shared'
import { pickLocalized } from '../../template-store'
import { templateItemToPrompt } from './protocol'
import type { AgentComposerItem } from './types'

type UserTemplateComposerSource = UserTemplateDTO | MyTemplateItem

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
  title: string
  description: string
}): AgentComposerItem {
  const templateRef = serializeTemplateRef(options.namespace, options.id)

  return {
    id: templateRef,
    kind: options.kind,
    title: options.title,
    label: options.title,
    description: options.description,
    iconName: options.kind === 'skill' ? 'roxy-agent/rx-ic-skills' : 'roxy-agent/rx-ic-scripts',
    group: options.kind === 'skill' ? 'Skills' : 'Scripts',
    payload: { templateRef },
  }
}

export function mapUserTemplateComposerItem(row: UserTemplateComposerSource, locale?: string): AgentComposerItem {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const templateKind = readTemplateType(row)
  const title = pickLocalized(row.name, locale) || String(row.id)
  const prompt = readTemplatePrompt(metadata, locale)
  const description = pickLocalized(row.description, locale) || prompt
  const tokens = templateKind === 'script' || templateKind === 'skill'
    ? [createTemplateToken({
        id: row.id,
        kind: templateKind,
        namespace: 'user',
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
  title: string
  description: string
  iconName: string
  prompt: string
}

export function mapRecommendedTemplateComposerItem(
  template: RecommendedTemplateComposerSource,
): AgentComposerItem {
  const tokens = template.kind === 'script' || template.kind === 'skill'
    ? [createTemplateToken({
        id: template.id,
        kind: template.kind,
        namespace: 'official',
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

  return [
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
