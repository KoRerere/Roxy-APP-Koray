import crypto from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { importFirefoxBookmarks } from '/@/modules/browser/browser-manager/utils/importFirefoxBookmarks'
import { store } from '/@/modules/store'
import { fileExists } from '/@/utils'

export interface BookmarkType {
  name: string
  type: 'folder' | 'url'
  children?: BookmarkType[]
  url?: string
}

export interface BookmarkImportData {
  importMode?: 'merge' | 'replace'
  bookmarkBar?: BookmarkType[]
  other?: BookmarkType[]
  synced?: BookmarkType[]
}

export function normalizeBookmarkImportData(raw: unknown): BookmarkImportData | null {
  if (!raw)
    return null

  let data = raw
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    }
    catch {
      return null
    }
  }

  if (!data || typeof data !== 'object')
    return null

  const bookmarks = data as BookmarkImportData
  const hasContent = Boolean(
    bookmarks.bookmarkBar?.length
    || bookmarks.other?.length
    || bookmarks.synced?.length,
  )

  if (!hasContent)
    return null

  return {
    ...bookmarks,
    importMode: bookmarks.importMode === 'replace' ? 'replace' : 'merge',
  }
}

type OriginBookmarkType = ReturnType<typeof getDefaultBookmarks>

/**
 * bookmark_bar、other、synced 字段都需要，否则 checksum 不会自动生成
 */
function getDefaultBookmarks() {
  return {
    bookmark_bar: {
      children: [] as BookmarkType[],
      date_added: `${Date.now() * 1000 + 11644473600000000}`,
      date_last_used: '0',
      date_modified: '0',
      guid: crypto.randomUUID(),
      id: '1',
      name: '书签栏',
      type: 'folder' as const,
    },
    other: {
      children: [] as BookmarkType[],
      date_added: `${Date.now() * 1000 + 11644473600000000}`,
      date_last_used: '0',
      date_modified: '0',
      guid: crypto.randomUUID(),
      id: '2',
      name: '其他书签',
      type: 'folder' as const,
    },
    synced: {
      children: [] as BookmarkType[],
      date_added: `${Date.now() * 1000 + 11644473600000000}`,
      date_last_used: '0',
      date_modified: '0',
      guid: crypto.randomUUID(),
      id: '3',
      name: '移动设备书签',
      type: 'folder' as const,
    },
  } as const
}

export interface ImportBookmarksOptions {
  bookmarkPath: string
  preferencesPath?: string
  isFirefox?: boolean
}

/** 导入书签到 Chrome / Firefox */
export async function importBookmarks(options: ImportBookmarksOptions) {
  const bookmarkData = normalizeBookmarkImportData(store.bookText)
  if (!bookmarkData) {
    return
  }

  if (options.isFirefox) {
    await importFirefoxBookmarks(options.bookmarkPath, bookmarkData)
    return
  }

  const { importMode, bookmarkBar, other, synced } = bookmarkData
  const isReplace = importMode === 'replace'
  const preferencesPath = options.preferencesPath
  if (!preferencesPath)
    return

  const originBookmarks = {
    checksum: '',
    roots: {
      ...getDefaultBookmarks(),
    },
    version: 1,
  }

  const bookmarkPath = options.bookmarkPath

  if (await fileExists(bookmarkPath)) {
    if (!isReplace) {
      try {
        Object.assign(originBookmarks, JSON.parse(await readFile(bookmarkPath, 'utf-8')))
      }
      catch (error) {

      }
    }
  }
  else {
    await mkdir(dirname(bookmarkPath), { recursive: true })
  }

  let nextId = Number.parseInt(generateNextId(originBookmarks), 10)

  if (Array.isArray(bookmarkBar) && bookmarkBar.length) {
    nextId = mergeBookmarks(originBookmarks.roots.bookmark_bar.children, bookmarkBar, nextId, isReplace)
  }
  if (Array.isArray(other) && other.length) {
    nextId = mergeBookmarks(originBookmarks.roots.other.children, other, nextId, isReplace)
  }
  if (Array.isArray(synced) && synced.length) {
    mergeBookmarks(originBookmarks.roots.synced.children, synced, nextId, isReplace)
  }
  await writeFile(bookmarkPath, JSON.stringify(originBookmarks, null, 2), 'utf-8')

  await showBookmarkBar(preferencesPath)
}

async function showBookmarkBar(preferencesPath: string) {
  // 显示书签栏
  if (await fileExists(preferencesPath)) {
    try {
      const preferences = JSON.parse(await readFile(preferencesPath, 'utf-8'))

      if (!Reflect.has(preferences, 'bookmark_bar') || !Reflect.has(preferences.bookmark_bar, 'show_on_all_tabs')) {
        preferences.bookmark_bar = {
          ...preferences?.bookmark_bar,
          show_on_all_tabs: true,
        }
        await writeFile(preferencesPath, JSON.stringify(preferences, null, 2), 'utf-8')
      }
    }
    catch (error) {
    }
  }
  else {
    const preferences = {
      bookmark_bar: {
        show_on_all_tabs: true,
      },
    }
    await writeFile(preferencesPath, JSON.stringify(preferences, null, 2), 'utf-8')
  }
}

/** 生成递增的 id（基于现有最大 id） */
function generateNextId(existingBookmarks) {
  let maxId = 0
  function traverse(nodes) {
    nodes.forEach?.((node) => {
      if (node.id && Number.parseInt(node.id) > maxId)
        maxId = Number.parseInt(node.id)
      if (node.children)
        traverse(node.children)
    })
  }
  traverse([
    existingBookmarks.roots.bookmark_bar,
    existingBookmarks.roots.other,
    existingBookmarks.roots.synced,
  ])
  return (maxId + 1).toString()
}

/**
 * ================== 合并书签 ==================
 */
function mergeBookmarks(
  existingData: OriginBookmarkType['bookmark_bar']['children'],
  newItems: BookmarkType[],
  nextId: number,
  replace = false,
) {
  for (const item of newItems) {
    if (!item)
      continue

    if (item.type === 'folder') {
      const targetItem = existingData.find?.(i => i.name === item.name && i.type === 'folder')
      if (!replace && targetItem) {
        if (item.children?.length) {
          targetItem.children ||= []
          nextId = mergeBookmarks(targetItem.children, item.children, nextId, false)
        }
        continue
      }

      const newItem = {
        children: [] as BookmarkType[],
        date_added: `${Date.now() * 1000 + 11644473600000000}`,
        date_last_used: '0',
        date_modified: '0',
        guid: crypto.randomUUID(),
        id: String(nextId++),
        name: item.name,
        type: 'folder' as const,
      }
      if (item.children?.length) {
        nextId = mergeBookmarks(newItem.children, item.children, nextId, false)
      }
      existingData.push(newItem as typeof existingData[number])
      continue
    }

    if (item.type !== 'url')
      continue

    if (!replace && existingData.find?.(i => i.type === 'url' && i.url === item.url))
      continue

    existingData.push({
      date_added: `${Date.now() * 1000 + 11644473600000000}`,
      date_last_used: '0',
      guid: crypto.randomUUID(),
      id: String(nextId++),
      name: item.name,
      type: 'url' as const,
      url: item.url,
    } as typeof existingData[number])
  }

  return nextId
}
