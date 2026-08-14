import type { OfficialTemplate } from './template-store'
import { pickOfficialTemplatePrompt } from './template-store'

export const AI_BATCH_CREATE_PROMPT_QUERY_KEY = 'prefill'
export const AI_BATCH_CREATE_TEMPLATE_SLUG = 'batch-create-profiles'
export const AI_BATCH_CREATE_PROMPT_QUERY_VALUE = AI_BATCH_CREATE_TEMPLATE_SLUG
export const AI_BATCH_CREATE_AGENT_ROUTE = `/agent-console?${AI_BATCH_CREATE_PROMPT_QUERY_KEY}=${AI_BATCH_CREATE_PROMPT_QUERY_VALUE}`

export function isAiBatchCreatePromptRequest(value: unknown): boolean {
  const normalized = Array.isArray(value) ? value[0] : value
  return normalized === AI_BATCH_CREATE_PROMPT_QUERY_VALUE
}

export function pickAiBatchCreatePrompt(templates: OfficialTemplate[], locale?: string): string {
  const template = templates.find(item => item.slug === AI_BATCH_CREATE_TEMPLATE_SLUG)
  return pickOfficialTemplatePrompt(template, locale).trim()
}
