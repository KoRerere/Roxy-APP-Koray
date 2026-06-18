import type { SkillEntry } from '@/core/skillManager'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { getSkillManager } from '@/core/skillManager'
import {
  loadSkillMetadataFromDir,
  MAX_SKILL_FILE_SIZE_BYTES,
} from '@/skills/metadata'

const DEFAULT_SKILL_READ_LINE_LIMIT = 1000

interface SkillSummary {
  name: string
  description: string
  skillMdPath: string
  rootDir: string
}

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

function isPathInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return parent === target || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative))
}

function toSkillSummary(entry: SkillEntry): SkillSummary {
  return {
    name: entry.name,
    description: entry.description,
    skillMdPath: path.join(entry.rootDir, 'SKILL.md'),
    rootDir: entry.rootDir,
  }
}

export async function listInstalledSkills(): Promise<SkillSummary[]> {
  return (await getSkillManager().listAvailableSkills()).map(toSkillSummary)
}

/**
 * 从 skills 目录内的文件路径同步解析出 skill 名（目录名），用于前端展示。
 * 读 SKILL.md 与 skill 内子文件都解析到同一 skill 目录，故显示同名。
 * 同步实现，可安全用于流式事件热路径（不读 SKILL.md frontmatter）。
 */
export function resolveSkillNameFromPath(p: string): string | undefined {
  const dir = getSkillManager().resolveSkillDirForPath(path.resolve(p))
  return dir ? path.basename(dir) : undefined
}

export const loadSkillFileTools = [
  tool(
    async (input: { path: string, offset?: number, limit?: number }): Promise<string> => {
      const requestedPath = path.resolve(input.path)
      if (!getSkillManager().isPathInsideSkillsRoot(requestedPath)) {
        return `Error: Path '${input.path}' is outside the skills directory`
      }

      // 检查该 skill 是否被禁用
      const skillDir = getSkillManager().resolveSkillDirForPath(requestedPath)
      if (skillDir) {
        const skills = await getSkillManager().listAvailableSkills()
        if (!skills.some(skill => isPathInsideOrEqual(skillDir, skill.rootDir))) {
          const skillMetadata = await loadSkillMetadataFromDir(skillDir)
          const skillName = skillMetadata.ok ? skillMetadata.metadata.name : path.basename(skillDir)
          return `Error: Skill "${skillName}" not found.`
        }
      }

      try {
        const stat = await fs.lstat(requestedPath)
        if (stat.isSymbolicLink()) {
          return `Error: Symlinks are not allowed: ${input.path}`
        }
        if (!stat.isFile()) {
          return `Error: File '${input.path}' not found`
        }
        if (stat.size > MAX_SKILL_FILE_SIZE_BYTES) {
          return `Error: Skill file '${input.path}' exceeds the ${MAX_SKILL_FILE_SIZE_BYTES} byte limit`
        }

        const content = await fs.readFile(requestedPath, 'utf8')
        return formatNumberedTextSlice(content, input.offset, input.limit)
      }
      catch (error: any) {
        return `Error reading skill file '${input.path}': ${error.message}`
      }
    },
    {
      name: 'load_skill_file',
      description: 'Read a file from the installed skills library without human approval. Only files inside the configured skills directory are allowed.',
      schema: z.object({
        path: z.string().describe('Absolute path to a file inside the skills directory'),
        offset: z.number().int().min(0).optional().describe('0-based line offset to start reading from'),
        limit: z.number().int().min(1).max(DEFAULT_SKILL_READ_LINE_LIMIT).optional().describe(`Maximum number of lines to read (default ${DEFAULT_SKILL_READ_LINE_LIMIT})`),
      }),
    },
  ) as unknown as StructuredToolInterface,
]
