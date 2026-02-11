import type { AgentState } from '.'
import type { StructuredTool } from '@langchain/core/tools'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessage, AIMessageChunk, collapseToolCallChunks, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config'
import { ContextManager } from '../../database/context'
import { createLLM } from '../../llm'
import { mcpManager } from '../../mcpManager'
import { streamAdapter } from '../../server/streamAdapter'
import { loadSkill } from '../skills'
import { getTools } from '../tools'
import { findMcpTool, findToolsBySkillNames, getReasoningContent, restoreHistoryContext } from '../utils'
import { AbortError } from '../utils/abortRegistry'
import { HandleChunk } from '../utils/handleChunk'
// import { DebugLogger } from '../utils/logger'
import { TokenUsageChange } from '../utils/usageAggregator'
import { executePrompt } from './prompts'

// 工具调用的最大循环数
const MAX_TURNS = Math.max(1, env.MAX_TURNS)
let summaryPromise: Promise<any> | null = null

/**
 * Simple 模式
 */
export async function simple(state: typeof AgentState.State, config: LangGraphRunnableConfig) {
  // 初始化调试日志（使用 thread_id 作为文件名）
  const threadId = config.configurable?.thread_id || 'unknown'
  // await DebugLogger.initialize(threadId)

  if (summaryPromise) {
    // 必须等待上一次的记忆摘要总结完成后，才能继续执行
    await summaryPromise
    summaryPromise = null
  }

  const enableThinking = state.enableThinking || false
  const workerId = 'worker_simple'

  // 创建 UsageAggregator 实例，用于聚合 token usage
  // const usageAggregator = new UsageAggregator(config.writer)

  /**
   * 检查是否被中断
   */
  const checkAbort = () => {
    if (config.signal?.aborted) {
      throw new AbortError('User cancelled')
    }
  }

  const toolMessages: (ToolMessage | AIMessageChunk)[] = []

  // 声明 allowedTools，用于存储当前允许使用的工具
  const allowedTools: StructuredTool[] = []
  const context = ContextManager.getContext(threadId)
  const allowedSkills: string[] = context?.allowedSkills || []

  // 获取上一次的对话上下文（在 try 块外，以便后续使用）
  const historyMessages = restoreHistoryContext(context, new SystemMessage({ content: executePrompt, name: 'simple' }), state.messages, 'simple')
  const messages = historyMessages

  try {
    // 创建 MCP 客户端
    await mcpManager.createMcpClient(workerId)
    const llm = createLLM(enableThinking)
    if (!llm) {
      throw new Error('Failed to create LLM instance')
    }

    // 获取自定义工具和 MCP 工具，自定义工具放在前面以确保优先级
    const customTools = getTools() as StructuredTool[]
    const mcpTools = mcpManager.getToolsForWorker(workerId)
    // 合并工具列表
    const allTools: StructuredTool[] = [loadSkill, ...customTools, ...mcpTools]
    const _allowedTools = findToolsBySkillNames(allowedSkills, allTools)
    allowedTools.push(..._allowedTools)

    // 对于 Claude 模型，直接传递 StructuredTool 对象，让 LangChain 自动处理转换
    // 对于其他模型，使用 convertToolsToOpenRouterFormat 转换
    // const isClaudeModel = env.LLM_MODEL.toLowerCase().includes('claude')
    // const toolsForLLM = isClaudeModel ? tools : convertToolsToOpenRouterFormat(tools)

    // ===================== 工具执行阶段 =====================
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // 检查中断
      checkAbort()

      console.group(`Turn ${turn + 1}`)
      const allMessages = [...messages, ...toolMessages]
      const availableTools = [loadSkill, ...allowedTools]
      console.log('availableTools', availableTools)
      const stream = await llm.stream(allMessages, {
        tools: availableTools,
        callbacks: [new TokenUsageChange(config.configurable?.thread_id)],
        signal: config.signal, // 传递 abort signal
      })

      let aggregatedMsg = new AIMessageChunk({ content: '' })
      const contentId = uuidv4()
      const thinkingId = uuidv4()

      for await (const chunk of stream) {
        // 检查中断
        checkAbort()

        // 对于 ChatGenerationChunk，需要从 chunk.message 中提取
        aggregatedMsg = aggregatedMsg.concat(chunk)

        const content = HandleChunk.handleContent(chunk)
        if (content) {
          config.writer?.(streamAdapter.content(content, contentId))
        }
        else if (chunk.text) { // deepseek 兼容处理
          config.writer?.(streamAdapter.content(chunk.text, contentId))
        }

        // 检查 reasoning（备用方案）
        const reasoning = getReasoningContent(chunk)

        if (reasoning && enableThinking && reasoning.trim() !== '') {
          const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
          config.writer?.(streamAdapter.thinking(reasoningStr, thinkingId))
        }
      }

      // 对于 Claude 模型，工具调用可能存储在 tool_call_chunks 中，需要先聚合
      const toolCalls = aggregatedMsg.tool_calls
      console.log('aggregatedMsg', aggregatedMsg)

      // 添加 AI 回复到消息历史
      toolMessages.push(aggregatedMsg)

      if (!toolCalls || toolCalls.length <= 0) {
        console.groupEnd()
        break
      }

      // 处理工具调用
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name
        const toolArgs = toolCall.args
        const toolId = toolCall.id as string
        const tool = allTools.find(t => t.name === toolName)
        if (tool) {
          // 检查中断
          checkAbort()

          try {
            config.writer?.(streamAdapter.toolCall({
              toolName: tool.name,
              args: toolArgs,
              toolId,
            }))
            const startTime = Date.now()
            console.log('toolName', toolName)
            console.log('toolArgs', toolArgs)
            const result = await tool.invoke(toolArgs, { signal: config.signal })
            console.log('result', result)

            const endTime = Date.now()
            const executionTime = endTime - startTime
            config.writer?.(streamAdapter.toolResult({
              toolName: tool.name,
              result,
              toolId,
              et: executionTime,
              status: 'success',
            }))
            const toolData = {
              tool_call_id: toolId,
              name: toolName,
              status: 'success' as const,
              additional_kwargs: {
                reasoning_content: getReasoningContent(aggregatedMsg),
              },
            }
            if (toolName === 'load_skills') {
              toolMessages.push(new ToolMessage({
                ...toolData,
                content: result.map((skill: any) => skill.content).join('\n\n'),
              }))
              allowedSkills.push(...result.map((skill: any) => skill.name))
              allowedTools.push(...findMcpTool(result.map((skill: any) => skill.allowTools).flat(), allTools))
            }
            else {
              toolMessages.push(new ToolMessage({
                ...toolData,
                content: typeof result === 'string' ? result : JSON.stringify(result),
              }))
            }
          }
          catch (error: any) {
            console.error(`Tool ${toolName} execution error:`, error)
            config.writer?.(streamAdapter.toolResult({
              toolName: tool.name,
              result: error.message,
              toolId,
              status: 'failed',
            }))
            toolMessages.push(new ToolMessage({
              tool_call_id: toolId,
              content: `Error executing tool: ${error.message}`,
              name: toolName,
              status: 'error',
              additional_kwargs: {
                reasoning_content: getReasoningContent(aggregatedMsg),
              },
            }))
          }
        }
      }

      console.groupEnd()
    }
  }
  catch (error) {
    // 非中断事件的报错
    if (!AbortError.isAbortError(error)) {
      config.writer?.(streamAdapter.error(error instanceof Error ? error.message : String(error)))
      console.error('Simple error:', error)
    }
  }

  const allMessages = [...messages, ...toolMessages]

  summaryPromise = ContextManager.updateContext(
    allMessages,
    threadId,
    allowedSkills,
  )

  await mcpManager.destroyWorkerClient(workerId)

  // 关闭日志文件
  // await DebugLogger.close()
}
