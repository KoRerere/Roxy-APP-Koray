import { readFile, writeFile } from "fs/promises";
import bookmarks from "./bookmarks.json";
import { fileExists } from "/@/utils";
import crypto from 'crypto'

export type BookmarkType = {
  name: string
  type: 'folder' | 'url'
  children?: BookmarkType[]
  url?: string
}

type OriginBookmarkType = typeof defaultBookmarks

// bookmark_bar、other、synced 字段都需要，否则 checksum 不会自动生成
const defaultBookmarks = {
  "bookmark_bar": {
    "children": [],
    get date_added() {
      return `${Date.now() * 1000 + 11644473600000000}`
    },
    "date_last_used": "0",
    "date_modified": "0",
    get guid() {
      return crypto.randomUUID()
    },
    "id": "1",
    "name": "书签栏",
    "type": "folder"
  },
  "other": {
    "children": [],
    get date_added() {
      return `${Date.now() * 1000 + 11644473600000000}`
    },
    "date_last_used": "0",
    "date_modified": "0",
    get guid() {
      return crypto.randomUUID()
    },
    "id": "2",
    "name": "其他书签",
    "type": "folder"
  },
  "synced": {
    "children": [],
    get date_added() {
      return `${Date.now() * 1000 + 11644473600000000}`
    },
    "date_last_used": "0",
    "date_modified": "0",
    get guid() {
      return crypto.randomUUID()
    },
    "id": "3",
    "name": "移动设备书签",
    "type": "folder"
  }
}

/** 导入书签到 Chrome */
export async function importBookmarks(bookmarkPath: string) {
  const importMode: 'merge' | 'replace' = 'merge'

  const originBookmarks = {
    checksum: '',
    "roots": {
      ...defaultBookmarks
    },
    "version": 1
  }

  if (await fileExists(bookmarkPath)) {
    try {
      Object.assign(originBookmarks, JSON.parse(await readFile(bookmarkPath, 'utf-8')))
    } catch (error) {

    }
  }

  const nextId = generateNextId(originBookmarks);

  if (importMode === 'merge') {
    mergeBookmarks(originBookmarks.roots.bookmark_bar.children, bookmarks.bookmarkBar, nextId)
    await writeFile(bookmarkPath, JSON.stringify(originBookmarks, null, 2), 'utf-8')
  } else {
    originBookmarks.roots = bookmarks
    await writeFile(bookmarkPath, JSON.stringify(originBookmarks, null, 2), 'utf-8')
  }
}

/** 生成递增的 id（基于现有最大 id） */
function generateNextId(existingBookmarks) {
  let maxId = 0;
  function traverse(nodes) {
    nodes.forEach?.(node => {
      if (node.id && parseInt(node.id) > maxId) maxId = parseInt(node.id);
      if (node.children) traverse(node.children);
    });
  }
  traverse([existingBookmarks.roots.bookmark_bar]);
  return (maxId + 1).toString();
}

function generateChecksum(roots) {
  const rootsJson = JSON.stringify(roots, null, 0);
  return crypto.createHash('md5').update(rootsJson).digest('hex').toLowerCase();
}

// ================== 合并书签 ==================
function mergeBookmarks(existingData: OriginBookmarkType['bookmark_bar']['children'], newItems: BookmarkType[], nextId: any) {
  newItems.forEach(item => {
    if (item.type === 'folder') {
      const targetItem = existingData.find?.(i => i.name === item.name && i.type === 'folder')
      if (targetItem) {
        if (item.children?.length) {
          targetItem.children ||= []
          mergeBookmarks(targetItem.children, item.children, nextId)
        }
      } else {
        const newItem = {
          children: [],
          "date_added": `${Date.now() * 1000 + 11644473600000000}`,
          "date_last_used": "0",
          "date_modified": "0",
          "guid": crypto.randomUUID(),
          "id": (nextId++).toString(),
          "name": item.name,
          "type": "folder"
        }
        if (item.children?.length) {
          nextId = mergeBookmarks(newItem.children, item.children, nextId)
        }
        existingData.push(newItem)
      }
    } else if (item.type === 'url' && !existingData.find?.(i => i.url === item.url)) {
      const newItem = {
        "date_added": `${Date.now() * 1000 + 11644473600000000}`,
        "date_last_used": "0",
        "guid": crypto.randomUUID(),
        "id": (nextId++).toString(),
        "name": item.name,
        "type": "url",
        "url": item.url
      }
      existingData.push(newItem)
    }

  })

  return nextId
}
