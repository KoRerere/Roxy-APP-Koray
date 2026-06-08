import type { UserSkill } from './api/skills'
import type { SkillMetadataLoadErrorCode, SkillMetadataLoadFailure } from './skills/metadata'
import type { RuntimeAvailability, RuntimeCommandRunner, SkillRuntimeDescriptor, SkillRuntimeSource } from './skills/runtime'
import AdmZip from 'adm-zip'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { aiAgentSkillsApi } from './api/skills'
import { env } from './config'
import { loadSkillMetadataFromDir } from './skills/metadata'
import {
  detectSkillRuntimes,
  isSupportedRuntimeId,
  probeRuntimeAvailability,
} from './skills/runtime'

export type SkillValidationErrorCode
  = | SkillMetadataLoadErrorCode
    | 'path-not-found'
    | 'invalid-source-type'
    | 'zip-extract-failed'

export interface SkillValidationResult {
  valid: boolean
  name?: string
  description?: string
  error?: string
  errorCode?: SkillValidationErrorCode
}

export type SkillSource = 'user' | 'store'

export interface SkillEntry {
  name: string
  /** 国际化展示名：商城 skill 来自后端（按 Language 返回），用户导入的 skill 为空，回退到 name */
  title?: string | null
  description: string
  dirName: string
  rootDir: string
  installedAt: number
  hasScripts: boolean
  runtimeSource: SkillRuntimeSource
  runtimes: Array<SkillRuntimeDescriptor & RuntimeAvailability>
  missingRuntimeIds: string[]
  /** 来源：用户自行导入 or 商城安装 */
  source: SkillSource
  /** 是否启用，禁用后不会被 agent 加载，但不会删除 */
  enabled: boolean
  /** 商城 skill 的 slug，用于关联远端记录 */
  slug?: string
}

interface SkillMeta {
  installedAt?: number
  sourcePath?: string
  slug?: string
  enabled?: boolean | 0 | 1
}

interface InstallSkillOptions {
  source?: SkillSource
  slug?: string
  enabled?: boolean
}

interface SkillManagerDeps {
  runtimeCommandRunner?: RuntimeCommandRunner
}

function toSafeDirName(name: string): string {
  return name.trim().replace(/[^\w\-]/g, '_').replace(/_+/g, '_')
}

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

async function extractZipToTemp(zipPath: string): Promise<{ tempDir: string, skillRootDir: string }> {
  const tempDir = path.join(os.tmpdir(), `roxy-skill-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(tempDir, true)

  const rootEntries = readdirSync(tempDir).filter(entry => !entry.startsWith('.'))
  const hasSkillMdAtRoot = existsSync(path.join(tempDir, 'SKILL.md'))

  if (!hasSkillMdAtRoot && rootEntries.length === 1) {
    const singleEntry = path.join(tempDir, rootEntries[0])
    if (statSync(singleEntry).isDirectory()) {
      return { tempDir, skillRootDir: singleEntry }
    }
  }

  return { tempDir, skillRootDir: tempDir }
}

function formatValidationError(result: SkillMetadataLoadFailure): string {
  switch (result.code) {
    case 'missing-skill-md':
      return '目录中缺少 SKILL.md 文件'
    case 'read-failed':
      return `无法读取 SKILL.md: ${result.message}`
    case 'missing-frontmatter':
      return 'SKILL.md 缺少 YAML frontmatter（需要以 --- 包裹）'
    case 'invalid-yaml':
      return 'SKILL.md frontmatter 不是合法 YAML'
    case 'frontmatter-not-mapping':
      return 'SKILL.md frontmatter 必须是对象'
    case 'missing-name':
      return 'SKILL.md frontmatter 缺少 name 字段'
    case 'missing-description':
      return 'SKILL.md frontmatter 缺少 description 字段'
    case 'content-too-large':
      return 'SKILL.md 文件过大'
    default:
      return result.message
  }
}

function isRemoteSkillEnabled(skill: UserSkill): boolean {
  return skill.enabled !== false && skill.enabled !== 0
}

export class SkillManager {
  private readonly skillsDir: string
  private readonly storeSkillsDir: string
  private readonly builtinSkills: Set<string>
  private readonly runtimeCommandRunner?: RuntimeCommandRunner

  constructor(skillsDir: string, deps: SkillManagerDeps = {}) {
    this.skillsDir = path.join(skillsDir, 'skills')
    this.storeSkillsDir = path.join(skillsDir, 'store-skills')
    mkdirSync(this.skillsDir, { recursive: true })
    mkdirSync(this.storeSkillsDir, { recursive: true })
    this.builtinSkills = new Set(['roxybrowser-openapi-skills', 'roxybrowser-playwright-skills'])
    this.runtimeCommandRunner = deps.runtimeCommandRunner
    this.migrateLegacyStoreSkills()
  }

  private isBuiltinSkill(dirName: string): boolean {
    return this.builtinSkills.has(dirName)
  }

  async validateSkillSource(sourcePath: string): Promise<SkillValidationResult> {
    if (!existsSync(sourcePath)) {
      return { valid: false, error: `路径不存在: ${sourcePath}`, errorCode: 'path-not-found' }
    }

    const isZip = sourcePath.toLowerCase().endsWith('.zip') && statSync(sourcePath).isFile()

    if (isZip) {
      let tempDir: string | undefined
      try {
        const extracted = await extractZipToTemp(sourcePath)
        tempDir = extracted.tempDir
        return await this.validateSkillDir(extracted.skillRootDir)
      }
      catch (error: any) {
        return { valid: false, error: `zip 解压失败: ${error.message}`, errorCode: 'zip-extract-failed' }
      }
      finally {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        }
      }
    }

    if (!statSync(sourcePath).isDirectory()) {
      return { valid: false, error: '路径既不是目录，也不是 .zip 文件', errorCode: 'invalid-source-type' }
    }

    return this.validateSkillDir(sourcePath)
  }

  private async validateSkillDir(dirPath: string): Promise<SkillValidationResult> {
    const result = await loadSkillMetadataFromDir(dirPath)
    if (!result.ok) {
      return {
        valid: false,
        error: formatValidationError(result),
        errorCode: result.code,
      }
    }

    return {
      valid: true,
      name: result.metadata.name,
      description: result.metadata.description,
    }
  }

  async listSkills(options: { language?: string } = {}): Promise<SkillEntry[]> {
    const runtimeAvailabilityCache = new Map<string, Promise<RuntimeAvailability>>()
    const results: SkillEntry[] = []
    for (const { dirPath, dirName, source } of this.listManagedSkillDirs()) {
      if (this.isBuiltinSkill(dirName)) {
        continue
      }
      const entry = await this.readEntry(dirPath, dirName, source, runtimeAvailabilityCache)
      if (entry) {
        results.push(entry)
      }
    }
    // 用后端国际化数据覆盖商城 skill 的 title/description
    await this.applyStoreLocalization(results, options.language)
    // 商城安装的 skill 前置，然后按安装时间倒序排序
    return results.sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'store' ? -1 : 1
      }
      return b.installedAt - a.installedAt
    })
  }

  async listAvailableSkills(): Promise<SkillEntry[]> {
    const runtimeAvailabilityCache = new Map<string, Promise<RuntimeAvailability>>()
    const results: SkillEntry[] = []
    for (const { dirPath, dirName, source } of this.listLoadableSkillDirs()) {
      const entry = await this.readEntry(dirPath, dirName, source, runtimeAvailabilityCache)
      if (entry && entry.enabled) {
        results.push(entry)
      }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
  }

  private listSubDirs(dir: string): string[] {
    if (!existsSync(dir)) {
      return []
    }

    return readdirSync(dir).filter((name) => {
      if (name.startsWith('.')) {
        return false
      }

      try {
        return statSync(path.join(dir, name)).isDirectory()
      }
      catch {
        return false
      }
    })
  }

  private async readEntry(
    dirPath: string,
    dirName: string,
    source: SkillSource,
    runtimeAvailabilityCache = new Map<string, Promise<RuntimeAvailability>>(),
  ): Promise<SkillEntry | null> {
    const result = await loadSkillMetadataFromDir(dirPath)
    if (!result.ok) {
      return null
    }

    const meta = await this.readMeta(dirPath)

    return this.buildSkillEntry(result, dirName, source, meta, runtimeAvailabilityCache)
  }

  private async readMeta(dirPath: string): Promise<SkillMeta> {
    const metaPath = path.join(dirPath, '.skill_meta.json')
    if (existsSync(metaPath)) {
      try {
        return JSON.parse(await readFile(metaPath, 'utf-8')) as SkillMeta
      }
      catch {
      }
    }
    return {}
  }

  private async buildSkillEntry(
    metadataResult: Extract<Awaited<ReturnType<typeof loadSkillMetadataFromDir>>, { ok: true }>,
    dirName: string,
    source: SkillSource,
    meta: SkillMeta,
    runtimeAvailabilityCache = new Map<string, Promise<RuntimeAvailability>>(),
  ): Promise<SkillEntry> {
    const runtimeDetection = await detectSkillRuntimes(
      metadataResult.rootDir,
      metadataResult.metadata.runtimes,
    )

    const runtimes = await Promise.all(
      runtimeDetection.runtimes.map(async (runtime) => {
        const availability = isSupportedRuntimeId(runtime.id)
          ? await this.getRuntimeAvailability(runtime.id, runtimeAvailabilityCache)
          : { installed: false }

        return {
          ...runtime,
          ...availability,
        }
      }),
    )

    return {
      name: metadataResult.metadata.name,
      description: metadataResult.metadata.description,
      dirName,
      rootDir: metadataResult.rootDir,
      installedAt: meta.installedAt ?? 0,
      hasScripts: runtimeDetection.hasScripts,
      runtimeSource: runtimeDetection.runtimeSource,
      runtimes,
      missingRuntimeIds: runtimes
        .filter(runtime => isSupportedRuntimeId(runtime.id) && !runtime.installed)
        .map(runtime => runtime.id),
      source,
      enabled: meta.enabled !== false && meta.enabled !== 0,
      slug: meta.slug,
    }
  }

  /**
   * 用后端国际化数据（title/description）覆盖商城 skill 的展示文案。
   * 本地 SKILL.md 只有单语言，而后端按 Language header 返回国际化内容。
   * 失败时静默降级为本地 SKILL.md 文案。
   */
  private async applyStoreLocalization(entries: SkillEntry[], language?: string): Promise<void> {
    const storeEntries = entries.filter(entry => entry.source === 'store' && entry.slug)
    if (storeEntries.length === 0) {
      return
    }

    try {
      const remoteSkills = await aiAgentSkillsApi.listUserSkills(language ? { language } : {})
      const bySlug = new Map(remoteSkills.map(skill => [skill.slug, skill]))
      for (const entry of storeEntries) {
        const remote = bySlug.get(entry.slug!)
        if (!remote) {
          continue
        }
        // 用后端国际化的 title 作为展示名
        if (remote.title) {
          entry.title = remote.title
        }
        // 用后端国际化的 description 覆盖本地 SKILL.md 的 description
        if (remote.description) {
          entry.description = remote.description
        }
      }
    }
    catch (error: any) {
      console.warn(`Failed to apply store localization: ${error.message}`)
    }
  }

  private getRuntimeAvailability(
    runtimeId: 'node' | 'python',
    runtimeAvailabilityCache: Map<string, Promise<RuntimeAvailability>>,
  ): Promise<RuntimeAvailability> {
    const cached = runtimeAvailabilityCache.get(runtimeId)
    if (cached) {
      return cached
    }

    const pending = probeRuntimeAvailability(runtimeId, this.runtimeCommandRunner)
    runtimeAvailabilityCache.set(runtimeId, pending)
    return pending
  }

  async installSkill(sourcePath: string, options: InstallSkillOptions = {}): Promise<SkillEntry> {
    if (!existsSync(sourcePath)) {
      throw new Error(`路径不存在: ${sourcePath}`)
    }

    const isZip = sourcePath.toLowerCase().endsWith('.zip') && statSync(sourcePath).isFile()

    if (isZip) {
      let tempDir: string | undefined
      try {
        const extracted = await extractZipToTemp(sourcePath)
        tempDir = extracted.tempDir
        return await this.installFromDir(extracted.skillRootDir, sourcePath, options)
      }
      finally {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        }
      }
    }

    return this.installFromDir(sourcePath, sourcePath, options)
  }

  private async installFromDir(dirPath: string, originalSource: string, options: InstallSkillOptions = {}): Promise<SkillEntry> {
    const validation = await this.validateSkillDir(dirPath)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const dirName = toSafeDirName(validation.name!)
    const source = options.source ?? 'user'
    const destPath = path.join(source === 'store' ? this.storeSkillsDir : this.skillsDir, dirName)

    if (existsSync(destPath)) {
      throw new Error(`Skill "${validation.name}" 已安装，如需更新请先卸载`)
    }

    await copyDirRecursive(dirPath, destPath)

    const installedAt = Date.now()
    const meta: SkillMeta = {
      installedAt,
      sourcePath: originalSource,
      enabled: options.enabled ?? true,
      ...(options.slug ? { slug: options.slug } : {}),
    }
    writeFileSync(
      path.join(destPath, '.skill_meta.json'),
      JSON.stringify(meta, null, 2),
    )

    const entry = await this.readEntry(destPath, dirName, source)
    if (!entry) {
      throw new Error(`Failed to read installed skill "${validation.name}"`)
    }

    return entry
  }

  /** 设置 skill 启用/禁用状态。禁用后不会被 agent 加载，但不会删除。 */
  async setSkillEnabled(name: string, enabled: boolean): Promise<void> {
    const match = await this.findManagedSkillByName(name)
    if (!match) {
      throw new Error(`Skill "${name}" 未安装`)
    }

    const meta = await this.readMeta(match.dirPath)
    meta.enabled = enabled
    writeFileSync(
      path.join(match.dirPath, '.skill_meta.json'),
      JSON.stringify(meta, null, 2),
    )

    if (match.source === 'store' && match.meta.slug) {
      void aiAgentSkillsApi.setUserSkillEnabled(match.meta.slug, enabled).catch((error: any) => {
        console.warn(`Failed to sync store skill "${match.meta.slug}" enabled state: ${error.message}`)
      })
    }
  }

  async uninstallSkill(name: string): Promise<void> {
    const dirName = toSafeDirName(name)

    if (this.isBuiltinSkill(dirName)) {
      throw new Error(`内置 Skill "${name}" 不能卸载`)
    }

    const match = await this.findManagedSkillByName(name)
    if (!match) {
      throw new Error(`Skill "${name}" 未安装`)
    }

    if (match.source === 'store' && match.meta.slug) {
      await aiAgentSkillsApi.removeInstalledSkill(match.meta.slug)
    }

    await rm(match.dirPath, { recursive: true, force: true })
  }

  /** 通过商城 slug 卸载本地 skill（本地目录名基于 SKILL.md 的 name，与 slug 不一定相同） */
  async uninstallSkillBySlug(slug: string): Promise<void> {
    const match = await this.findStoreSkillBySlug(slug)
    if (match) {
      await rm(match.dirPath, { recursive: true, force: true })
      return
    }
    throw new Error(`未找到 slug 为 "${slug}" 的本地 Skill`)
  }

  private async findStoreSkillBySlug(slug: string): Promise<{ dirName: string, dirPath: string } | null> {
    for (const dirName of this.listSubDirs(this.storeSkillsDir)) {
      const dirPath = path.join(this.storeSkillsDir, dirName)
      const meta = await this.readMeta(dirPath)
      if (meta.slug === slug) {
        return { dirName, dirPath }
      }
    }
    return null
  }

  private async listStoreSkillDirs(): Promise<Array<{ dirName: string, dirPath: string, meta: SkillMeta }>> {
    const dirs: Array<{ dirName: string, dirPath: string, meta: SkillMeta }> = []
    for (const dirName of this.listSubDirs(this.storeSkillsDir)) {
      const dirPath = path.join(this.storeSkillsDir, dirName)
      const meta = await this.readMeta(dirPath)
      dirs.push({ dirName, dirPath, meta })
    }
    return dirs
  }

  async installFromRemote(slug: string, enabled = true): Promise<SkillEntry> {
    const existing = await this.findStoreSkillBySlug(slug)
    if (existing) {
      await this.writeSkillMeta(existing.dirPath, { enabled, slug })
      const entry = await this.readEntry(existing.dirPath, existing.dirName, 'store')
      if (!entry) {
        throw new Error(`Failed to read installed skill "${slug}"`)
      }
      return entry
    }

    let tempDir: string | undefined
    try {
      const binary = await aiAgentSkillsApi.downloadSkill(slug)
      tempDir = path.join(os.tmpdir(), `roxy-store-skill-${Date.now()}`)
      await mkdir(tempDir, { recursive: true })
      const zipPath = path.join(tempDir, `${slug}.zip`)
      await writeFile(zipPath, Buffer.from(binary.data))

      return await this.installSkill(zipPath, { source: 'store', slug, enabled })
    }
    finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  }

  async syncSkills(userSkills?: UserSkill[]): Promise<void> {
    const remoteSkills = userSkills ?? await aiAgentSkillsApi.listUserSkills()
    const remoteBySlug = new Map(remoteSkills.map(skill => [skill.slug, skill]))

    for (const localSkill of await this.listStoreSkillDirs()) {
      if (!localSkill.meta.slug || !remoteBySlug.has(localSkill.meta.slug)) {
        await rm(localSkill.dirPath, { recursive: true, force: true })
      }
    }

    for (const skill of remoteSkills) {
      try {
        const enabled = isRemoteSkillEnabled(skill)
        const existing = await this.findStoreSkillBySlug(skill.slug)
        if (!existing) {
          await this.installFromRemote(skill.slug, enabled)
          continue
        }

        const meta = await this.readMeta(existing.dirPath)
        if (meta.enabled !== enabled || meta.slug !== skill.slug) {
          await this.writeSkillMeta(existing.dirPath, { enabled, slug: skill.slug })
        }
      }
      catch (error: any) {
        console.warn(`Failed to sync store skill "${skill.slug}": ${error.message}`)
      }
    }
  }

  isPathInsideSkillsRoot(targetPath: string): boolean {
    const normalizedPath = path.resolve(targetPath)
    return this.listSkillRoots().some(root => isPathInsideOrEqual(root, normalizedPath))
  }

  resolveSkillDirForPath(targetPath: string): string | null {
    const normalizedPath = path.resolve(targetPath)
    for (const root of this.listSkillRoots()) {
      if (!isPathInsideOrEqual(root, normalizedPath)) {
        continue
      }
      const relativePath = path.relative(root, normalizedPath)
      const dirName = relativePath.split(path.sep)[0]
      return dirName ? path.join(root, dirName) : null
    }
    return null
  }

  private listSkillRoots(): string[] {
    return [this.skillsDir, this.storeSkillsDir].map(dir => path.resolve(dir))
  }

  private listLoadableSkillDirs(): Array<{ dirPath: string, dirName: string, source: SkillSource }> {
    return [
      ...this.listSubDirs(this.skillsDir).map(dirName => ({
        dirName,
        dirPath: path.join(this.skillsDir, dirName),
        source: 'user' as const,
      })),
      ...this.listSubDirs(this.storeSkillsDir).map(dirName => ({
        dirName,
        dirPath: path.join(this.storeSkillsDir, dirName),
        source: 'store' as const,
      })),
    ]
  }

  private listManagedSkillDirs(): Array<{ dirPath: string, dirName: string, source: SkillSource }> {
    return this.listLoadableSkillDirs().filter(skill => !this.isBuiltinSkill(skill.dirName))
  }

  private async findManagedSkillByName(name: string): Promise<{ dirName: string, dirPath: string, source: SkillSource, meta: SkillMeta } | null> {
    const safeDirName = toSafeDirName(name)
    for (const skill of this.listManagedSkillDirs()) {
      if (skill.dirName === safeDirName) {
        const meta = await this.readMeta(skill.dirPath)
        return { ...skill, meta }
      }
    }

    for (const skill of this.listManagedSkillDirs()) {
      const entry = await this.readEntry(skill.dirPath, skill.dirName, skill.source)
      if (entry?.name === name) {
        const meta = await this.readMeta(skill.dirPath)
        return { ...skill, meta }
      }
    }

    return null
  }

  private async writeSkillMeta(dirPath: string, updates: SkillMeta): Promise<void> {
    const meta = await this.readMeta(dirPath)
    writeFileSync(
      path.join(dirPath, '.skill_meta.json'),
      JSON.stringify({ ...meta, ...updates }, null, 2),
    )
  }

  private migrateLegacyStoreSkills(): void {
    for (const dirName of this.listSubDirs(this.skillsDir)) {
      if (this.isBuiltinSkill(dirName)) {
        continue
      }

      const legacyPath = path.join(this.skillsDir, dirName)
      const metaPath = path.join(legacyPath, '.skill_meta.json')
      if (!existsSync(metaPath)) {
        continue
      }

      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as SkillMeta & { source?: SkillSource }
        if (meta.source !== 'store') {
          continue
        }

        const destPath = path.join(this.storeSkillsDir, dirName)
        if (existsSync(destPath)) {
          rmSync(legacyPath, { recursive: true, force: true })
          continue
        }

        renameSync(legacyPath, destPath)
        delete meta.source
        writeFileSync(metaPath.replace(legacyPath, destPath), JSON.stringify(meta, null, 2))
      }
      catch (error: any) {
        console.warn(`Failed to migrate legacy store skill "${dirName}": ${error.message}`)
      }
    }
  }
}

function isPathInside(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function isPathInsideOrEqual(parent: string, target: string): boolean {
  return parent === target || isPathInside(parent, target)
}

let _skillManager: SkillManager | null = null

export function getSkillManager(): SkillManager {
  if (!_skillManager) {
    _skillManager = new SkillManager(env.SKILLS_DIR)
  }
  return _skillManager
}
