import type { SkillMetadataLoadErrorCode, SkillMetadataLoadFailure } from './skills/metadata'
import type { RuntimeAvailability, RuntimeCommandRunner, SkillRuntimeDescriptor, SkillRuntimeSource } from './skills/runtime'
import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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

export interface SkillEntry {
  name: string
  description: string
  dirName: string
  installedAt: number
  hasScripts: boolean
  runtimeSource: SkillRuntimeSource
  runtimes: Array<SkillRuntimeDescriptor & RuntimeAvailability>
  missingRuntimeIds: string[]
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

export class SkillManager {
  private readonly skillsDir: string
  private readonly builtinSkills: Set<string>
  private readonly runtimeCommandRunner?: RuntimeCommandRunner

  constructor(skillsDir: string, deps: SkillManagerDeps = {}) {
    this.skillsDir = path.join(skillsDir, 'skills')
    mkdirSync(this.skillsDir, { recursive: true })
    this.builtinSkills = new Set(['roxybrowser-openapi-skills', 'roxybrowser-playwright-skills'])
    this.runtimeCommandRunner = deps.runtimeCommandRunner
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

  async listSkills(): Promise<SkillEntry[]> {
    const runtimeAvailabilityCache = new Map<string, Promise<RuntimeAvailability>>()
    const results: SkillEntry[] = []
    for (const dirName of this.listSubDirs(this.skillsDir)) {
      if (this.isBuiltinSkill(dirName)) {
        continue
      }
      const entry = await this.readEntry(path.join(this.skillsDir, dirName), dirName, runtimeAvailabilityCache)
      if (entry) {
        results.push(entry)
      }
    }
    return results
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
    runtimeAvailabilityCache = new Map<string, Promise<RuntimeAvailability>>(),
  ): Promise<SkillEntry | null> {
    const result = await loadSkillMetadataFromDir(dirPath)
    if (!result.ok) {
      return null
    }

    let installedAt = 0
    const metaPath = path.join(dirPath, '.skill_meta.json')
    if (existsSync(metaPath)) {
      try {
        installedAt = JSON.parse(await readFile(metaPath, 'utf-8')).installedAt ?? 0
      }
      catch {
      }
    }

    return this.buildSkillEntry(result, dirName, installedAt, runtimeAvailabilityCache)
  }

  private async buildSkillEntry(
    metadataResult: Extract<Awaited<ReturnType<typeof loadSkillMetadataFromDir>>, { ok: true }>,
    dirName: string,
    installedAt: number,
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
      installedAt,
      hasScripts: runtimeDetection.hasScripts,
      runtimeSource: runtimeDetection.runtimeSource,
      runtimes,
      missingRuntimeIds: runtimes
        .filter(runtime => isSupportedRuntimeId(runtime.id) && !runtime.installed)
        .map(runtime => runtime.id),
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

  async installSkill(sourcePath: string): Promise<SkillEntry> {
    if (!existsSync(sourcePath)) {
      throw new Error(`路径不存在: ${sourcePath}`)
    }

    const isZip = sourcePath.toLowerCase().endsWith('.zip') && statSync(sourcePath).isFile()

    if (isZip) {
      let tempDir: string | undefined
      try {
        const extracted = await extractZipToTemp(sourcePath)
        tempDir = extracted.tempDir
        return await this.installFromDir(extracted.skillRootDir, sourcePath)
      }
      finally {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        }
      }
    }

    return this.installFromDir(sourcePath, sourcePath)
  }

  private async installFromDir(dirPath: string, originalSource: string): Promise<SkillEntry> {
    const validation = await this.validateSkillDir(dirPath)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const dirName = toSafeDirName(validation.name!)
    const destPath = path.join(this.skillsDir, dirName)

    if (existsSync(destPath)) {
      throw new Error(`Skill "${validation.name}" 已安装，如需更新请先卸载`)
    }

    await copyDirRecursive(dirPath, destPath)

    const installedAt = Date.now()
    writeFileSync(
      path.join(destPath, '.skill_meta.json'),
      JSON.stringify({ installedAt, sourcePath: originalSource }, null, 2),
    )

    const entry = await this.readEntry(destPath, dirName)
    if (!entry) {
      throw new Error(`Failed to read installed skill "${validation.name}"`)
    }

    return entry
  }

  async uninstallSkill(name: string): Promise<void> {
    const dirName = toSafeDirName(name)

    if (this.isBuiltinSkill(dirName)) {
      throw new Error(`内置 Skill "${name}" 不能卸载`)
    }

    const destPath = path.join(this.skillsDir, dirName)

    if (!existsSync(destPath)) {
      throw new Error(`Skill "${name}" 未安装`)
    }

    await rm(destPath, { recursive: true, force: true })
  }
}

let _skillManager: SkillManager | null = null

export function getSkillManager(): SkillManager {
  if (!_skillManager) {
    _skillManager = new SkillManager(env.SKILLS_DIR)
  }
  return _skillManager
}
