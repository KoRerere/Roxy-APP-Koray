const NEW_TEMPLATE_GUIDE_SHOWN_STORAGE_PREFIX = 'agent-console:new-template-guide-shown:'
const NEW_TEMPLATE_GUIDE_PENDING_STORAGE_PREFIX = 'agent-console:new-template-guide-pending:'

export const NEW_TEMPLATE_GUIDE_EVENT = 'agent-console:new-template-created'

export interface AgentConsoleAccountInfo {
  id?: unknown
  email?: unknown
  phone?: unknown
}

export function getAgentConsoleAccountId(userInfo: AgentConsoleAccountInfo | null | undefined) {
  const accountId = userInfo?.id ?? userInfo?.email ?? userInfo?.phone
  if (accountId === undefined || accountId === null || accountId === '')
    return ''

  return String(accountId)
}

export function getNewTemplateGuideStorageKey(accountId: unknown) {
  if (accountId === undefined || accountId === null || accountId === '')
    return ''

  return `${NEW_TEMPLATE_GUIDE_SHOWN_STORAGE_PREFIX}${encodeURIComponent(String(accountId))}`
}

function getNewTemplateGuidePendingStorageKey(accountId: unknown) {
  if (accountId === undefined || accountId === null || accountId === '')
    return ''

  return `${NEW_TEMPLATE_GUIDE_PENDING_STORAGE_PREFIX}${encodeURIComponent(String(accountId))}`
}

function readStorageItem(key: string) {
  if (!key || typeof window === 'undefined')
    return null

  try {
    return window.localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function writeStorageItem(key: string, value: string) {
  if (!key || typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(key, value)
  }
  catch {
    // The guide can still be used when local storage is unavailable.
  }
}

export function hasShownNewTemplateGuide(accountId: unknown) {
  const storageKey = getNewTemplateGuideStorageKey(accountId)
  return Boolean(storageKey && readStorageItem(storageKey) === '1')
}

export function markNewTemplateGuideShown(accountId: unknown) {
  writeStorageItem(getNewTemplateGuideStorageKey(accountId), '1')
}

export function hasNewTemplateGuidePending(accountId: unknown) {
  const storageKey = getNewTemplateGuidePendingStorageKey(accountId)
  return Boolean(storageKey && readStorageItem(storageKey) === '1')
}

export function markNewTemplateGuidePending(accountId: unknown) {
  writeStorageItem(getNewTemplateGuidePendingStorageKey(accountId), '1')
}

export function clearNewTemplateGuidePending(accountId: unknown) {
  const storageKey = getNewTemplateGuidePendingStorageKey(accountId)
  if (!storageKey || typeof window === 'undefined')
    return

  try {
    window.localStorage.removeItem(storageKey)
  }
  catch {
    // Ignore storage errors; the pending flag is best effort.
  }
}

export function announceNewTemplateCreated() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(NEW_TEMPLATE_GUIDE_EVENT))
}
