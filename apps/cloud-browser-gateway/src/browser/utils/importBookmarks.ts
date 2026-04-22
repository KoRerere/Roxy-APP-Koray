import crypto from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileExists } from '~/utils'

export interface BookmarkType {
  name: string
  type: 'folder' | 'url'
  children?: BookmarkType[]
  url?: string
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

interface ImportBookmarksParams {
  bookmarks: Record<string, any>
  bookmarkPath: string
  preferencesPath: string
}

/** 导入书签到 Chrome */
export async function importBookmarks({ bookmarks, bookmarkPath, preferencesPath }: ImportBookmarksParams) {
  if (!bookmarks) {
    return
  }

  const { importMode, bookmarkBar, other, synced } = bookmarks
  const isReplace = importMode === 'replace'

  const originBookmarks = {
    checksum: '',
    roots: {
      ...getDefaultBookmarks(),
    },
    version: 1,
  }

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

  let nextId = generateNextId(originBookmarks)

  if (Array.isArray(bookmarkBar) && bookmarkBar.length) {
    nextId = mergeBookmarks(originBookmarks.roots.bookmark_bar.children, bookmarkBar, nextId, isReplace)
  }
  if (Array.isArray(other) && other.length) {
    nextId = mergeBookmarks(originBookmarks.roots.other.children, other, nextId, isReplace)
  }
  if (Array.isArray(synced) && synced.length) {
    nextId = mergeBookmarks(originBookmarks.roots.synced.children, synced, nextId, isReplace)
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

type BookmarkNode = {
  id?: string
  children?: BookmarkNode[]
}

interface BookmarkRootsShape {
  roots: {
    bookmark_bar: BookmarkNode
  }
}

/** 生成递增的 id（基于现有最大 id） */
function generateNextId(existingBookmarks: BookmarkRootsShape) {
  let maxId = 0
  function traverse(nodes: BookmarkNode[] | undefined) {
    nodes?.forEach?.((node) => {
      if (node.id && Number.parseInt(node.id) > maxId)
        maxId = Number.parseInt(node.id)
      if (node.children)
        traverse(node.children)
    })
  }
  traverse([existingBookmarks.roots.bookmark_bar])
  return (maxId + 1).toString()
}

/**
 * ================== 合并书签 ==================
 */
function mergeBookmarks(existingData: OriginBookmarkType['bookmark_bar']['children'], newItems: BookmarkType[], nextId: any, replace = false) {
  newItems.forEach((item) => {
    if (!item) {
      return
    }
    if (item.type === 'folder') {
      const targetItem = existingData.find?.(i => i.name === item.name && i.type === 'folder')
      if (!replace && targetItem) {
        if (item.children?.length) {
          targetItem.children ||= []
          mergeBookmarks(targetItem.children, item.children, nextId)
        }
      }
      else {
        const newItem = {
          children: [],
          date_added: `${Date.now() * 1000 + 11644473600000000}`,
          date_last_used: '0',
          date_modified: '0',
          guid: crypto.randomUUID(),
          id: (nextId++).toString(),
          name: item.name,
          type: 'folder' as const,
        }
        if (item.children?.length) {
          nextId = mergeBookmarks(newItem.children, item.children, nextId)
        }
        existingData.push(newItem)
      }
    }
    else if (replace || (item.type === 'url' && !existingData.find?.(i => i.url === item.url))) {
      const newItem = {
        date_added: `${Date.now() * 1000 + 11644473600000000}`,
        date_last_used: '0',
        guid: crypto.randomUUID(),
        id: (nextId++).toString(),
        name: item.name,
        type: 'url' as const,
        url: item.url,
      }
      existingData.push(newItem)
    }
  })

  return nextId
}
