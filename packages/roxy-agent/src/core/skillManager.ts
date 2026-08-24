import type { TemplateRefValue } from '@roxy/shared'
import type { SkillManifest } from 'roxy-agent-runtime'
import { isTemplateRef } from '@roxy/shared'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import {
  loadSkillMetadataFromDir,
  MAX_SKILL_FILE_SIZE_BYTES,
} from '@/core/skills/metadata'
import { agentPaths } from '@/core/storage/agentPaths'

export interface SkillEntry {
  name: string
  description: string
  ref?: TemplateRefValue
}

export type SkillSource = 'builtin' | 'installed' | 'user'

interface SkillMeta {
  source?: string
  slug?: string
  sha512?: string
  templateRef?: string
  installedAt?: number
  enabled?: boolean | 0 | 1
}

export interface LocalSkillRecord extends SkillEntry {
  dirPath: string
  rootDir: string
  bodyPath: string
  frontmatter: Record<string, unknown>
  source: SkillSource
  slug?: string
  sha512?: string
}

export interface TemplateSkillIdentity {
  templateRef: TemplateRefValue
  sha512?: string
  slug?: string
  packageName?: string
}

export interface ResolvedLocalSkillFile {
  entry: SkillEntry
  filePath: string
  relativePath: string
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function toSafeDirName(name: string): string {
  return name.trim().replace(/[^\w-]/g, '_').replace(/_+/g, '_')
}

function isPathInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return parent === target || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative))
}

function normalizeRelativeSkillFile(file: string): string {
  const normalizedInput = file.replace(/\\/g, '/')
  if (!normalizedInput || path.posix.isAbsolute(normalizedInput) || /^[a-z]:/i.test(normalizedInput)) {
    throw new Error('Skill file must be a non-empty relative path.')
  }

  const normalized = path.posix.normalize(normalizedInput).replace(/^\.\//, '')
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('Skill file must stay inside the Skill directory.')
  }

  return normalized
}

async function ensureNoSymlink(rootDir: string, candidate: string): Promise<void> {
  const relative = path.relative(rootDir, candidate)
  const segments = relative.split(path.sep).filter(Boolean)
  let current = rootDir

  for (const segment of segments) {
    current = path.join(current, segment)
    const stat = await lstat(current).catch(() => null)
    if (!stat) {
      throw new Error('Skill file was not found.')
    }
    if (stat.isSymbolicLink()) {
      throw new Error('Symbolic links are not allowed in Skills.')
    }
  }
}

async function copyDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error('Symbolic links are not allowed in Skills.')
    }
    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath)
      continue
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported Skill entry: ${entry.name}`)
    }

    const data = await readFile(sourcePath)
    await writeFile(targetPath, data, { flag: 'wx' })
  }
}

export class SkillManager {
  private readonly skillsDir: string
  private readonly installedSkillsDir: string
  private readonly builtinSkillsDir: string

  constructor(dirs: { skillsDir: string, installedSkillsDir: string, builtinSkillsDir: string }) {
    this.skillsDir = dirs.skillsDir
    this.installedSkillsDir = dirs.installedSkillsDir
    this.builtinSkillsDir = dirs.builtinSkillsDir

    mkdirSync(this.skillsDir, { recursive: true })
    mkdirSync(this.installedSkillsDir, { recursive: true })
    mkdirSync(this.builtinSkillsDir, { recursive: true })
  }

  async listAvailableSkills(): Promise<SkillEntry[]> {
    const records = await this.listAvailableSkillRecords()
    return records
      .map(({ name, description, ref }) => ({
        name,
        description,
        ...(ref ? { ref } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async listRuntimeSkillManifests(): Promise<SkillManifest[]> {
    const records = await this.listAvailableSkillRecords()
    return records
      .map((record): SkillManifest => ({
        name: record.name,
        description: record.description,
        sourcePath: record.rootDir,
        bodyPath: record.bodyPath,
        frontmatter: record.frontmatter,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.bodyPath.localeCompare(b.bodyPath))
  }

  async resolveAvailableSkillFile(
    name: string,
    file = 'SKILL.md',
  ): Promise<ResolvedLocalSkillFile | null> {
    const normalizedName = name.trim()
    if (!normalizedName) {
      return null
    }

    const matches = (await this.listAvailableSkillRecords()).filter(record =>
      record.name === normalizedName,
    )
    if (matches.length === 0) {
      return null
    }
    if (matches.length > 1) {
      throw new Error(`Skill name "${normalizedName}" is ambiguous.`)
    }

    const record = matches[0]!
    const relativePath = normalizeRelativeSkillFile(file)
    const filePath = path.resolve(record.rootDir, ...relativePath.split('/'))
    if (!isPathInsideOrEqual(record.rootDir, filePath)) {
      throw new Error('Skill file escapes the Skill directory.')
    }

    await ensureNoSymlink(record.rootDir, filePath)
    const stat = await lstat(filePath).catch(() => null)
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Skill file ${relativePath} was not found.`)
    }
    if (stat.size > MAX_SKILL_FILE_SIZE_BYTES) {
      throw new Error(`Skill file exceeds the ${MAX_SKILL_FILE_SIZE_BYTES} byte limit.`)
    }

    return {
      entry: {
        name: record.name,
        description: record.description,
        ...(record.ref ? { ref: record.ref } : {}),
      },
      filePath,
      relativePath,
    }
  }

  async findInstalledTemplateSkill(identity: TemplateSkillIdentity): Promise<LocalSkillRecord | null> {
    const records = await this.listSkillRecords('installed')

    return records.find((record) => {
      if (identity.slug && record.slug === identity.slug) {
        return true
      }
      if (identity.slug && record.slug) {
        return false
      }
      if (record.ref === identity.templateRef) {
        return true
      }

      return Boolean(identity.packageName && record.name === identity.packageName)
    }) ?? null
  }

  async refreshInstalledTemplateSkillMetadata(
    record: LocalSkillRecord,
    identity: TemplateSkillIdentity,
  ): Promise<LocalSkillRecord> {
    if (record.source !== 'installed') {
      throw new Error('Only installed Skills can receive template metadata.')
    }

    const current = await this.readMeta(record.dirPath)
    await this.writeTemplateMeta(record.dirPath, current, identity)

    const refreshed = await this.readRecord(record.dirPath, 'installed')
    if (!refreshed) {
      throw new Error(`Failed to refresh installed Skill "${record.name}".`)
    }

    return refreshed
  }

  async installTemplateSkillFromDir(
    sourceDir: string,
    identity: TemplateSkillIdentity,
  ): Promise<LocalSkillRecord> {
    const metadata = await loadSkillMetadataFromDir(sourceDir)
    if (!metadata.ok) {
      throw new Error(metadata.message)
    }

    const existing = await this.findInstalledTemplateSkill({
      ...identity,
      packageName: identity.packageName ?? metadata.metadata.name,
    })
    const dirName = existing ? path.basename(existing.dirPath) : toSafeDirName(identity.slug ?? metadata.metadata.name)
    if (!dirName) {
      throw new Error('Skill name cannot be converted to a local directory name.')
    }

    const targetDir = existing?.dirPath ?? path.join(this.installedSkillsDir, dirName)
    if (!existing && existsSync(targetDir)) {
      throw new Error(`Installed Skill directory "${dirName}" already exists with a different identity.`)
    }

    // Prepare and validate the complete replacement before touching the installed directory.
    const stagingDir = await mkdtemp(path.join(this.installedSkillsDir, `.${dirName}.install-`))
    const backupDir = `${stagingDir}.backup`
    let originalMoved = false
    let replacementMoved = false

    try {
      await copyDirectoryContents(sourceDir, stagingDir)
      const currentMeta = existing ? await this.readMeta(existing.dirPath) : {}
      await this.writeTemplateMeta(stagingDir, currentMeta, identity)

      const staged = await this.readRecord(stagingDir, 'installed')
      if (!staged) {
        throw new Error(`Failed to validate installed Skill "${metadata.metadata.name}".`)
      }

      if (existing) {
        await rename(targetDir, backupDir)
        originalMoved = true
      }

      await rename(stagingDir, targetDir)
      replacementMoved = true

      const installed = await this.readRecord(targetDir, 'installed')
      if (!installed) {
        throw new Error(`Failed to read installed Skill "${metadata.metadata.name}".`)
      }

      await rm(backupDir, { recursive: true, force: true }).catch(() => {})
      return installed
    }
    catch (error) {
      if (replacementMoved) {
        await rm(targetDir, { recursive: true, force: true }).catch(() => {})
      }
      if (originalMoved) {
        await rename(backupDir, targetDir)
      }

      throw error
    }
    finally {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
    }
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

  private listSkillRoots(): Array<{ rootDir: string, source: SkillSource }> {
    return [
      { rootDir: path.resolve(this.skillsDir), source: 'user' },
      { rootDir: path.resolve(this.installedSkillsDir), source: 'installed' },
      { rootDir: path.resolve(this.builtinSkillsDir), source: 'builtin' },
    ]
  }

  private async listAvailableSkillRecords(): Promise<LocalSkillRecord[]> {
    const records = await Promise.all(
      this.listSkillRoots().flatMap(({ rootDir, source }) =>
        this.listSubDirs(rootDir).map(dirName => this.readRecord(path.join(rootDir, dirName), source)),
      ),
    )

    return records.filter((record): record is LocalSkillRecord => record !== null)
  }

  private async listSkillRecords(source: SkillSource): Promise<LocalSkillRecord[]> {
    const root = this.listSkillRoots().find(item => item.source === source)
    if (!root) {
      return []
    }

    const records = await Promise.all(
      this.listSubDirs(root.rootDir).map(dirName => this.readRecord(path.join(root.rootDir, dirName), source, false)),
    )
    return records.filter((record): record is LocalSkillRecord => record !== null)
  }

  private async readRecord(
    dirPath: string,
    source: SkillSource,
    requireEnabled = true,
  ): Promise<LocalSkillRecord | null> {
    const metadata = await loadSkillMetadataFromDir(dirPath)
    if (!metadata.ok) {
      return null
    }

    const meta = await this.readMeta(dirPath)
    if (requireEnabled && (meta.enabled === false || meta.enabled === 0)) {
      return null
    }

    const ref = isTemplateRef(meta.templateRef) ? meta.templateRef : undefined
    const slug = readNonEmptyString(meta.slug)
    const sha512 = readNonEmptyString(meta.sha512)?.toLowerCase()
    return {
      name: metadata.metadata.name,
      description: metadata.metadata.description,
      ...(ref ? { ref } : {}),
      dirPath,
      rootDir: metadata.rootDir,
      bodyPath: metadata.skillMdPath,
      frontmatter: metadata.frontmatter,
      source,
      ...(slug ? { slug } : {}),
      ...(sha512 ? { sha512 } : {}),
    }
  }

  private async readMeta(dirPath: string): Promise<SkillMeta> {
    const metaPath = path.join(dirPath, '.skill_meta.json')
    if (!existsSync(metaPath)) {
      return {}
    }

    try {
      const parsed = JSON.parse(await readFile(metaPath, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as SkillMeta
        : {}
    }
    catch {
      return {}
    }
  }

  private async writeTemplateMeta(
    dirPath: string,
    current: SkillMeta,
    identity: TemplateSkillIdentity,
  ): Promise<void> {
    const meta: SkillMeta = {
      ...current,
      source: 'store',
      templateRef: identity.templateRef,
      installedAt: current.installedAt ?? Date.now(),
      enabled: true,
      ...(identity.sha512 ? { sha512: identity.sha512.toLowerCase() } : {}),
      ...(identity.slug ? { slug: identity.slug } : {}),
    }

    await writeFile(
      path.join(dirPath, '.skill_meta.json'),
      JSON.stringify(meta, null, 2),
    )
  }
}

let skillManager: SkillManager | null = null

export function getSkillManager(): SkillManager {
  if (!skillManager) {
    skillManager = new SkillManager({
      skillsDir: agentPaths.skillsUserDir,
      installedSkillsDir: agentPaths.skillsInstalledDir,
      builtinSkillsDir: agentPaths.skillsBuiltinDir,
    })
  }

  return skillManager
}
