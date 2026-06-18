import { createMiddleware } from 'langchain'
import { env } from '@/config'
import { getSkillManager } from '@/core/skillManager'
import { listInstalledSkills } from '../tools/skill'

const DEFAULT_SKILL_READ_LINE_LIMIT = 1000

function buildSkillsSystemPrompt(skills: Awaited<ReturnType<typeof listInstalledSkills>>): string {
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

/**
 * 在每次模型调用前动态注入已安装 skills 列表的 System Prompt 片段。
 * 首次调用时触发一次 skills store 同步（后续共享同一 Promise 避免重复同步）。
 */
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
