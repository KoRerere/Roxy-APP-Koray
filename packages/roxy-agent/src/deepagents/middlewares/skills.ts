import type { SkillEntry } from '@/core/skillManager'
import { createMiddleware } from 'langchain'
import { env } from '@/config'
import { listAvailableLocalSkills } from '../tools/skill'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatSkillEntry(skill: SkillEntry): string {
  const name = escapeXml(skill.name)
  const description = escapeXml(skill.description)

  if (skill.ref) {
    return `  <skill>
    <name>${name}</name>
    <description>${description}</description>
    <ref>${escapeXml(skill.ref)}</ref>
  </skill>`
  }

  return `  <skill>
    <name>${name}</name>
    <description>${description}</description>
  </skill>`
}

function formatAvailableSkills(skills: SkillEntry[]): string {
  const entries = skills.map(formatSkillEntry).join('\n')

  if (!entries) {
    return `<available-skills>
</available-skills>`
  }

  return `<available-skills>
${entries}
</available-skills>`
}

export function buildSkillsSystemPrompt(skills: SkillEntry[]): string {
  const availableSkills = formatAvailableSkills(skills)

  if (env.SYSTEM_LANGUAGE === 'zh-CN') {
    return `
## Skills

下方包含了当前可用的所有 Skill 的渐进式披露信息。信息中包含的字段说明如下：
- \`name\`: Skill 名称。
- \`description\`: Skill 的用途说明。
- \`ref\`: 官方或用户 Skill 模板的 canonical 引用；存在时可替代 \`name\` 标识同一个 Skill。

${availableSkills}
`
  }

  return `
## Skills

The following entries contains all available skills. Entry parameter description are as follows:
- \`name\`: The skill name.
- \`description\`: A brief description of what the skill is for.
- \`ref\`: The canonical reference for an official or user skill template; when present, it can identify the same skill instead of \`name\`.

${availableSkills}
`
}

/**
 * 在每次模型调用前动态注入本地可用 skills 列表的 System Prompt 片段。
 */
export function createRoxySkillsMiddleware() {
  let cachedPrompt = ''

  return createMiddleware({
    name: 'RoxySkillsMiddleware',
    beforeAgent: async () => {
      const skills = await listAvailableLocalSkills()
      cachedPrompt = buildSkillsSystemPrompt(skills)
    },
    wrapModelCall: async (request: any, handler: any) => {
      if (!cachedPrompt) {
        const skills = await listAvailableLocalSkills()
        cachedPrompt = buildSkillsSystemPrompt(skills)
      }

      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(cachedPrompt),
      })
    },
  })
}
