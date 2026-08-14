import { ref } from 'vue'

export const PROFILE_TOKEN_VISIBLE_LIMIT = 3

const profileLabelCache = new Map<string, string>()
export const agentProfileLabelVersion = ref(0)

export function normalizeAgentProfileLabel(value: string) {
  const label = value.trim().replace(/^@+/, '')
  return label ? `@${label}` : ''
}

export function cacheAgentProfileLabels(entries: readonly { id: string, label: string }[]) {
  let changed = false
  entries.forEach(({ id, label }) => {
    const normalized = normalizeAgentProfileLabel(label)
    if (id && normalized && profileLabelCache.get(id) !== normalized) {
      profileLabelCache.set(id, normalized)
      changed = true
    }
  })
  if (changed)
    agentProfileLabelVersion.value += 1
}

export function getCachedAgentProfileLabels(ids: readonly string[]) {
  return ids.map(id => profileLabelCache.get(id) || '')
}

export function getUncachedAgentProfileIds(ids: readonly string[]) {
  return ids.filter((id) => {
    const cachedLabel = profileLabelCache.get(id)
    return !cachedLabel || cachedLabel === normalizeAgentProfileLabel(id)
  })
}

export function getAgentProfileLabelsFromPayload(payload: Record<string, string>) {
  const rawLabels = payload.profileLabels
  if (!rawLabels)
    return []

  try {
    const labels = JSON.parse(rawLabels)
    return Array.isArray(labels)
      ? labels.filter((label): label is string => typeof label === 'string').map(normalizeAgentProfileLabel)
      : []
  }
  catch {
    return []
  }
}

export function formatAgentProfileDetails(
  labels: readonly string[],
  total = labels.length,
  fallbackLabels: readonly string[] = [],
) {
  const visibleLabels = Array.from(
    { length: Math.min(total, Math.max(labels.length, fallbackLabels.length)) },
    (_, index) => labels[index] || fallbackLabels[index] || '',
  )
    .map(normalizeAgentProfileLabel)
    .filter(Boolean)
    .slice(0, PROFILE_TOKEN_VISIBLE_LIMIT)
  const names = visibleLabels.join(' · ')

  if (!names || total <= PROFILE_TOKEN_VISIBLE_LIMIT)
    return names

  return `${names} ${$t('等 {count} 个', { count: total })}`
}

export function getAgentProfileIdsFromPrompt(prompt: string) {
  const ids: string[] = []
  const pattern = /\[@profile:[^\]]*\]\(([^)]*)\)/g

  for (const match of prompt.matchAll(pattern)) {
    match[1]
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .forEach(id => ids.push(id))
  }

  return Array.from(new Set(ids))
}

export async function ensureAgentProfileLabelsForPrompt(
  prompt: string,
  loadLabels: (ids: readonly string[]) => Promise<readonly { id: string, label: string }[]>,
) {
  const missingIds = getUncachedAgentProfileIds(getAgentProfileIdsFromPrompt(prompt))
  if (!missingIds.length)
    return

  cacheAgentProfileLabels(await loadLabels(missingIds))

  const unresolvedIds = getUncachedAgentProfileIds(missingIds)
  if (unresolvedIds.length)
    throw new Error(`Failed to resolve Agent profile labels: ${unresolvedIds.join(',')}`)
}
