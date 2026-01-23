import type { WorkerOutput } from './state'
import type { BaseMessage } from '@langchain/core/messages'
import type { StructuredTool } from '@langchain/core/tools'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config'
import { createLLM } from '../../llm'
import { mcpManager } from '../../mcpManager'
import { streamAdapter } from '../../server/streamAdapter'
import { getTools } from '../tools'
import { TokenUsageChange } from '../utils/usageAggregator'
import { executePrompt } from './prompts'

export function convertToolsToOpenRouterFormat(tools: any[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema || {},
    },
  }))
}

interface WorkerInput {
  task: {
    id: string
    description: string
    workerId?: string
  }
  workerId?: string
  enableThinking?: boolean
  conversationHistory?: BaseMessage[]
  sessionDir?: string
}

export async function worker(input: WorkerInput, config: LangGraphRunnableConfig): Promise<{ worker_results: WorkerOutput[], tokenUsage?: any }> {
  const { id, description } = input.task
  const enableThinking = input.enableThinking || false
  const workerId = input.workerId || input.task.workerId || `worker_${id}`

  let finalContent = ''
  let thinkingContent = ''

  // 创建 UsageAggregator 实例，用于聚合 token usage
  // const usageAggregator = new UsageAggregator(config.writer)

  const messages: BaseMessage[] = [
    new SystemMessage(executePrompt),
    new HumanMessage(description),
  ]

  // 调试用的。
  const callTable: any[] = [];

  try {
    await mcpManager.createMcpClient(workerId!)

    const llm = createLLM(enableThinking)

    // 获取自定义工具和 MCP 工具，自定义工具放在前面以确保优先级
    const customTools = getTools() as StructuredTool[]
    const mcpTools = mcpManager.getToolsForWorker(workerId)
    // 合并工具列表，自定义工具优先（放在前面）
    const tools: StructuredTool[] = [...customTools, ...mcpTools]

    const MAX_TURNS = Math.max(1, env.MAX_TURNS)
    
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = await llm.stream(messages, {
        tags: ['worker', `worker_${id}`],
        tools: convertToolsToOpenRouterFormat(tools),
        callbacks: [new TokenUsageChange()],
        signal: config.signal,
      })

      let aggregatedMsg = new AIMessageChunk({ content: '' })
      const contentId = uuidv4()
      const thinkingId = uuidv4()
      for await (const chunk of stream) {
        aggregatedMsg = aggregatedMsg.concat(chunk)

        if (chunk.content.toString().trim() !== '') {
          config.writer?.(streamAdapter.workerContent(id, chunk.content.toString(), contentId))
        }

        const reasoning = chunk.additional_kwargs?.reasoning
          || (chunk.additional_kwargs as any)?.reasoning_content
          || (chunk as any).response_metadata?.reasoning

        if (reasoning && reasoning.trim() !== '') {
          const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
          thinkingContent += reasoningStr
          config.writer?.(streamAdapter.workerThinking(id, reasoningStr, thinkingId))
        }
      }

      const toolCalls = (aggregatedMsg as any).tool_calls
      messages.push(aggregatedMsg)
      finalContent += aggregatedMsg.content.toString()

      if (!toolCalls || toolCalls.length <= 0) {
        break
      }

      for (const toolCall of toolCalls) {
        const toolName = toolCall.name
        const toolArgs = toolCall.args
        const toolId = toolCall.id

        const tool = tools.find(t => t.name === toolName)
        if (tool) {
          // 调用工具，也就执行 mcp 里面的工具函数
          try {
            config.writer?.(streamAdapter.toolCall({
              toolName: tool.name,
              args: toolArgs,
              taskId: id,
              toolId,
            }))
            const startTime = Date.now()
            const result = await tool.invoke(toolArgs)
            const endTime = Date.now()
            const executionTime = endTime - startTime
            config.writer?.(streamAdapter.toolResult({
              toolName: tool.name,
              result,
              taskId: id,
              toolId,
              et: executionTime,
              status: 'success',
            }))
            messages.push(new ToolMessage({
              tool_call_id: toolId,
              content: typeof result === 'string' ? result : JSON.stringify(result),
              name: toolName,
            }))
            callTable.push({
              name: toolName,
              args: JSON.stringify(toolArgs),
              result: typeof result === 'string' ? result : JSON.stringify(result),
              status: 'success',
            })
          }
          catch (error: any) {
            config.writer?.(streamAdapter.toolResult({
              toolName: tool.name,
              result: error.message,
              status: 'failed',
              taskId: id,
              toolId,
            }))

            messages.push(new ToolMessage({
              tool_call_id: toolId,
              content: `Error executing tool: ${error.message}`,
              name: toolName,
            }))

            callTable.push({
              name: toolName,
              args: toolArgs,
              result: `Error executing tool: ${error.message}`,
              status: 'failed',
            })

            console.error(`Tool ${toolName} execution error:`, error)
          }

          
        }
      }
    }

    config.writer?.(streamAdapter.workerResult({
      taskId: id,
      status: 'success',
    }))
  }
  catch (error: any) {
    config.writer?.(streamAdapter.workerResult({
      error: error instanceof Error ? error.message : String(error),
      taskId: id,
      status: 'failed',
    }))
    console.error(`Orchestrator Worker ${workerId} error:`, error)
    finalContent = 'Error occurred during task execution.'
  }

  console.group(`${workerId} execution`)
  console.table(callTable)
  console.groupEnd()

  await mcpManager.destroyWorkerClient(workerId)
  const nextContent = finalContent || messages.filter(msg => msg.type === 'tool').map(msg => `${msg.type} ${msg.name}: ${msg.content}`).join('\n\n') || '没执行任何工具，返回空内容。'

  return {
    worker_results: [{
      taskId: id,
      content: nextContent,
      thinking: thinkingContent,
    }],
    // tokenUsage: usageAggregator.getUsage(),
  }
}
