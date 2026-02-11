import { DynamicStructuredTool } from '@langchain/core/tools'
import * as z from 'zod'
import { fileSystemSkills } from './file-system-skill'
import { openapiMcpSkills } from './openapi-mcp-skill'
import { playwrightMcpSkills } from './playwright-mcp-skill'
import { twoFactorSkills } from './two-factor-skill'

export const allSkills = [...openapiMcpSkills, ...playwrightMcpSkills, ...fileSystemSkills, ...twoFactorSkills]

export const loadSkill = new DynamicStructuredTool({
  name: 'load_skills',
  description: `Load the full content of a skill into the agent's context when detailed instructions are needed.`,
  schema: z.object({
    skillNames: z
      .array(z.string())
      .describe('要加载的技能名称列表'),
  }),
  func: async ({ skillNames }: { skillNames: string[] }) => {
    return allSkills.filter(skill => skillNames.includes(skill.name))
  },
})

export function getSkillsDescription(skills: any[]) {
  return [
    '# 你有一组 skills（这里只给目录）：',
    ...skills.map(skill => `- ${skill.name}: ${skill.description}`),
    '硬规则：开始执行前先用 load_skill 加载需要的技能全文；执行过程中如果发现缺技能，也可以再 load_skill 增量加载。',
    '这些技能下包含着具体的工具，你可以根据需要选择使用，请勿直接使用工具名称，而是使用 load_skill 加载技能全文后，再使用技能中的工具。',
  ].join('\n')
}
