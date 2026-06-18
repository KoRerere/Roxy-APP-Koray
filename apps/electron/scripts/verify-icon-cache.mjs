// 校验图标徽章缓存判定逻辑（不依赖 Canvas / Electron）
// 用法：cd apps/electron && node scripts/verify-icon-cache.mjs
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const BROWSER_ICON_CACHE_VERSION = 1

async function readIconMeta(metaPath) {
  try {
    const raw = await readFile(metaPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (typeof parsed.version !== 'number' || typeof parsed.badge !== 'string')
      return null
    return parsed
  }
  catch {
    return null
  }
}

async function isIconCacheValid(iconPath, metaPath, badgeText) {
  try {
    await access(iconPath)
  }
  catch {
    return false
  }

  const meta = await readIconMeta(metaPath)
  if (!meta)
    return false

  return meta.version === BROWSER_ICON_CACHE_VERSION && meta.badge === badgeText
}

const dir = join(tmpdir(), `icon-cache-${randomUUID()}`)
const iconPath = join(dir, 'firefox-icon.ico')
const metaPath = join(dir, 'firefox-icon.meta.json')

await mkdir(dir, { recursive: true })

const cases = [
  { setup: async () => {}, badge: '88', expected: false, name: '无缓存文件' },
  {
    setup: async () => {
      await writeFile(iconPath, 'icon')
    },
    badge: '88',
    expected: false,
    name: '仅有图标无 meta',
  },
  {
    setup: async () => {
      await writeFile(iconPath, 'icon')
      await writeFile(metaPath, JSON.stringify({ version: 1, badge: '1' }))
    },
    badge: '88',
    expected: false,
    name: '徽章不匹配',
  },
  {
    setup: async () => {
      await writeFile(iconPath, 'icon')
      await writeFile(metaPath, JSON.stringify({ version: 0, badge: '88' }))
    },
    badge: '88',
    expected: false,
    name: '缓存版本过期',
  },
  {
    setup: async () => {
      await writeFile(iconPath, 'icon')
      await writeFile(metaPath, JSON.stringify({ version: 1, badge: '88' }))
    },
    badge: '88',
    expected: true,
    name: '缓存有效',
  },
]

for (const c of cases) {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  await c.setup()
  const ok = await isIconCacheValid(iconPath, metaPath, c.badge)
  if (ok !== c.expected)
    throw new Error(`${c.name}: 期望 ${c.expected}，实际 ${ok}`)
  console.log(`✅ ${c.name}`)
}

await rm(dir, { recursive: true, force: true })
console.log('\n图标徽章缓存判定逻辑校验通过')
