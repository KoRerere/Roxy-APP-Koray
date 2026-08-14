const CREATE_AUTOMATION_GUIDE_SHOWN_STORAGE_PREFIX = 'agent-console:create-automation-guide-shown:'

export const CREATE_AUTOMATION_GUIDE_EVENT = 'agent-console:create-automation-guide-requested'

interface GuideStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

let guidePending = false

function getLocalStorage(): GuideStorage | undefined {
  if (typeof window === 'undefined')
    return undefined

  try {
    return window.localStorage
  }
  catch {
    return undefined
  }
}

export function getCreateAutomationGuideStorageKey(accountId: unknown) {
  if (accountId === undefined || accountId === null || accountId === '')
    return ''

  return `${CREATE_AUTOMATION_GUIDE_SHOWN_STORAGE_PREFIX}${encodeURIComponent(String(accountId))}`
}

export function hasShownCreateAutomationGuide(accountId: unknown, storage = getLocalStorage()) {
  const storageKey = getCreateAutomationGuideStorageKey(accountId)
  if (!storageKey || !storage)
    return false

  try {
    return storage.getItem(storageKey) === '1'
  }
  catch {
    return false
  }
}

export function markCreateAutomationGuideShown(accountId: unknown, storage = getLocalStorage()) {
  const storageKey = getCreateAutomationGuideStorageKey(accountId)
  if (!storageKey || !storage)
    return

  try {
    storage.setItem(storageKey, '1')
  }
  catch {
    // The guide can still be used when local storage is unavailable.
  }
}

export function requestCreateAutomationGuide() {
  guidePending = true
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(CREATE_AUTOMATION_GUIDE_EVENT))
}

export function hasPendingCreateAutomationGuide() {
  return guidePending
}

export function clearPendingCreateAutomationGuide() {
  guidePending = false
}
