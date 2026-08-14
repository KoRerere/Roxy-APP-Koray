import { serializeAgentProfileReference } from '@roxy/shared'

export const CREATE_AUTOMATION_QUERY_KEY = 'prefill'
export const CREATE_AUTOMATION_QUERY_VALUE = 'create-automation'
export const CREATE_AUTOMATION_WINDOW_IDS_QUERY_KEY = 'windowIds'

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

export function buildCreateAutomationAgentRoute(windowIds: readonly string[]): string {
  const uniqueWindowIds = Array.from(new Set(windowIds.filter(Boolean)))
  const params = new URLSearchParams({
    [CREATE_AUTOMATION_QUERY_KEY]: CREATE_AUTOMATION_QUERY_VALUE,
    [CREATE_AUTOMATION_WINDOW_IDS_QUERY_KEY]: uniqueWindowIds.join(','),
  })
  return `/agent-console?${params}`
}

export function isCreateAutomationRequest(value: unknown): boolean {
  return firstQueryValue(value) === CREATE_AUTOMATION_QUERY_VALUE
}

export function parseCreateAutomationWindowIds(value: unknown): string[] {
  const normalized = firstQueryValue(value)
  if (typeof normalized !== 'string')
    return []

  return Array.from(new Set(normalized
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)))
}

export function buildCreateAutomationPrompt(
  windowIds: readonly string[],
  formatPrompt: (profileReference: string) => string,
): string {
  const profileReference = serializeAgentProfileReference(Array.from(new Set(windowIds.filter(Boolean))))
  return formatPrompt(profileReference)
}

export async function buildCreateAutomationPromptAfterWindowLoad(
  windowIds: readonly string[],
  loadWindows: (windowIds: readonly string[]) => Promise<void>,
  formatPrompt: (profileReference: string) => string,
): Promise<string> {
  const uniqueWindowIds = Array.from(new Set(windowIds.filter(Boolean)))
  await loadWindows(uniqueWindowIds)
  return buildCreateAutomationPrompt(uniqueWindowIds, formatPrompt)
}
