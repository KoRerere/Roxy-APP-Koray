import type { BaseMessage } from '@langchain/core/messages'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { v4 as uuidv4 } from 'uuid'
import type { WorkerOutput } from './state'
import { createLLM } from '../llm'
import { mcpManager } from '../mcpManager'
import { getPrompts } from '../prompts'

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

/**
 * 为 Gemini API 转换工具格式
 * 修复以下问题：
 * 1. 数组类型需要定义 items 字段
 * 2. enum 只能用于 STRING 类型，不能用于 number 类型
 */
export function convertToolsToGeminiFormat(tools: any[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: fixSchemaForGemini(tool.schema || {}),
    },
  }))
}

/**
 * 递归修复 schema 以符合 Gemini API 要求
 */
function fixSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  // 如果是数组，需要克隆并处理
  if (Array.isArray(schema)) {
    return schema.map(item => fixSchemaForGemini(item))
  }

  const fixed: any = { ...schema }

  // 处理 properties
  if (fixed.properties && typeof fixed.properties === 'object') {
    fixed.properties = {}
    for (const [key, value] of Object.entries(schema.properties)) {
      fixed.properties[key] = fixSchemaForGemini(value as any)
    }
  }

  // 处理 items（数组元素）
  if (fixed.items) {
    fixed.items = fixSchemaForGemini(fixed.items)
  }

  // 处理数组类型：如果 type 是 array 但没有 items，添加默认 items
  if (fixed.type === 'array' && !fixed.items) {
    fixed.items = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        value: { type: 'string' },
        domain: { type: 'string' },
      },
    }
  }

  // 处理 enum：如果 type 是 number 但有 enum，需要转换为 string 类型
  if (fixed.type === 'number' && fixed.enum) {
    // 将 number enum 转换为 string enum
    fixed.type = 'string'
    fixed.enum = fixed.enum.map((v: any) => String(v))
  }

  // 处理 oneOf, anyOf, allOf
  if (fixed.oneOf) {
    fixed.oneOf = fixed.oneOf.map((item: any) => fixSchemaForGemini(item))
  }
  if (fixed.anyOf) {
    fixed.anyOf = fixed.anyOf.map((item: any) => fixSchemaForGemini(item))
  }
  if (fixed.allOf) {
    fixed.allOf = fixed.allOf.map((item: any) => fixSchemaForGemini(item))
  }

  return fixed
}

export function toolCallTimeout(toolCallFunction: () => Promise<any>) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Tool call timeout'))
    }, 1000 * 60)
    toolCallFunction().then((result) => {
      clearTimeout(timer)
      resolve(result)
    }).catch((error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
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

export async function worker(input: WorkerInput, config: LangGraphRunnableConfig): Promise<{ worker_results: WorkerOutput[] }> {
  const { id, description } = input.task
  const enableThinking = input.enableThinking || false
  const conversationHistory = input.conversationHistory

  const workerId = input.workerId || input.task.workerId || `worker_${id}`

  try {
    await mcpManager.createMcpClient(workerId!)

    const prompts = getPrompts()

    const llm = createLLM(enableThinking)

    const tools = mcpManager.getToolsForWorker(workerId)

    const systemPrompt = prompts.worker.execute

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...(conversationHistory || []), // Inject conversation history for context
      new HumanMessage(description),
    ]

    const MAX_TURNS = Math.max(1, Number.parseInt(process.env.MAX_TURNS || '20', 10))

    let finalContent = ''
    let thinkingContent = ''

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      try {
        const stream = await llm.stream(messages, {
          tags: ['worker', `worker_${id}`],
          tools: convertToolsToOpenRouterFormat(tools),
          include_reasoning: enableThinking,
        } as any)

        let aggregatedMsg = new AIMessageChunk({ content: '' })

        for await (const chunk of stream) {
          console.log('worker::chunk..', chunk)
          aggregatedMsg = aggregatedMsg.concat(chunk)
          const reasoning = chunk.additional_kwargs?.reasoning
            || (chunk.additional_kwargs as any)?.reasoning_content
            || (chunk as any).response_metadata?.reasoning

          if (reasoning) {
            const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
            thinkingContent += reasoningStr
          }
        }

        console.log('worker::aggregatedMsg..', aggregatedMsg)

        const toolCalls = (aggregatedMsg as any).tool_calls
        const content = aggregatedMsg.content

        messages.push(aggregatedMsg)

        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const toolCallId = uuidv4()
            const toolName = toolCall.name
            const toolArgs = toolCall.args
            const toolId = toolCall.id

            const tool = tools.find(t => t.name === toolName)
            if (tool) {
              console.log('worker::toolCall..', tool.name)
              console.log('worker::toolArgs..', toolArgs)
              // 调用工具，也就执行 mcp 里面的工具函数
              try {
                config.writer?.({
                  type: 'tool_call',
                  phase: 'worker',
                  taskId: id,
                  status: 'calling',
                  data: {
                    toolCallId,
                    toolName: tool.name,
                    args: toolArgs,
                  },
                })
                const result = await tool.invoke(toolArgs)
                config.writer?.({
                  type: 'tool_result',
                  phase: 'worker',
                  taskId: id,
                  status: 'success',
                  data: {
                    toolName: tool.name,
                    toolCallId,
                    result: typeof result === 'string' ? result : JSON.stringify(result),
                  },
                })
                console.log('worker::result..', result)
                messages.push(new ToolMessage({
                  tool_call_id: toolId,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                  name: toolName,
                }))
              }
              catch (error: any) {
                config.writer?.({
                  type: 'tool_result',
                  phase: 'worker',
                  taskId: id,
                  status: 'failed',
                  data: {
                    toolName,
                    toolCallId,
                    result: error.message,
                  },
                })
                console.error(`Tool ${toolName} execution error:`, error)
                messages.push(new ToolMessage({
                  tool_call_id: toolId,
                  content: `Error executing tool: ${error.message}`,
                  name: toolName,
                }))
              }
            }
            else {
              // TODO：工具没找到
              config.writer?.({
                type: 'tool_result',
                phase: 'worker',
                taskId: id,
                status: 'failed',
                data: {
                  toolCallId,
                  text: `Tool ${toolName} not found in available tools`,
                },
              })
            }
            // else {
            //   // 工具未找到
            //   console.warn(`Tool ${toolName} not found in available tools`);
            //   messages.push(new ToolMessage({
            //     tool_call_id: toolId,
            //     content: `Tool '${toolName}' not found. Available tools: ${tools.map(t => t.name).join(', ')}`,
            //     name: toolName,
            //   }))
            // }
          }
        }
        else {
          finalContent = typeof content === 'string' ? content : JSON.stringify(content)
          break
        }
      }
      catch (error) {
        console.error(`Worker ${workerId} stream error:`, error)
        finalContent = 'Error occurred during task execution.'
        break
      }
    }

    return {
      worker_results: [{
        taskId: id,
        content: finalContent || 'No content generated.',
        thinking: thinkingContent || undefined,
      }],
    }
  }
  finally {
    // 执行完毕后销毁 mcp 客户端。
    await mcpManager.destroyWorkerClient(workerId)
  }
}
