import type { StructuredToolInterface } from '@langchain/core/tools'
import type { TemplateRefValue } from '@roxy/shared'
import { isTemplateRef } from '@roxy/shared'
import { tool } from 'langchain'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { getSkillManager } from '@/core/skillManager'
import {
  getKnownTemplateSkill,
  resolveTemplateSkillFile,
  TemplateReferenceError,
} from '@/services/templateService'

const DEFAULT_SKILL_FILE = 'SKILL.md'
const DEFAULT_SKILL_READ_LINE_LIMIT = 1000

function formatNumberedTextSlice(content: string, offset = 0, limit = DEFAULT_SKILL_READ_LINE_LIMIT): string {
  const lines = content.split(/\r?\n/)
  const start = Math.max(0, offset)
  const end = Math.min(lines.length, start + Math.max(1, limit))

  if (start >= lines.length) {
    return `Error: Line offset ${offset} exceeds file length (${lines.length} lines)`
  }

  return lines
    .slice(start, end)
    .map((line, index) => `${String(start + index + 1).padStart(6)}\t${line}`)
    .join('\n')
}

export async function listAvailableLocalSkills() {
  return getSkillManager().listAvailableSkills()
}

export function resolveSkillDisplay(
  input: { name?: string, ref?: string, file?: string },
): { skillName: string, skillFilePath: string } {
  const knownSkill = input.ref && isTemplateRef(input.ref)
    ? getKnownTemplateSkill(input.ref)
    : undefined
  const skillName = knownSkill?.name ?? input.name ?? input.ref ?? 'Skill'
  const relativeFile = (input.file ?? DEFAULT_SKILL_FILE)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '') || DEFAULT_SKILL_FILE

  return {
    skillName,
    skillFilePath: `${skillName}/${relativeFile}`,
  }
}

function isRelativeSkillFile(file: string): boolean {
  const normalizedInput = file.replace(/\\/g, '/')
  if (path.posix.isAbsolute(normalizedInput) || /^[a-z]:/i.test(normalizedInput)) {
    return false
  }

  const normalized = path.posix.normalize(normalizedInput).replace(/^\.\//, '')
  return normalized !== '.'
    && normalized !== '..'
    && !normalized.startsWith('../')
    && !normalized.includes('/../')
}

const loadSkillFileSchema = z.object({
  name: z.string().trim().min(1).optional().describe('Exact SKILL.md frontmatter name of an available local Skill'),
  ref: z.string().refine(isTemplateRef, {
    message: 'Expected official:<positive id> or user:<positive id>.',
  }).optional().describe('Canonical official:<id> or user:<id> Skill template reference'),
  file: z.string().trim().min(1).refine(isRelativeSkillFile, {
    message: 'Skill file must be a relative path inside the Skill root.',
  }).optional().describe(`Relative file path inside the Skill (default ${DEFAULT_SKILL_FILE})`),
  offset: z.number().int().min(0).optional().describe('0-based line offset to start reading from'),
  limit: z.number().int().min(1).max(DEFAULT_SKILL_READ_LINE_LIMIT).optional().describe(`Maximum number of lines to read (default ${DEFAULT_SKILL_READ_LINE_LIMIT})`),
}).strict().superRefine((input, context) => {
  if (Boolean(input.name) === Boolean(input.ref)) {
    context.addIssue({
      code: 'custom',
      message: 'Provide exactly one of name or ref.',
      path: ['name'],
    })
  }
})

type SkillFileInput = z.infer<typeof loadSkillFileSchema>

async function resolveSkillFile(input: SkillFileInput): Promise<{ filePath: string }> {
  const file = input.file ?? DEFAULT_SKILL_FILE
  if (input.ref) {
    return resolveTemplateSkillFile(input.ref as TemplateRefValue, file)
  }

  const name = input.name
  if (!name) {
    throw new Error('Exactly one of Skill name or ref is required.')
  }

  const resolved = await getSkillManager().resolveAvailableSkillFile(name, file)
  if (!resolved) {
    throw new Error(`Skill "${name}" not found.`)
  }

  return resolved
}

async function readSkillFile(input: SkillFileInput): Promise<string> {
  try {
    const resolved = await resolveSkillFile(input)
    const content = await fs.readFile(resolved.filePath, 'utf8')
    return formatNumberedTextSlice(content, input.offset, input.limit)
  }
  catch (error) {
    if (error instanceof TemplateReferenceError) {
      return `Error [${error.code}]: ${error.message}`
    }

    return `Error reading Skill file: ${error instanceof Error ? error.message : String(error)}`
  }
}

export const loadSkillFileTools = [
  tool(
    readSkillFile,
    {
      name: 'load_skill_file',
      description: 'Read a Skill file using exactly one identifier: name for an available local Skill, or ref for a canonical Skill template. The file path is relative to the resolved Skill root and defaults to SKILL.md. A ref is resolved, downloaded when needed, and installed locally before reading.',
      schema: loadSkillFileSchema,
    },
  ) as unknown as StructuredToolInterface,
]
