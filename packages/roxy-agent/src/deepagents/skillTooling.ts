import type { SkillEntry } from '../skillManager'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { createMiddleware, tool } from 'langchain'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { env } from '../config'
import { getSkillManager } from '../skillManager'
import {
  loadSkillMetadataFromDir,
  MAX_SKILL_FILE_SIZE_BYTES,
} from '../skills/metadata'

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

function buildSkillsSystemPrompt(skills: SkillSummary[]): string {
  if (env.SYSTEM_LANGUAGE === 'zh-CN') {
    const list = skills.length
      ? skills.map(skill => `- **${skill.name}**: ${skill.description}\n  - SKILL.md: \`${skill.skillMdPath}\``).join('\n')
      : '(当前没有可用 skills)'

    return `
## Skills System

你有一组本地 skills 可用。读取 skills 时不要使用 \`read_file\`，请使用专用工具 \`load_skill_file\`。
可用 skills：
${list}

规则：
1. 当任务命中某个 skill 时，先读它的 \`SKILL.md\`
2. 读取 skill 文件时使用 \`load_skill_file(path, offset, limit)\`
3. 如果 \`SKILL.md\` 提到 \`guides/\`、\`examples/\`、脚本或配置文件，继续用 \`load_skill_file\` 读取
4. \`load_skill_file\` 只能读取 skills 目录内的文件，传入上面展示的绝对路径
5. 普通业务文件不要用 \`load_skill_file\` 读取，那仍然属于普通文件访问
6. 如果 \`load_skill_file\` 返回不存在、被禁用等状态，不要尝试使用其他方式加载，直接当作该 skill 不可用处理

建议：
- 先读 \`SKILL.md\`，再决定是否继续读子文件
- 对大文件使用分页，例如 \`limit=${DEFAULT_SKILL_READ_LINE_LIMIT}\`
`
  }

  const list = skills.length
    ? skills.map(skill => `- **${skill.name}**: ${skill.description}\n  - SKILL.md: \`${skill.skillMdPath}\``).join('\n')
    : '(No skills available right now)'

  return `
## Skills System

You have a local skills library available. Do not use \`read_file\` for skills; use the dedicated \`load_skill_file\` tool.

Available skills:
${list}

Rules:
1. When a skill matches the task, read its \`SKILL.md\` first
2. Use \`load_skill_file(path, offset, limit)\` to read skill files
3. If \`SKILL.md\` references \`guides/\`, \`examples/\`, scripts, or config files, keep using \`load_skill_file\`
4. \`load_skill_file\` only works for files inside the skills directory, so pass the absolute paths shown above
5. Do not use \`load_skill_file\` for regular workspace files; normal file access still uses the standard filesystem tools
6. If \`load_skill_file\` returns not found, disabled, or similar status, do not attempt to load it through other means; treat it as the skill being unavailable

Tips:
- Start with \`SKILL.md\`, then read sub-files only if needed
- Use pagination for large files, for example \`limit=${DEFAULT_SKILL_READ_LINE_LIMIT}\`
`
}

export function createRoxySkillsMiddleware() {
  let cachedPrompt = ''
  let syncPromise: Promise<void> | null = null

  async function syncStoreSkillsOnce() {
    if (!syncPromise) {
      syncPromise = getSkillManager().syncSkills().catch((error: any) => {
        console.warn(`Failed to sync store skills: ${error.message}`)
      })
    }
    await syncPromise
  }

  return createMiddleware({
    name: 'RoxySkillsMiddleware',
    beforeAgent: async () => {
      await syncStoreSkillsOnce()
      const skills = await listInstalledSkills()
      cachedPrompt = buildSkillsSystemPrompt(skills)
    },
    wrapModelCall: async (request: any, handler: any) => {
      if (!cachedPrompt) {
        await syncStoreSkillsOnce()
        const skills = await listInstalledSkills()
        cachedPrompt = buildSkillsSystemPrompt(skills)
      }

      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(cachedPrompt),
      })
    },
  })
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
