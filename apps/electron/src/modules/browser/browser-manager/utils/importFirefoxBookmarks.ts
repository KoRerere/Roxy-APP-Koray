import crypto from 'node:crypto'
import { rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { fileExists } from '/@/utils'
import type { BookmarkImportData, BookmarkType } from './importBookmarks'
import { normalizeBookmarkImportData } from './importBookmarks'
import { createFirefoxPlacesDatabase } from './createFirefoxPlacesDatabase'

const BOOKMARK_TYPE_URL = 1
const BOOKMARK_TYPE_FOLDER = 2

const PARENT_GUID = {
  bookmarkBar: 'toolbar_____',
  other: 'menu________',
  synced: 'mobile______',
} as const

type PlacesDb = DatabaseSync

type IdState = {
  nextBookmarkId: number
  nextPlaceId: number
}

function firefoxTimestamp() {
  return Date.now() * 1000
}

function reverseHost(url: string) {
  try {
    const hostname = new URL(url).hostname
    if (!hostname)
      return ''
    return `${hostname.split('').reverse().join('')}.`
  }
  catch {
    return ''
  }
}

async function clearWalFiles(placesPath: string) {
  await rm(`${placesPath}-wal`, { force: true })
  await rm(`${placesPath}-shm`, { force: true })
}

function openPlacesDatabase(placesPath: string): PlacesDb {
  const db = new DatabaseSync(placesPath, { timeout: 10_000 })
  db.exec('PRAGMA foreign_keys = OFF')
  return db
}

function closePlacesDatabase(db: PlacesDb) {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  }
  catch {
    // ignore when journal mode is not WAL
  }
  db.close()
}

function assertPlacesSchema(db: PlacesDb) {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'moz_bookmarks'`,
  ).get() as { name?: string } | undefined

  if (!row?.name)
    throw new Error('Invalid places.sqlite: moz_bookmarks table not found')
}

function getBookmarkIdByGuid(db: PlacesDb, guid: string) {
  const row = db.prepare('SELECT id FROM moz_bookmarks WHERE guid = ?').get(guid) as { id?: number } | undefined
  return row?.id ?? null
}

function initIdState(db: PlacesDb): IdState {
  const maxBookmarkRow = db.prepare('SELECT MAX(id) AS maxId FROM moz_bookmarks').get() as { maxId?: number | null }
  const maxPlaceRow = db.prepare('SELECT MAX(id) AS maxId FROM moz_places').get() as { maxId?: number | null }
  return {
    nextBookmarkId: maxBookmarkRow.maxId ?? 0,
    nextPlaceId: maxPlaceRow.maxId ?? 0,
  }
}

function getNextPosition(db: PlacesDb, parentId: number) {
  const row = db.prepare('SELECT MAX(position) AS maxPos FROM moz_bookmarks WHERE parent = ?').get(parentId) as { maxPos?: number | null }
  return (row.maxPos ?? -1) + 1
}

function touchFolderModified(db: PlacesDb, folderId: number) {
  db.prepare(
    `UPDATE moz_bookmarks
     SET lastModified = ?, syncChangeCounter = syncChangeCounter + 1
     WHERE id = ?`,
  ).run(firefoxTimestamp(), folderId)
}

function clearFolderChildren(db: PlacesDb, parentGuid: string) {
  const parentId = getBookmarkIdByGuid(db, parentGuid)
  if (!parentId)
    return

  const toDelete: number[] = []
  const queue = [parentId]

  while (queue.length) {
    const currentParentId = queue.shift()!
    const children = db.prepare(
      'SELECT id, type FROM moz_bookmarks WHERE parent = ?',
    ).all(currentParentId) as Array<{ id: number, type: number }>

    for (const child of children) {
      toDelete.push(child.id)
      if (child.type === BOOKMARK_TYPE_FOLDER)
        queue.push(child.id)
    }
  }

  for (const id of toDelete) {
    const row = db.prepare('SELECT type, fk FROM moz_bookmarks WHERE id = ?').get(id) as { type?: number, fk?: number | null } | undefined
    db.prepare('DELETE FROM moz_bookmarks WHERE id = ?').run(id)
    if (row?.type === BOOKMARK_TYPE_URL && row.fk) {
      db.prepare('UPDATE moz_places SET foreign_count = foreign_count - 1 WHERE id = ?').run(row.fk)
      db.prepare('DELETE FROM moz_places WHERE id = ? AND foreign_count <= 0').run(row.fk)
    }
  }

  touchFolderModified(db, parentId)
}

function getOrCreatePlaceId(db: PlacesDb, url: string, title: string, state: IdState) {
  const existing = db.prepare('SELECT id FROM moz_places WHERE url = ?').get(url) as { id?: number } | undefined
  if (existing?.id) {
    db.prepare('UPDATE moz_places SET foreign_count = foreign_count + 1, title = COALESCE(?, title) WHERE id = ?').run(
      title || null,
      existing.id,
    )
    return existing.id
  }

  state.nextPlaceId += 1
  db.prepare(
    `INSERT INTO moz_places (
      id, url, title, rev_host, visit_count, hidden, typed, frecency, guid, foreign_count, url_hash
    ) VALUES (?, ?, ?, ?, 0, 0, 0, -1, ?, 1, 0)`,
  ).run(state.nextPlaceId, url, title || url, reverseHost(url), crypto.randomUUID())

  return state.nextPlaceId
}

function insertUrlBookmark(db: PlacesDb, parentId: number, item: BookmarkType, state: IdState) {
  if (!item.url)
    return

  const placeId = getOrCreatePlaceId(db, item.url, item.name, state)
  const position = getNextPosition(db, parentId)
  state.nextBookmarkId += 1
  const now = firefoxTimestamp()

  db.prepare(
    `INSERT INTO moz_bookmarks (
      id, type, fk, parent, position, title, dateAdded, lastModified, guid, syncStatus, syncChangeCounter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 1)`,
  ).run(
    state.nextBookmarkId,
    BOOKMARK_TYPE_URL,
    placeId,
    parentId,
    position,
    item.name,
    now,
    now,
    crypto.randomUUID(),
  )
}

function insertFolderBookmark(db: PlacesDb, parentId: number, name: string, state: IdState) {
  const position = getNextPosition(db, parentId)
  state.nextBookmarkId += 1
  const now = firefoxTimestamp()

  db.prepare(
    `INSERT INTO moz_bookmarks (
      id, type, parent, position, title, dateAdded, lastModified, guid, syncStatus, syncChangeCounter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, 1)`,
  ).run(
    state.nextBookmarkId,
    BOOKMARK_TYPE_FOLDER,
    parentId,
    position,
    name,
    now,
    now,
    crypto.randomUUID(),
  )

  touchFolderModified(db, parentId)
  return state.nextBookmarkId
}

function hasBookmarkUrlUnderParent(db: PlacesDb, parentId: number, url: string) {
  const row = db.prepare(
    `SELECT b.id
     FROM moz_bookmarks b
     JOIN moz_places p ON b.fk = p.id
     WHERE b.parent = ? AND p.url = ?`,
  ).get(parentId, url) as { id?: number } | undefined

  return Boolean(row?.id)
}

function mergeIntoParent(
  db: PlacesDb,
  parentId: number,
  items: BookmarkType[],
  replace: boolean,
  state: IdState,
) {
  let changed = false

  for (const item of items) {
    if (!item)
      continue

    if (item.type === 'folder') {
      let folderId: number | null = null

      if (!replace) {
        const existingFolder = db.prepare(
          'SELECT id FROM moz_bookmarks WHERE parent = ? AND type = ? AND title = ?',
        ).get(parentId, BOOKMARK_TYPE_FOLDER, item.name) as { id?: number } | undefined
        folderId = existingFolder?.id ?? null
      }

      if (folderId) {
        if (item.children?.length) {
          changed = mergeIntoParent(db, folderId, item.children, false, state) || changed
        }
        continue
      }

      folderId = insertFolderBookmark(db, parentId, item.name, state)
      changed = true
      if (item.children?.length) {
        changed = mergeIntoParent(db, folderId, item.children, false, state) || changed
      }
      continue
    }

    if (item.type !== 'url' || !item.url)
      continue

    if (!replace && hasBookmarkUrlUnderParent(db, parentId, item.url))
      continue

    insertUrlBookmark(db, parentId, item, state)
    changed = true
  }

  if (changed)
    touchFolderModified(db, parentId)

  return changed
}

function importIntoRootFolder(
  db: PlacesDb,
  parentGuid: string,
  items: BookmarkType[],
  replace: boolean,
  state: IdState,
) {
  if (!items.length)
    return

  const parentId = getBookmarkIdByGuid(db, parentGuid)
  if (!parentId)
    throw new Error(`Firefox bookmark root not found: ${parentGuid}`)

  if (replace)
    clearFolderChildren(db, parentGuid)

  mergeIntoParent(db, parentId, items, replace, state)
}

function importFirefoxBookmarksSync(db: PlacesDb, bookmarkData: BookmarkImportData) {
  const { importMode, bookmarkBar, other, synced } = bookmarkData
  const isReplace = importMode === 'replace'

  assertPlacesSchema(db)
  db.exec('BEGIN IMMEDIATE')

  try {
    const state = initIdState(db)

    if (Array.isArray(bookmarkBar) && bookmarkBar.length) {
      importIntoRootFolder(db, PARENT_GUID.bookmarkBar, bookmarkBar, isReplace, state)
    }
    if (Array.isArray(other) && other.length) {
      importIntoRootFolder(db, PARENT_GUID.other, other, isReplace, state)
    }
    if (Array.isArray(synced) && synced.length) {
      importIntoRootFolder(db, PARENT_GUID.synced, synced, isReplace, state)
    }

    db.exec('COMMIT')
  }
  catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** 使用 node:sqlite 同步读写 Firefox places.sqlite */
export async function importFirefoxBookmarks(placesPath: string, bookmarks: BookmarkImportData | unknown) {
  const bookmarkData = normalizeBookmarkImportData(bookmarks)
  if (!bookmarkData)
    return

  if (!(await fileExists(placesPath)))
    await createFirefoxPlacesDatabase(placesPath)

  await clearWalFiles(placesPath)

  const db = openPlacesDatabase(placesPath)
  try {
    importFirefoxBookmarksSync(db, bookmarkData)
    console.log('[importFirefoxBookmarks] imported bookmarks into', placesPath, {
      importMode: bookmarkData.importMode,
      bookmarkBar: bookmarkData.bookmarkBar?.length ?? 0,
      other: bookmarkData.other?.length ?? 0,
      synced: bookmarkData.synced?.length ?? 0,
    })
  }
  finally {
    closePlacesDatabase(db)
  }
}
