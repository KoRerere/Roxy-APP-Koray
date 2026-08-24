import type { ExtractedScriptMeta } from './scriptMeta'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '@/config'
import { agentPaths } from '@/core/storage/agentPaths'
import { extractScriptMeta } from './scriptMeta'

/**
 * 从脚本自描述里取文本字段（name/description）。
 * defineMetadata 的字段既可能是纯字符串，也可能是多语言 dict（如 { cn, en, ru }），
 * 这里统一按当前 SYSTEM_LANGUAGE 取值并回退，保证列表展示到脚本的真实名称/描述而非文件名。
 */
function pickMetaText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (value && typeof value === 'object') {
    const dict = value as Record<string, string>
    const key = env.SYSTEM_LANGUAGE === 'zh-CN' ? 'cn' : 'en'
    const picked = dict[key] || dict.cn || dict.zh || dict.en || Object.values(dict)[0] || ''
    return String(picked).trim()
  }
  return ''
}

/**
 * 本地脚本库：`library/scripts/{slug}.ts` 单文件即真身，文件名 slug 即身份。
 * 脚本自描述——name/description/version/defaultDirId 来自内联 `defineMetadata`，
 * 入参 schema 来自内联 `defineParams`，创建/更新时间来自文件 stat。零描述文件。
 *
 * 脚本是全局资产（无 workspace 分区）。后端同步本次已下架（无 remote 映射）。
 */

export interface LibraryScript {
  /** 文件名（无扩展名）= 身份 */
  slug: string
  /** 展示名（来自 defineMetadata.name，缺省回退 slug） */
  name: string
  /** 脚本描述 */
  description?: string
  /** 入参 JSON Schema（来自 defineParams，序列化为字符串，供前端渲染运行表单） */
  optionsSchema?: string
  /** script.ts 绝对路径 */
  scriptFile: string
  /** 创建时间 ISO（文件 birthtime） */
  createdAt: string
  /** 更新时间 ISO（文件 mtime） */
  updatedAt: string
}

function safeExtract(code: string): ExtractedScriptMeta | null {
  try {
    return extractScriptMeta(code)
  }
  catch {
    return null
  }
}

function toLibraryScript(scriptFile: string, code: string, stat: fs.Stats): LibraryScript {
  const extracted = safeExtract(code)
  const meta = extracted?.metadata
  const slug = path.basename(scriptFile, path.extname(scriptFile))
  // name/description 从脚本自描述（defineMetadata）提取，支持字符串或多语言 dict；缺省回退 slug
  const name = pickMetaText(meta?.name)
  const description = pickMetaText(meta?.description)
  const optionsSchema = extracted?.paramsSchema ? JSON.stringify(extracted.paramsSchema) : undefined
  return {
    slug,
    name: name || slug,
    description: description || undefined,
    optionsSchema,
    scriptFile,
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  }
}

function isScriptFileName(entry: string): boolean {
  return !entry.startsWith('.') && (entry.endsWith('.ts') || entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.mts'))
}

export const LibraryStore = {
  /** 规范化并返回一个可用作文件名的 slug。 */
  normalizeSlug(slug: string): string {
    return slug
  },

  /** slug 是否已存在（判重名）。 */
  exists(slug: string): boolean {
    return fs.existsSync(agentPaths.scriptFile(slug))
  },

  /** 读取脚本代码。 */
  readCode(slug: string): string | null {
    try {
      return fs.readFileSync(agentPaths.scriptFile(slug), 'utf-8')
    }
    catch {
      return null
    }
  },

  /** 读取单个脚本（含代码提取的元信息 + 路径），不存在返回 null。 */
  get(slug: string): LibraryScript | null {
    const scriptFile = agentPaths.scriptFile(slug)
    let stat: fs.Stats
    let code: string
    try {
      stat = fs.statSync(scriptFile)
      code = fs.readFileSync(scriptFile, 'utf-8')
    }
    catch {
      return null
    }
    return toLibraryScript(scriptFile, code, stat)
  },

  /** 列出所有脚本（按更新时间倒序）。 */
  list(): LibraryScript[] {
    let entries: string[]
    try {
      entries = fs.readdirSync(agentPaths.scriptsRoot)
    }
    catch {
      return []
    }
    return entries
      .filter(isScriptFileName)
      .map(entry => this.get(entry.slice(0, -3)))
      .filter((script): script is LibraryScript => script !== null)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  },
}
