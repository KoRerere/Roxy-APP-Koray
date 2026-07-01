import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'yaml'
import { normalizeDeclaredRuntimes, type SkillRuntimeDeclaration } from './runtime'

export const MAX_SKILL_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024

export interface SkillMetadataSummary {
  name: string
  description: string
  runtimes?: SkillRuntimeDeclaration[]
}

export type SkillMetadataLoadErrorCode =
  | 'missing-skill-md'
  | 'read-failed'
  | 'content-too-large'
  | 'missing-frontmatter'
  | 'invalid-yaml'
  | 'frontmatter-not-mapping'
  | 'missing-name'
  | 'missing-description'

export interface SkillMetadataParseSuccess {
  ok: true
  metadata: SkillMetadataSummary
  warnings: string[]
}

export interface SkillMetadataParseFailure {
  ok: false
  code: Exclude<SkillMetadataLoadErrorCode, 'missing-skill-md' | 'read-failed'>
  message: string
}

export type SkillMetadataParseResult =
  | SkillMetadataParseSuccess
  | SkillMetadataParseFailure

export interface SkillMetadataLoadSuccess {
  ok: true
  skillMdPath: string
  rootDir: string
  metadata: SkillMetadataSummary
  warnings: string[]
}

export interface SkillMetadataLoadFailure {
  ok: false
  code: SkillMetadataLoadErrorCode
  message: string
}

export type SkillMetadataLoadResult =
  | SkillMetadataLoadSuccess
  | SkillMetadataLoadFailure

export async function resolveSkillMdPath(dirPath: string): Promise<string | null> {
  const directPath = path.join(dirPath, 'SKILL.md')

  try {
    const stat = await fs.stat(directPath)
    if (stat.isFile()) {
      return directPath
    }
  }
  catch {
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const nestedDirs = entries.filter(entry => entry.isDirectory())

    if (nestedDirs.length !== 1) {
      return null
    }

    const nestedPath = path.join(dirPath, nestedDirs[0].name, 'SKILL.md')
    const stat = await fs.stat(nestedPath)
    return stat.isFile() ? nestedPath : null
  }
  catch {
    return null
  }
}

export function parseSkillMetadataFromContent(
  content: string,
  skillPath: string,
  directoryName: string,
): SkillMetadataParseResult {
  if (content.length > MAX_SKILL_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: 'content-too-large',
      message: `Skipping ${skillPath}: content too large (${content.length} bytes)`,
    }
  }

  const normalized = content.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!match) {
    return {
      ok: false,
      code: 'missing-frontmatter',
      message: `Skipping ${skillPath}: no valid YAML frontmatter found`,
    }
  }

  let frontmatterData: Record<string, unknown>
  try {
    frontmatterData = yaml.parse(match[1])
  }
  catch (error) {
    return {
      ok: false,
      code: 'invalid-yaml',
      message: `Invalid YAML in ${skillPath}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!frontmatterData || typeof frontmatterData !== 'object') {
    return {
      ok: false,
      code: 'frontmatter-not-mapping',
      message: `Skipping ${skillPath}: frontmatter is not a mapping`,
    }
  }

  const name = String(frontmatterData.name ?? '').trim()
  let description = String(frontmatterData.description ?? '').trim()

  if (!name) {
    return {
      ok: false,
      code: 'missing-name',
      message: `Skipping ${skillPath}: missing required 'name'`,
    }
  }

  if (!description) {
    return {
      ok: false,
      code: 'missing-description',
      message: `Skipping ${skillPath}: missing required 'description'`,
    }
  }

  const warnings: string[] = []
  const normalizedRuntimes = normalizeDeclaredRuntimes(frontmatterData.runtimes, skillPath)
  warnings.push(...normalizedRuntimes.warnings)

  if (name !== directoryName) {
    warnings.push(`Skill '${name}' in ${skillPath} does not match directory name '${directoryName}'`)
  }

  if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
    warnings.push(
      `Description exceeds ${MAX_SKILL_DESCRIPTION_LENGTH} characters in ${skillPath}, truncating`,
    )
    description = description.slice(0, MAX_SKILL_DESCRIPTION_LENGTH)
  }

  return {
    ok: true,
    metadata: {
      name,
      description,
      ...(normalizedRuntimes.runtimes ? { runtimes: normalizedRuntimes.runtimes } : {}),
    },
    warnings,
  }
}

export async function loadSkillMetadataFromDir(dirPath: string): Promise<SkillMetadataLoadResult> {
  const skillMdPath = await resolveSkillMdPath(dirPath)
  if (!skillMdPath) {
    return {
      ok: false,
      code: 'missing-skill-md',
      message: `Missing SKILL.md in ${dirPath}`,
    }
  }

  let content: string
  try {
    content = await fs.readFile(skillMdPath, 'utf8')
  }
  catch (error) {
    return {
      ok: false,
      code: 'read-failed',
      message: `Failed to read ${skillMdPath}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const parsed = parseSkillMetadataFromContent(
    content,
    skillMdPath,
    path.basename(path.dirname(skillMdPath)),
  )

  if (!parsed.ok) {
    return parsed
  }

  return {
    ok: true,
    skillMdPath,
    rootDir: path.dirname(skillMdPath),
    metadata: parsed.metadata,
    warnings: parsed.warnings,
  }
}
