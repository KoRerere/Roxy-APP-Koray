const AI_BATCH_CREATE_GUIDE_SHOWN_STORAGE_PREFIX = 'agent-console:batch-create-guide-shown:'

export const AI_BATCH_CREATE_GUIDE_EVENT = 'agent-console:batch-create-guide-requested'

interface GuideStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

let guidePending = false
let guideForced = false

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

export function getAiBatchCreateGuideStorageKey(accountId: unknown) {
  if (accountId === undefined || accountId === null || accountId === '')
    return ''

  return `${AI_BATCH_CREATE_GUIDE_SHOWN_STORAGE_PREFIX}${encodeURIComponent(String(accountId))}`
}

export function hasShownAiBatchCreateGuide(accountId: unknown, storage = getLocalStorage()) {
  const storageKey = getAiBatchCreateGuideStorageKey(accountId)
  if (!storageKey || !storage)
    return false

  try {
    return storage.getItem(storageKey) === '1'
  }
  catch {
    return false
  }
}

export function markAiBatchCreateGuideShown(accountId: unknown, storage = getLocalStorage()) {
  const storageKey = getAiBatchCreateGuideStorageKey(accountId)
  if (!storageKey || !storage)
    return

  try {
    storage.setItem(storageKey, '1')
  }
  catch {
    // The guide can still be used when local storage is unavailable.
  }
}

export function requestAiBatchCreateGuide(force = false) {
  guidePending = true
  guideForced = guideForced || force
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(AI_BATCH_CREATE_GUIDE_EVENT))
}

export function hasPendingAiBatchCreateGuide() {
  return guidePending
}

export function isAiBatchCreateGuideForced() {
  return guideForced
}

export function clearPendingAiBatchCreateGuide() {
  guidePending = false
  guideForced = false
}
