const STORAGE_KEY_PREFIX = 'agent-console:composer-project-selection'

type ProjectSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>

function resolveStorage(storage?: ProjectSelectionStorage | null) {
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

function getStorageKey(workspaceId: string | number | undefined) {
  const normalizedWorkspaceId = String(workspaceId ?? '').trim()
  return normalizedWorkspaceId ? `${STORAGE_KEY_PREFIX}:${normalizedWorkspaceId}` : undefined
}

export function readProjectSelection(workspaceId: string | number | undefined, storage?: ProjectSelectionStorage | null) {
  const storageKey = getStorageKey(workspaceId)
  const targetStorage = resolveStorage(storage)
  if (!storageKey || !targetStorage)
    return undefined

  try {
    return targetStorage.getItem(storageKey)?.trim() || undefined
  }
  catch {
    return undefined
  }
}

export function writeProjectSelection(
  workspaceId: string | number | undefined,
  projectId: string,
  storage?: ProjectSelectionStorage | null,
) {
  const storageKey = getStorageKey(workspaceId)
  const normalizedProjectId = projectId.trim()
  const targetStorage = resolveStorage(storage)
  if (!storageKey || !normalizedProjectId || !targetStorage)
    return

  try {
    targetStorage.setItem(storageKey, normalizedProjectId)
  }
  catch {
    // Remembering the filter is best-effort and must not block window selection.
  }
}
