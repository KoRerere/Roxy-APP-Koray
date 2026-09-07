import type { TemplateRefValue } from '@roxy/shared'
import type { Buffer } from 'node:buffer'
import type { ToolDefinition, ToolHandlerResult } from 'roxy-agent-runtime'
import { validateAgentComposerTemplatePrompt } from '@roxy/shared'
import AdmZip from 'adm-zip'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from 'roxy-agent-runtime'
import { z } from 'zod'
import { agentUserTemplatesApi } from '@/api/agentApiClient'
import { getSkillManager } from '@/core/skillManager'
import { loadSkillMetadataFromDir, MAX_SKILL_FILE_SIZE_BYTES } from '@/core/skills/metadata'

export const SAVE_USER_TEMPLATE_TOOL_NAME = 'roxy_save_user_template'

const MAX_ARCHIVE_FILE_COUNT = 2_000
const MAX_ARCHIVE_SIZE_BYTES = 50 * 1024 * 1024
const MAX_UNPACKED_SIZE_BYTES = 100 * 1024 * 1024

const saveUserTemplateInputSchema = z.strictObject({
  skillPath: z.string().trim().min(1).max(2_048),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1_024),
  prompt: z.string().trim().min(1).max(1000),
  sourceReportId: z.string().trim().min(1).max(256).optional(),
})

type SaveUserTemplateInput = z.infer<typeof saveUserTemplateInputSchema>

export interface SaveUserTemplateToolOptions {
  workspaceDir: string
}

interface SkillArchiveFile {
  relativePath: string
  data: Buffer
}

const savesInFlight = new Map<string, Promise<ToolHandlerResult>>()

function isPathInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return parent === target || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative))
}

function failure(message: string): ToolHandlerResult {
  return {
    content: [
      '## User template save failed',
      '',
      message,
      '',
      'Fix the issue and call roxy_save_user_template again.',
    ].join('\n'),
    isError: true,
  }
}

async function resolveSkillDirectory(workspaceDir: string, skillPath: string): Promise<string> {
  const workspaceRoot = await fs.realpath(path.resolve(workspaceDir)).catch(() => null)
  if (!workspaceRoot) {
    throw new Error('Current session workspace is unavailable.')
  }

  const candidate = path.resolve(workspaceRoot, skillPath)
  if (!isPathInsideOrEqual(workspaceRoot, candidate)) {
    throw new Error('Skill path must stay inside the current session workspace.')
  }

  const candidateStat = await fs.lstat(candidate).catch(() => null)
  if (!candidateStat?.isDirectory() || candidateStat.isSymbolicLink()) {
    throw new Error('Skill path must point to a regular directory inside the current session workspace.')
  }

  const resolved = await fs.realpath(candidate).catch(() => null)
  if (!resolved || !isPathInsideOrEqual(workspaceRoot, resolved)) {
    throw new Error('Skill path resolves outside the current session workspace.')
  }

  return resolved
}

async function collectSkillArchiveFiles(rootDir: string): Promise<SkillArchiveFile[]> {
  const files: SkillArchiveFile[] = []
  let totalBytes = 0

  async function walk(currentDir: string, relativeDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === '.DS_Store' || entry.name === '__MACOSX' || entry.name.startsWith('._')) {
        throw new Error(`Skill package contains an unsupported entry: ${entry.name}`)
      }

      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
      const absolutePath = path.join(currentDir, entry.name)
      const stat = await fs.lstat(absolutePath)
      if (stat.isSymbolicLink()) {
        throw new Error('Skill package cannot contain symbolic links.')
      }

      if (stat.isDirectory()) {
        await walk(absolutePath, relativePath)
        continue
      }
      if (!stat.isFile()) {
        throw new Error(`Skill package contains an unsupported entry: ${relativePath}`)
      }
      if (stat.size > MAX_SKILL_FILE_SIZE_BYTES) {
        throw new Error(`Skill file exceeds the ${MAX_SKILL_FILE_SIZE_BYTES} byte limit: ${relativePath}`)
      }

      totalBytes += stat.size
      if (totalBytes > MAX_UNPACKED_SIZE_BYTES) {
        throw new Error('Skill package exceeds the uncompressed size limit.')
      }
      if (files.length >= MAX_ARCHIVE_FILE_COUNT) {
        throw new Error('Skill package exceeds the file count limit.')
      }

      files.push({ relativePath, data: await fs.readFile(absolutePath) })
    }
  }

  await walk(rootDir, '')
  if (files.length === 0) {
    throw new Error('Skill package cannot be empty.')
  }
  return files
}

async function createSkillArchive(skillDir: string): Promise<{ archive: Buffer, packageName: string, packageDescription: string }> {
  const skillMdStat = await fs.lstat(path.join(skillDir, 'SKILL.md')).catch(() => null)
  if (!skillMdStat?.isFile() || skillMdStat.isSymbolicLink()) {
    throw new Error('Skill directory must contain a regular SKILL.md file at its root.')
  }

  const metadata = await loadSkillMetadataFromDir(skillDir)
  if (!metadata.ok || path.resolve(metadata.rootDir) !== path.resolve(skillDir)) {
    throw new Error(metadata.ok ? 'Skill directory must use a root SKILL.md file.' : metadata.message)
  }

  const archive = new AdmZip()
  for (const file of await collectSkillArchiveFiles(skillDir)) {
    archive.addFile(file.relativePath, file.data)
  }
  const data = archive.toBuffer()
  if (data.byteLength > MAX_ARCHIVE_SIZE_BYTES) {
    throw new Error('Skill ZIP exceeds the compressed size limit.')
  }

  return {
    archive: data,
    packageName: metadata.metadata.name,
    packageDescription: metadata.metadata.description,
  }
}

async function saveUserTemplate(
  options: SaveUserTemplateToolOptions,
  input: SaveUserTemplateInput,
): Promise<ToolHandlerResult> {
  const promptValidation = validateAgentComposerTemplatePrompt(input.prompt)
  if (!promptValidation.valid) {
    return failure(`Composer prompt validation failed: ${promptValidation.issues.join(' ')}`)
  }

  try {
    const skillDir = await resolveSkillDirectory(options.workspaceDir, input.skillPath)
    const packageInfo = await createSkillArchive(skillDir)
    const archiveFile = new File([packageInfo.archive], `${packageInfo.packageName}.zip`, {
      type: 'application/zip',
    })
    const asset = await agentUserTemplatesApi.uploadSkill(archiveFile)
    const metadata = {
      version: 1,
      prompt: input.prompt,
      ...(input.sourceReportId ? { sourceReportId: input.sourceReportId } : {}),
      fileId: asset.fileId,
      ossUrl: asset.ossUrl,
      sha512: asset.sha512,
      ...(asset.packageSlug ? { packageSlug: asset.packageSlug } : {}),
      ...(asset.packageName ? { packageName: asset.packageName } : {}),
      ...(asset.packageDescription ? { packageDescription: asset.packageDescription } : {}),
      ...(asset.skillMdPath ? { skillMdPath: asset.skillMdPath } : { skillMdPath: 'SKILL.md' }),
      skillMetadata: asset.skillMetadata ?? {},
    }
    const template = await agentUserTemplatesApi.create({
      template_type: 'skill',
      name: input.name,
      description: input.description,
      metadata,
    })
    const templateRef = `user:${template.id}` as TemplateRefValue
    const installed = await getSkillManager().installTemplateSkillFromDir(skillDir, {
      templateRef,
      sha512: asset.sha512,
      slug: asset.packageSlug ?? `user-template-${template.id}`,
      packageName: asset.packageName ?? packageInfo.packageName,
    })

    return {
      content: [
        '## User template saved',
        '',
        `- template: ${templateRef}`,
        `- name: ${template.name}`,
        `- installed skill: ${installed.name}`,
      ].join('\n'),
      isError: false,
    }
  }
  catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

/** Upload a generated Skill and persist the separate Composer prompt metadata. */
export function createSaveUserTemplateTool(options: SaveUserTemplateToolOptions): ToolDefinition {
  return defineTool({
    name: SAVE_USER_TEMPLATE_TOOL_NAME,
    description: [
      'Upload a generated Skill package and save it as a reusable user template.',
      'The companion prompt is stored separately for the Agent Console Composer and must remain independent of browser windows.',
      'Do not include profile Composer tokens or concrete dirIds; the user selects windows when using the template.',
      'Every input, textarea, and URL Composer parameter must have a non-empty value before saving.',
      'Only call this after the Skill directory and companion prompt have been validated.',
    ].join(' '),
    inputSchema: saveUserTemplateInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const dedupeKey = input.sourceReportId
        ? `${path.resolve(options.workspaceDir)}:${input.sourceReportId}`
        : undefined
      if (!dedupeKey) {
        return saveUserTemplate(options, input)
      }

      const pending = savesInFlight.get(dedupeKey)
      if (pending) {
        return pending
      }

      const request = saveUserTemplate(options, input)
      savesInFlight.set(dedupeKey, request)
      try {
        return await request
      }
      finally {
        if (savesInFlight.get(dedupeKey) === request) {
          savesInFlight.delete(dedupeKey)
        }
      }
    },
  })
}
