import type { ContextData } from '../../database/context'
import type { BaseMessage, SystemMessage } from '@langchain/core/messages'
import type { StructuredTool } from '@langchain/core/tools'
import { allSkills } from '../skills'

/**
 * 将 message 转成文本格式。
 * @param messages
 * @returns
 */
export function messagesToText(messages: BaseMessage[]) {
  return messages.map((msg: any) => {
    const role = msg.type === 'human' ? 'User' : 'Assistant'
    let content = ''
    if (typeof msg.content === 'string') {
      content = msg.content
    }
    else if (Array.isArray(msg.content)) {
      // If content is array of content blocks, extract text
      content = msg.content
        .map((block: any) => typeof block === 'string' ? block : block.text || '')
        .join('')
    }
    else {
      content = String(msg.content || '')
    }
    return `${role}: ${content}`
  }).join('\n')
}

/**
 * 通过工具名称列表查找对应的工具
 * @param toolNames 工具名称数组
 * @param tools 所有可用工具列表
 * @returns 匹配的工具列表
 */
export function findMcpTool(toolNames: string[], tools: StructuredTool[]) {
  return tools.filter(tool => toolNames.includes(tool.name))
}

/**
 * 通过技能名称列表获取对应的工具
 * @param skillNames 技能名称数组
 * @param allTools 所有可用工具列表
 * @returns 匹配的工具列表
 */
export function findToolsBySkillNames(skillNames: string[], allTools: StructuredTool[]): StructuredTool[] {
  if (!skillNames || skillNames.length === 0) {
    return []
  }

  // 根据技能名称筛选出对应的技能
  const matchedSkills = allSkills.filter(skill => skillNames.includes(skill.name))

  // 从匹配的技能中提取所有工具名称
  const toolNames = matchedSkills
    .flatMap(skill => skill.allowTools || [])
    .filter((name, index, self) => self.indexOf(name) === index)

  // 根据工具名称查找对应的工具
  return findMcpTool(toolNames, allTools)
}

/**
 * 恢复历史上下文
 */
export function restoreHistoryContext(context: ContextData | null, systemMessage: SystemMessage, messages: any[], type: 'simple' | 'orchestrator') {
  // 第一次对话，还没有历史上下文
  if (!context) {
    return [systemMessage, ...messages]
  }

  const filterType = type === 'simple' ? 'orchestrator' : 'simple'
  const historyMessages = context.messages
    .filter((item: any) => item.name !== filterType)
    // 过滤掉所有system message，里面 content 值是一样的 messages。
    .filter((item: any) => item.content !== systemMessage.content)
  const newMessages = [systemMessage, ...historyMessages, ...messages]
  return newMessages
}

export function getReasoningContent(message: any) {
  const reasoning = message?.additional_kwargs?.reasoning
    || (message?.additional_kwargs as any)?.reasoning_content
    || (message as any).response_metadata?.reasoning
  return reasoning
}
