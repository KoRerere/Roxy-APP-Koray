import type { MyTemplateItem, UserTemplateDTO } from './my-templates'

const STORAGE_KEY = 'agent-console:unread-template-keys'
const DRAWER_STORAGE_KEY = 'agent-console:unread-template-drawer-keys'
const MAX_STORED_KEYS = 500

type TemplateIdentity = Pick<UserTemplateDTO, 'id' | 'workspaceId'> | Pick<MyTemplateItem, 'id' | 'workspaceId'>
type TemplateUnreadStorage = Pick<Storage, 'getItem' | 'setItem'>

function resolveStorage(storage?: TemplateUnreadStorage | null) {
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

export function getTemplateUnreadKey(template: TemplateIdentity) {
  const workspaceId = typeof template.workspaceId === 'string' ? template.workspaceId.trim() : ''
  if (!workspaceId || !Number.isSafeInteger(template.id) || template.id <= 0)
    return undefined

  return `${workspaceId}:${template.id}`
}

function readUnreadKeys(storageKey: string, storage?: TemplateUnreadStorage | null) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage)
    return new Set<string>()

  try {
    const parsed = JSON.parse(targetStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed))
      return new Set<string>()

    return new Set(parsed.filter((value): value is string => typeof value === 'string' && Boolean(value)))
  }
  catch {
    return new Set<string>()
  }
}

export function readUnreadTemplateKeys(storage?: TemplateUnreadStorage | null) {
  return readUnreadKeys(STORAGE_KEY, storage)
}

export function readUnreadTemplateDrawerKeys(storage?: TemplateUnreadStorage | null) {
  return readUnreadKeys(DRAWER_STORAGE_KEY, storage)
}

function writeUnreadKeys(storageKey: string, keys: Set<string>, storage?: TemplateUnreadStorage | null) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage)
    return

  try {
    targetStorage.setItem(storageKey, JSON.stringify([...keys].slice(-MAX_STORED_KEYS)))
  }
  catch {
    // Unread state is best-effort and must not block template actions.
  }
}

function addUnreadKey(storageKey: string, template: TemplateIdentity, storage?: TemplateUnreadStorage | null) {
  const keys = readUnreadKeys(storageKey, storage)
  const key = getTemplateUnreadKey(template)
  if (key) {
    keys.add(key)
    writeUnreadKeys(storageKey, keys, storage)
  }
  return keys
}

function removeUnreadKey(storageKey: string, template: TemplateIdentity, storage?: TemplateUnreadStorage | null) {
  const keys = readUnreadKeys(storageKey, storage)
  const key = getTemplateUnreadKey(template)
  if (key && keys.delete(key))
    writeUnreadKeys(storageKey, keys, storage)
  return keys
}

export function markTemplateUnread(template: TemplateIdentity, storage?: TemplateUnreadStorage | null) {
  const keys = addUnreadKey(STORAGE_KEY, template, storage)
  addUnreadKey(DRAWER_STORAGE_KEY, template, storage)
  return keys
}

export function markTemplateRead(template: TemplateIdentity, storage?: TemplateUnreadStorage | null) {
  const keys = removeUnreadKey(STORAGE_KEY, template, storage)
  removeUnreadKey(DRAWER_STORAGE_KEY, template, storage)
  return keys
}

export function markTemplateDrawerRead(template: TemplateIdentity, storage?: TemplateUnreadStorage | null) {
  return removeUnreadKey(DRAWER_STORAGE_KEY, template, storage)
}

export function isTemplateUnread(keys: ReadonlySet<string>, template: TemplateIdentity) {
  const key = getTemplateUnreadKey(template)
  return Boolean(key && keys.has(key))
}
