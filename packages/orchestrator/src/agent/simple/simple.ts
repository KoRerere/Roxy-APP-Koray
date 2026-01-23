import type { AgentState } from '.'
import type { StructuredTool } from '@langchain/core/tools'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessageChunk, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config'
import { SummaryManager } from '../../database/summary'
import { createLLM } from '../../llm'
import { mcpManager } from '../../mcpManager'
import { streamAdapter } from '../../server/streamAdapter'
import { convertToolsToOpenRouterFormat } from '../orchestrator/worker'
import { getTools } from '../tools'
// import { messagesToText } from '../utils'
import { AbortError } from '../utils/abortRegistry'
import { TokenUsageChange } from '../utils/usageAggregator'
import { executePrompt } from './prompts'

// 工具调用的最大循环数
const MAX_TURNS = Math.max(1, env.MAX_TURNS)
let summaryPromise: Promise<any> | null = null

/**
 * Simple 模式
 */
export async function simple(state: typeof AgentState.State, config: LangGraphRunnableConfig): Promise<Partial<typeof AgentState.State>> {
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

  const messages = []

  const toolMessages: (ToolMessage | AIMessageChunk)[] = []

  try {
    // 创建 MCP 客户端
    await mcpManager.createMcpClient(workerId)
    const llm = createLLM(enableThinking)

    // 获取自定义工具和 MCP 工具，自定义工具放在前面以确保优先级
    const customTools = getTools() as StructuredTool[]
    const mcpTools = mcpManager.getToolsForWorker(workerId)
    // 合并工具列表
    const tools: StructuredTool[] = [...customTools, ...mcpTools]

    // 获取上一次的记忆摘要
    const summaryItem = await SummaryManager.getSummary(config.configurable?.thread_id || '')
    if (summaryItem) {
      const summary = SummaryManager.parseSummary(summaryItem.summary)
      messages.push(...summary.filter((item: any) => item.name !== 'orchestrator'))
    }

    // 系统提示词加过一次后不就再加了
    if (!messages.find(item => item.type === 'system' && item.name === 'simple')) {
      messages.push(new SystemMessage({
        content: executePrompt,
        name: 'simple'
      }))
    }

    messages.push(...state.messages)

    // ===================== 工具执行阶段 =====================
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // 检查中断
      checkAbort()

      const stream = await llm.stream([...messages, ...toolMessages], {
        tools: convertToolsToOpenRouterFormat(tools),
        callbacks: [new TokenUsageChange()],
        signal: config.signal, // 传递 abort signal
      })

      let aggregatedMsg = new AIMessageChunk({ content: '' })
      // let currentThinking = ''
      const contentId = uuidv4()
      const thinkingId = uuidv4()
      for await (const chunk of stream) {
        // 检查中断
        checkAbort()

        aggregatedMsg = aggregatedMsg.concat(chunk)

        if (chunk.content && chunk.content.toString().trim() !== '') {
          // currentThinking += chunk.content
          config.writer?.(streamAdapter.content(chunk.content.toString(), contentId))
        }
        else if (chunk.text && chunk.text.trim() !== '') { // deepseek 兼容处理
          config.writer?.(streamAdapter.content(chunk.text.toString(), contentId))
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

      const toolCalls = aggregatedMsg.tool_calls

      // 添加 AI 回复到消息历史
      toolMessages.push(aggregatedMsg)

      if (!toolCalls || toolCalls.length <= 0) {
        break
      }

      // 处理工具调用
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name
        const toolArgs = toolCall.args
        const toolId = toolCall.id as string

        const tool = tools.find(t => t.name === toolName)
        if (tool) {
          // 检查中断
          checkAbort()

          try {
            console.group(`Tool ${toolName} execution`)
            config.writer?.(streamAdapter.toolCall({
              toolName: tool.name,
              args: toolArgs,
              toolId,
            }))
            const startTime = Date.now()
            const result = await tool.invoke(toolArgs, { signal: config.signal })
            console.log('toolArgs', toolArgs)
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
            toolMessages.push(new ToolMessage({
              tool_call_id: toolId,
              content: typeof result === 'string' ? result : JSON.stringify(result),
              name: toolName,
              status: 'success',
            }))
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
          finally {
            console.groupEnd()
          }
        }
      }
    }

    // ===================== 总结阶段 =====================

    // if (toolMessages.length > 0) {
    //   // 限制对话中的工具历史长度，避免消耗过多 token
    //   const contextLimit = Number(env.SIMPLE_SYNTHESIS_CONTEXT_LIMIT)
    //   const recentMessages = contextLimit > 0 ? toolMessages.slice(-contextLimit) : toolMessages
    //   const historyMessages = [...messages, ...recentMessages]

    //   // 生成对话历史上下文文本
    //   const conversationContext = messagesToText(historyMessages)
    //   const synthesisHumanPrompt = genSynthesisHuman(conversationContext)
    //   const llmForSynthesis = createLLM(false)

    //   // 进行总结阶段，生成最终回答
    //   try {
    //     const stream = await llmForSynthesis.stream([
    //       new SystemMessage(synthesisPrompt),
    //       new HumanMessage(synthesisHumanPrompt),
    //     ], {
    //       callbacks: [new TokenUsageChange()],
    //       signal: config.signal,
    //     })

    //     for await (const chunk of stream) {
    //       // 检查中断
    //       checkAbort()
    //       if (typeof chunk.content === 'string') {
    //         config.writer?.(streamAdapter.synthesis(chunk.content))
    //       }
    //     }
    //   }
    //   catch (synthesisError) {
    //     if (AbortError.isAbortError(synthesisError) || config.signal?.aborted) {
    //       throw synthesisError
    //     }

    //     config.writer?.(streamAdapter.error(synthesisError instanceof Error ? synthesisError.message : String(synthesisError)))
    //     console.error('Simple synthesis error:', synthesisError)
    //   }
    // }

    // 生成新的记忆摘要
    // try {
    //   const newSummary = await ConversationSummaryAPI.generateSummary(recentMessages, config.configurable?.thread_id || '')
    //   if (newSummary) {
    //     await ConversationSummaryAPI.saveSummary(config.configurable?.thread_id || '', newSummary, recentMessages.length)
    //   }
    // }
    // catch (summaryError) {
    //   config.writer?.(streamAdapter.error(summaryError instanceof Error ? summaryError.message : String(summaryError)))
    //   console.error('❌ Simple summary failed:', summaryError)
    // }
  }
  catch (error) {
    // 非中断事件的报错
    if (!AbortError.isAbortError(error)) {
      config.writer?.(streamAdapter.error(error instanceof Error ? error.message : String(error)))
      console.error('Simple error:', error)
    }
  }

  const allMessages = [...messages, ...toolMessages]

  summaryPromise = SummaryManager.generateSummary(allMessages, config.configurable?.thread_id || '')

  await mcpManager.destroyWorkerClient(workerId)

  return {
    messages: [...messages, ...toolMessages],
    // tokenUsage: usageAggregator.getUsage(),
  }
}
