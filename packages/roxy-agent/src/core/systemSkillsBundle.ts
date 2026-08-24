import AdmZip from 'adm-zip'
import { Buffer } from 'node:buffer'
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SYSTEM_SKILLS_BUNDLE_VERSION = 2
const SYSTEM_SKILLS_MARKER = '.system-skills-bundle.json'

interface SystemSkillsBundleMarker {
  version: number
  sha512: string
}

function isArchiveSymlink(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') {
    return false
  }

  const header = (entry as { header?: unknown }).header
  if (!header || typeof header !== 'object') {
    return false
  }

  const attr = (header as { attr?: unknown }).attr
  if (typeof attr !== 'number') {
    return false
  }

  const unixMode = (attr >>> 16) & 0xFFFF
  return (unixMode & 0o170000) === 0o120000
}

function normalizeArchiveEntryPath(entryName: string): string {
  const normalizedInput = entryName.replace(/\\/g, '/')
  if (!normalizedInput || path.posix.isAbsolute(normalizedInput) || /^[a-z]:/i.test(normalizedInput)) {
    throw new Error('System Skills archive contains an invalid Skill archive path.')
  }

  const normalized = path.posix.normalize(normalizedInput).replace(/^\.\//, '')
  if (
    !normalized
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
  ) {
    throw new Error('System Skills archive contains an invalid Skill archive path.')
  }

  return normalized
}

function isPathInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return parent === target || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative))
}

async function pathExists(target: string): Promise<boolean> {
  return lstat(target).then(() => true, () => false)
}

async function readMarker(targetDir: string): Promise<SystemSkillsBundleMarker | null> {
  try {
    const parsed = JSON.parse(await readFile(path.join(targetDir, SYSTEM_SKILLS_MARKER), 'utf8')) as Partial<SystemSkillsBundleMarker>
    if (
      parsed.version !== SYSTEM_SKILLS_BUNDLE_VERSION
      || typeof parsed.sha512 !== 'string'
      || !parsed.sha512
    ) {
      return null
    }
    return {
      version: parsed.version,
      sha512: parsed.sha512,
    }
  }
  catch {
    return null
  }
}

async function extractArchive(archive: Buffer, targetDir: string): Promise<void> {
  let zip: AdmZip
  try {
    zip = new AdmZip(archive)
  }
  catch (error) {
    throw new Error(
      `System Skills archive is not a valid ZIP: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const entries = zip.getEntries()
  if (entries.length === 0) {
    throw new Error('System Skills archive is empty.')
  }

  let extractedFileCount = 0
  for (const entry of entries) {
    if (isArchiveSymlink(entry)) {
      throw new Error('System Skills archive cannot contain symbolic links.')
    }

    const relativePath = normalizeArchiveEntryPath(entry.entryName)
    const destination = path.resolve(targetDir, ...relativePath.split('/'))
    if (!isPathInsideOrEqual(path.resolve(targetDir), destination)) {
      throw new Error('System Skills archive contains an invalid Skill archive path.')
    }

    if (entry.isDirectory) {
      await mkdir(destination, { recursive: true })
      continue
    }

    const fileData = entry.getData()
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, fileData, { flag: 'wx' })
    extractedFileCount += 1
  }

  if (extractedFileCount === 0) {
    throw new Error('System Skills archive does not contain files.')
  }
}

/**
 * Restore the Vite-embedded system Skills archive into the normal builtin
 * Skill root. The marker makes startup idempotent, while staging and rename
 * keep a previous valid bundle available if extraction fails.
 */
export async function restoreSystemSkillsBundle(
  archiveData: Buffer | Uint8Array | string,
  targetDir: string,
  sha512: string,
): Promise<void> {
  const archive = typeof archiveData === 'string'
    ? Buffer.from(archiveData, 'base64')
    : Buffer.from(archiveData)
  const resolvedTargetDir = path.resolve(targetDir)
  const targetParent = path.dirname(resolvedTargetDir)

  const currentTargetStat = await lstat(resolvedTargetDir).catch(() => null)
  if (currentTargetStat?.isSymbolicLink()) {
    throw new Error('System Skills builtin directory cannot be a symbolic link.')
  }

  const currentMarker = await readMarker(resolvedTargetDir)
  if (currentMarker?.sha512 === sha512) {
    return
  }

  await mkdir(targetParent, { recursive: true })
  const stagingDir = await mkdtemp(path.join(targetParent, '.system-skills-install-'))
  const backupDir = `${resolvedTargetDir}.backup-${process.pid}-${Date.now()}`
  let originalMoved = false
  let replacementMoved = false

  try {
    await extractArchive(archive, stagingDir)
    await writeFile(
      path.join(stagingDir, SYSTEM_SKILLS_MARKER),
      JSON.stringify({
        version: SYSTEM_SKILLS_BUNDLE_VERSION,
        sha512,
      } satisfies SystemSkillsBundleMarker, null, 2),
    )

    if (await pathExists(resolvedTargetDir)) {
      await rename(resolvedTargetDir, backupDir)
      originalMoved = true
    }

    await rename(stagingDir, resolvedTargetDir)
    replacementMoved = true

    if (originalMoved) {
      await rm(backupDir, { recursive: true, force: true })
    }
  }
  catch (error) {
    if (replacementMoved) {
      await rm(resolvedTargetDir, { recursive: true, force: true }).catch(() => {})
    }
    if (originalMoved) {
      await rename(backupDir, resolvedTargetDir).catch(() => {})
    }
    throw error
  }
  finally {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
    if (!replacementMoved && !originalMoved) {
      await rm(backupDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
