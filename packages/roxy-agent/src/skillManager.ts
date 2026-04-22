/**
 * Skill Manager
 *
 * 管理用户自定义 Skill 的安装与卸载。
 *
 * Skill 目录规范：
 *   必须包含 SKILL.md，其 YAML frontmatter 中有 name 和 description 字段。
 *
 * 目录布局：
 *   SKILLS_DIR/
 *     {dirName}/     ← 已���装的 skill，FilesystemBackend 自动发现
 *       SKILL.md
 *       ...
 */

import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { env } from './config'

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

export interface SkillValidationResult {
  valid: boolean
  name?: string
  description?: string
  error?: string
  /** 目录中检测到可执行脚本文件（.js/.py/.sh/.bat 等） */
  hasScripts?: boolean
}

export interface SkillEntry {
  name: string
  description: string
  dirName: string
  installedAt: number
}

// ─────────────────────────────────────────────
// YAML frontmatter 解析（简单版本，仅提取 name 和 description）
// ─────────────────────────────────────────────

function parseFrontmatter(content: string): Record<string, string> | null {
  try {
    // 匹配 frontmatter 块
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) {
      console.log('[SkillManager] parseFrontmatter: no frontmatter found')
      return null
    }

    const fmContent = match[1]
    console.log('[SkillManager] parseFrontmatter: frontmatter content found')

    const result: Record<string, string> = {}
    const lines = fmContent.split(/\r?\n/)

    let currentKey: string | null = null
    let currentValue: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // 跳过空行
      if (!trimmedLine) {
        if (currentKey) {
          currentValue.push('')
        }
        continue
      }

      // 检查是否是嵌套行（缩进或以 - 开头）
      if (line.startsWith('  ') || line.startsWith('\t') || trimmedLine.startsWith('- ')) {
        if (currentKey) {
          currentValue.push(line)
        }
        continue
      }

      // 检查是否是新的键值对
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        // 保存之前的键值对
        if (currentKey) {
          result[currentKey] = currentValue.join('\n').trim()
          console.log(`[SkillManager] parseFrontmatter: parsed ${currentKey}=`, result[currentKey])
        }

        // 开始新的键
        currentKey = line.slice(0, colonIdx).trim()
        const valuePart = line.slice(colonIdx + 1).trim()

        // 只关心 name 和 description
        if (currentKey !== 'name' && currentKey !== 'description') {
          currentKey = null
          currentValue = []
          continue
        }

        // 检查是否是多行字符串标记
        if (valuePart === '|' || valuePart === '|-' || valuePart === '>' || valuePart === '>-') {
          currentValue = []
        }
        else {
          // 单行值，去除引号
          currentValue = [valuePart.replace(/^['"]|['"]$/g, '')]
        }
      }
      else if (currentKey) {
        // 多行值的后续行
        currentValue.push(line)
      }
    }

    // 保存最后一个键值对
    if (currentKey) {
      result[currentKey] = currentValue.join('\n').trim()
      console.log(`[SkillManager] parseFrontmatter: parsed ${currentKey}=`, result[currentKey])
    }

    console.log('[SkillManager] parseFrontmatter final result:', result)
    return result
  }
  catch (err: any) {
    console.error('[SkillManager] parseFrontmatter error:', err)
    return null
  }
}

function toSafeDirName(name: string): string {
  return name.trim().replace(/[^\w\-]/g, '_').replace(/_+/g, '_')
}

const SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.py', '.sh', '.bash', '.zsh', '.bat', '.cmd', '.ps1', '.rb', '.pl'])

/** 递归检测目录下是否包含脚本文件 */
function containsScripts(dir: string): boolean {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.'))
        continue
      const fullPath = path.join(dir, entry)
      try {
        if (statSync(fullPath).isDirectory()) {
          if (containsScripts(fullPath))
            return true
        }
        else if (SCRIPT_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
          return true
        }
      }
      catch { /* ignore */ }
    }
  }
  catch { /* ignore */ }
  return false
}

// ─────────────────────────────────────────────
// 递归复制目录
// ─────────────────────────────────────────────

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (statSync(srcPath).isDirectory()) {
      await copyDirRecursive(srcPath, destPath)
    }
    else {
      await copyFile(srcPath, destPath)
    }
  }
}

// ─────────────────────────────────────────────
// zip 解压到临时目录，返回 skill 根目录路径
// ─────────────────────────────────────────────

/**
 * 将 zip 解压到临时目录，自动处理顶层嵌套目录。
 * zip 内布局支持两种：
 *   1. 直接在根：SKILL.md, guides/, ...
 *   2. 包一层目录：my-skill/SKILL.md, my-skill/guides/, ...
 * 返回解压后 SKILL.md 所在的目录路径。
 */
async function extractZipToTemp(zipPath: string): Promise<{ tempDir: string, skillRootDir: string }> {
  const tempDir = path.join(os.tmpdir(), `roxy-skill-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(tempDir, true)

  // 判断是否有顶层包装目录（zip 内只有一个子目录且没有 SKILL.md 在根）
  const rootEntries = readdirSync(tempDir).filter(e => !e.startsWith('.'))
  const hasSkillMdAtRoot = existsSync(path.join(tempDir, 'SKILL.md'))

  if (!hasSkillMdAtRoot && rootEntries.length === 1) {
    const singleEntry = path.join(tempDir, rootEntries[0])
    if (statSync(singleEntry).isDirectory()) {
      return { tempDir, skillRootDir: singleEntry }
    }
  }

  return { tempDir, skillRootDir: tempDir }
}

// ─────────────────────────────────────────────
// SkillManager
// ─────────────────────────────────────────────

export class SkillManager {
  private readonly skillsDir: string
  private readonly builtinSkills: Set<string>

  constructor(skillsDir: string) {
    this.skillsDir = path.join(skillsDir, 'skills')
    mkdirSync(this.skillsDir, { recursive: true })
    this.builtinSkills = new Set(['roxybrowser-openapi-skills', 'roxybrowser-playwright-skills'])
  }

  /** 判断是否是内置 skill */
  private isBuiltinSkill(dirName: string): boolean {
    return this.builtinSkills.has(dirName)
  }

  // ──────────────────────────────────────────
  // 校验
  // ──────────────────────────────────────────

  /**
   * 校验来源路径是否符合 skill 规范。
   * 支持：
   *   - 本地目录：直接校验 SKILL.md
   *   - .zip 文件：解压到临时目录后校验，校验完立即清理临时目录
   */
  async validateSkillSource(sourcePath: string): Promise<SkillValidationResult> {
    if (!existsSync(sourcePath))
      return { valid: false, error: `路径不存在: ${sourcePath}` }

    const isZip = sourcePath.toLowerCase().endsWith('.zip') && statSync(sourcePath).isFile()

    if (isZip) {
      let tempDir: string | undefined
      try {
        const extracted = await extractZipToTemp(sourcePath)
        tempDir = extracted.tempDir
        const result = await this._validateDir(extracted.skillRootDir)
        return result
      }
      catch (err: any) {
        return { valid: false, error: `zip 解压失败: ${err.message}` }
      }
      finally {
        if (tempDir)
          await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    if (!statSync(sourcePath).isDirectory())
      return { valid: false, error: '路径既不是目录，也不是 .zip 文件' }

    return this._validateDir(sourcePath)
  }

  /** 校验一个已解压/已有的目录 */
  private async _validateDir(dirPath: string): Promise<SkillValidationResult> {
    const skillMdPath = path.join(dirPath, 'SKILL.md')
    if (!existsSync(skillMdPath))
      return { valid: false, error: '目录中缺少 SKILL.md 文件' }

    let content: string
    try {
      content = await readFile(skillMdPath, 'utf-8')
    }
    catch (err: any) {
      return { valid: false, error: `无法读取 SKILL.md: ${err.message}` }
    }

    const fm = parseFrontmatter(content)
    if (!fm)
      return { valid: false, error: 'SKILL.md 缺少 YAML frontmatter（需要以 --- 包裹）' }
    if (!fm.name?.trim())
      return { valid: false, error: 'SKILL.md frontmatter 缺少 name 字段' }
    if (!fm.description?.trim())
      return { valid: false, error: 'SKILL.md frontmatter 缺少 description 字段' }

    return {
      valid: true,
      name: fm.name.trim(),
      description: fm.description.trim(),
      hasScripts: containsScripts(dirPath),
    }
  }

  // ──────────────────────────────────────────
  // 列表
  // ──────────────────────────────────────────

  async listSkills(): Promise<SkillEntry[]> {
    const results: SkillEntry[] = []
    for (const dirName of this._listSubDirs(this.skillsDir)) {
      // 跳过内置 skills
      if (this.isBuiltinSkill(dirName)) {
        continue
      }
      const entry = await this._readEntry(path.join(this.skillsDir, dirName), dirName)
      if (entry)
        results.push(entry)
    }
    return results
  }

  private _listSubDirs(dir: string): string[] {
    if (!existsSync(dir))
      return []
    return readdirSync(dir).filter((name) => {
      if (name.startsWith('.'))
        return false
      try {
        return statSync(path.join(dir, name)).isDirectory()
      }
      catch {
        return false
      }
    })
  }

  private async _readEntry(dirPath: string, dirName: string): Promise<SkillEntry | null> {
    const skillMdPath = path.join(dirPath, 'SKILL.md')
    if (!existsSync(skillMdPath))
      return null
    try {
      const content = await readFile(skillMdPath, 'utf-8')
      const fm = parseFrontmatter(content)
      if (!fm?.name)
        return null

      let installedAt = 0
      const metaPath = path.join(dirPath, '.skill_meta.json')
      if (existsSync(metaPath)) {
        try {
          installedAt = JSON.parse(await readFile(metaPath, 'utf-8')).installedAt ?? 0
        }
        catch { /* ignore */ }
      }

      return { name: fm.name, description: fm.description ?? '', dirName, installedAt }
    }
    catch {
      return null
    }
  }

  // ──────────────────────────────────────────
  // 安装
  // ──────────────────────────────────────────

  /**
   * 从本地目录或 .zip 文件安装 skill。
   * zip 会先解压到临时目录，安装完成后清理。
   */
  async installSkill(sourcePath: string): Promise<SkillEntry> {
    if (!existsSync(sourcePath))
      throw new Error(`路径不存在: ${sourcePath}`)

    const isZip = sourcePath.toLowerCase().endsWith('.zip') && statSync(sourcePath).isFile()

    if (isZip) {
      let tempDir: string | undefined
      try {
        const extracted = await extractZipToTemp(sourcePath)
        tempDir = extracted.tempDir
        return await this._installFromDir(extracted.skillRootDir, sourcePath)
      }
      finally {
        if (tempDir)
          await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    return this._installFromDir(sourcePath, sourcePath)
  }

  private async _installFromDir(dirPath: string, originalSource: string): Promise<SkillEntry> {
    const validation = await this._validateDir(dirPath)
    if (!validation.valid)
      throw new Error(validation.error)

    const dirName = toSafeDirName(validation.name!)
    const destPath = path.join(this.skillsDir, dirName)

    if (existsSync(destPath))
      throw new Error(`Skill "${validation.name}" 已安装，如需更新请先卸载`)

    await copyDirRecursive(dirPath, destPath)

    const installedAt = Date.now()
    writeFileSync(
      path.join(destPath, '.skill_meta.json'),
      JSON.stringify({ installedAt, sourcePath: originalSource }, null, 2),
    )

    return {
      name: validation.name!,
      description: validation.description!,
      dirName,
      installedAt,
    }
  }

  // ──────────────────────────────────────────
  // 卸载
  // ──────────────────────────────────────────

  async uninstallSkill(name: string): Promise<void> {
    const dirName = toSafeDirName(name)

    // 禁止卸载内置 skills
    if (this.isBuiltinSkill(dirName)) {
      throw new Error(`内置 Skill "${name}" 不能卸载`)
    }

    const destPath = path.join(this.skillsDir, dirName)

    if (!existsSync(destPath))
      throw new Error(`Skill "${name}" 未安装`)

    await rm(destPath, { recursive: true, force: true })
  }
}

// ─────────────────────────────────────────────
// 单例
// ─────────────────────────────────────────────

let _skillManager: SkillManager | null = null

export function getSkillManager(): SkillManager {
  if (!_skillManager) {
    _skillManager = new SkillManager(env.SKILLS_DIR, env.BUILTIN_SKILLS)
  }
  return _skillManager
}
