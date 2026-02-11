import type { AgentState } from './state'
import type { StructuredTool } from '@langchain/core/tools'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessageChunk, collapseToolCallChunks, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { END } from '@langchain/langgraph'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config'
import { ContextManager } from '../../database/context'
import { createLLM } from '../../llm'
import { mcpManager } from '../../mcpManager'
import { streamAdapter } from '../../server/streamAdapter'
import { loadSkill } from '../skills'
import { getTools } from '../tools'
import { orchestratorTools } from '../tools/orchestrator'
import { findMcpTool, findToolsBySkillNames, restoreHistoryContext } from '../utils'
import { AbortError } from '../utils/abortRegistry'
import { HandleChunk } from '../utils/handleChunk'
import { TokenUsageChange } from '../utils/usageAggregator'
import { beforeExecutePrompt } from './prompts'

interface SubmitTasksResult {
  tasks: Array<{ id: string, description: string }>
}

// 工具调用的最大循环数
const MAX_TURNS = Math.max(1, env.MAX_TURNS)
let summaryPromise: Promise<void> | null = null
/**
 * Simple 模式
 */
export async function before(state: typeof AgentState.State, config: LangGraphRunnableConfig) {
  if (summaryPromise) {
    await summaryPromise
    summaryPromise = null
  }

  // 初始化调试日志（使用 thread_id 作为文件名）
  const threadId = config.configurable?.thread_id || 'unknown'

  const enableThinking = state.enableThinking || false
  const workerId = 'worker_orchestrator_before'

  /**
   * 检查是否被中断
   */
  const checkAbort = () => {
    if (config.signal?.aborted) {
      throw new AbortError('User cancelled')
    }
  }

  const toolMessages: (ToolMessage | AIMessageChunk)[] = []
  let submitTasksResult: SubmitTasksResult | null = null

  // 声明 allowedTools，用于存储当前允许使用的工具
  const allowedTools: StructuredTool[] = []
  const context = ContextManager.getContext(threadId)
  const allowedSkills: string[] = context?.allowedSkills || []

  // 获取上一次的对话上下文（在 try 块外，以便后续使用）
  const historyMessages = restoreHistoryContext(context, new SystemMessage({ content: beforeExecutePrompt, name: 'orchestrator' }), state.messages, 'orchestrator')
  const messages = historyMessages

  try {
    // 创建 MCP 客户端
    await mcpManager.createOpenapiClient(workerId)
    const llm = createLLM(enableThinking)
    if (!llm) {
      throw new Error('Failed to create LLM instance')
    }

    // 获取自定义工具和 MCP 工具，自定义工具放在前面以确保优先级
    const customTools = getTools() as StructuredTool[]
    const mcpTools = mcpManager.getToolsForWorker(workerId)
    // orchestrator 内部工具始终可用，不依赖 load_skills / allowedSkills
    const internalTools = orchestratorTools as StructuredTool[]
    // 合并工具列表（用于查找与执行）
    const allTools: StructuredTool[] = [loadSkill, ...internalTools, ...customTools, ...mcpTools]
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
      // 提供给 LLM 使用的工具集合：
      // - loadSkill：用于按需加载技能
      // - internalTools：如 roxy_stop，始终可用
      // - allowedTools：基于技能筛选出的业务/MCP 工具
      const availableTools = [loadSkill, ...internalTools, ...allowedTools]
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
        const reasoning = chunk?.additional_kwargs?.reasoning
          || (chunk?.additional_kwargs as any)?.reasoning_content
          || (chunk as any).response_metadata?.reasoning

        if (reasoning && enableThinking && reasoning.trim() !== '') {
          const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
          config.writer?.(streamAdapter.thinking(reasoningStr, thinkingId))
        }
      }

      // 对于 Claude 模型，工具调用可能存储在 tool_call_chunks 中，需要先聚合
      let toolCalls = aggregatedMsg.tool_calls

      // 如果 tool_calls 为空，尝试从 tool_call_chunks 转换
      if ((!toolCalls || toolCalls.length === 0) && aggregatedMsg.tool_call_chunks && aggregatedMsg.tool_call_chunks.length > 0) {
        // 使用 collapseToolCallChunks 将 tool_call_chunks 转换为 tool_calls
        const collapsed = collapseToolCallChunks(aggregatedMsg.tool_call_chunks)
        toolCalls = collapsed.tool_calls
      }

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
            const result = await tool.invoke(toolArgs, { signal: config.signal })
            console.log('toolName', toolName)
            console.log('toolArgs', toolArgs)
            console.log('result', result)

            const endTime = Date.now()
            const executionTime = endTime - startTime

            // 内部决策工具结果不需要流式输出给前端，仅在内存中使用
            config.writer?.(streamAdapter.toolResult({
              toolName: tool.name,
              result,
              toolId,
              et: executionTime,
              status: 'success',
            }))

            if (toolName === 'submit_tasks') {
              submitTasksResult = {
                tasks: (result as any).tasks || [],
              }
            }

            if (toolName === 'load_skills') {
              toolMessages.push(new ToolMessage({
                tool_call_id: toolId,
                content: result.map((skill: any) => skill.content).join('\n\n'),
                name: toolName,
                status: 'success',
              }))
              allowedSkills.push(...result.map((skill: any) => skill.name))
              allowedTools.push(...findMcpTool(result.map((skill: any) => skill.allowTools).flat(), allTools))
            }
            else {
              toolMessages.push(new ToolMessage({
                tool_call_id: toolId,
                content: typeof result === 'string' ? result : JSON.stringify(result),
                name: toolName,
                status: 'success',
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

  await mcpManager.destroyWorkerClient(workerId)

  // 如果调用了 submit_tasks 工具
  if (submitTasksResult) {
    const tasks = submitTasksResult.tasks || []

    // 任务列表为空，表示不需要浏览器自动化，直接结束
    if (tasks.length === 0) {
      // 从前置阶段的最后一条 AI 消息中提取给用户的自然语言总结
      const reversed = [...toolMessages].reverse()
      const lastAiMsg = reversed.find((msg: any) => msg?._getType?.() === 'ai' || msg?.type === 'ai') || reversed[0]

      let content = ''
      if (lastAiMsg) {
        if (typeof lastAiMsg.content === 'string') {
          content = lastAiMsg.content
        }
        else if (Array.isArray(lastAiMsg.content)) {
          content = lastAiMsg.content
            .map((block: any) => typeof block === 'string' ? block : block.text || '')
            .join('')
        }
        else {
          content = String(lastAiMsg.content || '')
        }

        summaryPromise = ContextManager.updateContext(
          allMessages,
          threadId,
          allowedSkills,
        )
      }

      return {
        messages: allMessages,
        final_answer: content,
      }
    }

    // 任务列表不为空，before 阶段已经规划好任务了，直接传递给 worker 执行
    const plan = tasks.map((t: any) => ({
      id: String(t.id),
      description: t.description,
      status: 'pending',
      workerId: `worker_${String(t.id)}`,
    })).slice(0, env.WORKER_CONTEXT_LIMIT)

    summaryPromise = ContextManager.updateContext(
      allMessages,
      threadId,
      allowedSkills,
    )

    return {
      messages: allMessages,
      plan,
    }
  }

  // 没有调用 submit_tasks，流程仍会进入 orchestrator（由 orchestrator 做兜底结束）
  return {
    messages: allMessages,
  }
}

/**
 * Before 节点的路由函数
 * 根据 before 节点的执行结果决定下一步：
 * - 已有 final_answer：直接结束
 * - 已有 plan：进入 orchestrator，由 routerOrchestrator 分发给 worker
 * - 都没有：进入 orchestrator 做兜底结束（取最后一条 AI 消息为 final_answer）
 */
export async function routerBefore(state: typeof AgentState.State) {
  if (state.final_answer) {
    return END
  }

  // 统一进入 orchestrator（有 plan 则分发 worker，无 plan 则兜底结束）
  return 'orchestrator'
}
