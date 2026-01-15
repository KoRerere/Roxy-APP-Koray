import type { MessageStructure } from '@langchain/core/messages'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { v4 as uuidv4 } from 'uuid'
import type { AgentState } from './state'
import { createLLM } from '../llm'
import { mcpManager } from '../mcpManager'
import { getPrompts } from '../prompts'
import { outputLangGraphTokenUsage } from './toLangGraphTokenUsage'
import { convertToolsToGeminiFormat, convertToolsToOpenRouterFormat } from './worker'

/**
 * Simple 模式的 LangGraph 节点
 */
export async function simpleNode(state: typeof AgentState.State, config: LangGraphRunnableConfig): Promise<Partial<typeof AgentState.State>> {
  const enableThinking = state.enableThinking || false
  const workerId = 'worker_simple'

  const prompts = getPrompts()

  try {
    // 创建 MCP 客户端
    await mcpManager.createMcpClient(workerId)

    const llm = createLLM(enableThinking)
    const tools = mcpManager.getToolsForWorker(workerId)

    // 根据 LLM provider 选择正确的工具转换函数
    const provider = process.env.LLM_PROVIDER || 'openrouter'
    /**
     * 对于 roxybrowser (Gemini API)，需要转换工具格式
     * 对于其他 provider，直接传递 StructuredTool 对象
     */
    const convertTools = provider === 'roxybrowser'
      ? convertToolsToGeminiFormat
      : convertToolsToOpenRouterFormat

    let finalContent = ''
    let thinkingContent = ''

    // 使用当前状态中的 messages
    const messages = [...state.messages]
    const convertedTools = convertTools(tools)
    console.log('[Simple] Provider:', provider)
    console.log('[Simple] Tools count:', tools.length)
    console.log('[Simple] Converted tools:', JSON.stringify(convertedTools, null, 2))

    const MAX_TURNS = Math.max(1, Number.parseInt(process.env.MAX_TURNS || '20', 10))

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      try {
        const stream = await llm.stream([
          new SystemMessage(prompts.system),
          ...messages,
        ], {
          tags: ['simple', workerId],
          tools: convertedTools,
          include_reasoning: enableThinking,
        } as any)

        let aggregatedMsg = new AIMessageChunk({ content: '' })
        let currentThinking = ''
        let lastChunk: AIMessageChunk<MessageStructure> | null = null

        // 发送开始事件
        config.writer?.({
          type: 'content',
          phase: 'simple',
          status: 'started',
        })

        for await (const chunk of stream) {
          aggregatedMsg = aggregatedMsg.concat(chunk)
          lastChunk = chunk // 保存最后一个 chunk

          const reasoning = chunk?.additional_kwargs?.reasoning
            || (chunk?.additional_kwargs as any)?.reasoning_content
            || (chunk as any).response_metadata?.reasoning

          if (reasoning) {
            const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
            currentThinking += reasoningStr

            // 发送思考内容
            if (enableThinking) {
              config.writer?.({
                type: 'thinking',
                phase: 'simple',
                status: 'generating',
                data: {
                  text: reasoningStr,
                },
              })
            }
          }

          // 发送流式内容
          if (chunk.content) {
            const chunkContent = typeof chunk.content === 'string' ? chunk.content : String(chunk.content || '')
            config.writer?.({
              type: 'content',
              phase: 'simple',
              status: 'generating',
              data: {
                text: chunkContent,
              },
            })
          }
        }

        outputLangGraphTokenUsage(config, lastChunk!)

        const toolCalls = (aggregatedMsg as any).tool_calls
        const content = aggregatedMsg.content || aggregatedMsg?.response_metadata?.reasoning

        // 添加 AI 回复到消息历史
        messages.push(aggregatedMsg)

        if (toolCalls && toolCalls.length > 0) {
          // 处理工具调用
          for (const toolCall of toolCalls) {
            const toolCallId = uuidv4()
            const toolName = toolCall.name
            const toolArgs = toolCall.args
            // const toolId = toolCall.id

            const tool = tools.find(t => t.name === toolName)
            if (tool) {
              try {
                // 发送工具调用开始事件
                config.writer?.({
                  type: 'tool_call',
                  phase: 'simple',
                  status: 'calling',
                  data: {
                    toolCallId,
                    toolName,
                    args: toolArgs,
                  },
                })

                const result = await tool.invoke(toolArgs)

                // 发送工具调用结果事件
                config.writer?.({
                  type: 'tool_result',
                  phase: 'simple',
                  status: 'success',
                  data: {
                    toolCallId,
                    toolName,
                    result: typeof result === 'string' ? result : JSON.stringify(result),
                  },
                })

                messages.push(new ToolMessage({
                  tool_call_id: toolCallId,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                  name: toolName,
                }))
              }
              catch (error: any) {
                console.error(`Tool ${toolName} execution error:`, error)

                // 发送工具调用失败事件
                config.writer?.({
                  type: 'tool_result',
                  phase: 'simple',
                  status: 'failed',
                  data: {
                    toolCallId,
                    toolName,
                    result: error.message,
                  },
                })

                messages.push(new ToolMessage({
                  tool_call_id: toolCallId,
                  content: `Error executing tool: ${error.message}`,
                  name: toolName,
                }))
              }
            }
            else {
              // 工具未找到
              console.warn(`Tool ${toolName} not found in available tools`)

              // 发送工具未找到事件
              config.writer?.({
                type: 'tool_result',
                phase: 'simple',
                status: 'failed',
                data: {
                  toolCallId,
                  toolName,
                  result: `Tool '${toolName}' not found. Available tools: ${tools.map(t => t.name).join(', ')}`,
                },
              })

              messages.push(new ToolMessage({
                tool_call_id: toolCallId,
                content: `Tool '${toolName}' not found. Available tools: ${tools.map(t => t.name).join(', ')}`,
                name: toolName,
              }))
            }
          }
          // 继续下一轮对话
        }
        else {
          // 没有工具调用，结束对话
          finalContent = typeof content === 'string' ? content : JSON.stringify(content)
          thinkingContent = currentThinking

          // 发送完成事件
          config.writer?.({
            type: 'content',
            phase: 'simple',
            status: 'completed',
            data: {
              text: finalContent,
            },
          })

          break
        }
      }
      catch (error) {
        console.error(`Simple node error:`, error)
        config.writer?.({
          type: 'error',
          data: {
            message: error instanceof Error ? error.message : String(error),
          },
        })
        finalContent = 'Error occurred during task execution.'
        break
      }
    }

    // 销毁 MCP 客户端
    await mcpManager.destroyWorkerClient(workerId)

    // 限制对话历史长度，避免消耗过多 token
    // Simple 模式总结阶段限制为最近 10 条消息
    const contextLimit = Number(process.env.SIMPLE_SYNTHESIS_CONTEXT_LIMIT) || 10
    const recentMessages = contextLimit > 0 ? messages.slice(-contextLimit) : messages

    // 生成对话历史上下文
    const conversationContext = recentMessages.map((msg: any) => {
      const role = msg._getType() === 'human' ? 'User' : 'Assistant'
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

    // 进行总结阶段，生成最终回答
    let finalAnswer = finalContent
    if (finalContent) {
      try {
        console.log('🤔 Generating synthesis for simple chat...')

        const synthesisSystemPrompt = prompts.simple.synthesisSystem

        const synthesisHumanPrompt = prompts.simple.synthesisHuman(conversationContext)

        /**
         * 总结阶段不启用思考模式
         */
        const llmForSynthesis = createLLM(false)

        // 发送 synthesis 开始事件
        config.writer?.({
          type: 'content',
          phase: 'synthesis',
          status: 'started',
        })

        const stream = await llmForSynthesis.stream([
          new SystemMessage(synthesisSystemPrompt),
          new HumanMessage(synthesisHumanPrompt),
        ], {
          tags: ['simple_synthesis'],
        })

        let synthesisContent = ''
        let lastSynthesisChunk: AIMessageChunk<MessageStructure> | null = null

        for await (const chunk of stream) {
          lastSynthesisChunk = chunk // 保存最后一个 chunk

          if (chunk.content) {
            const chunkContent = typeof chunk.content === 'string' ? chunk.content : String(chunk.content || '')
            synthesisContent += chunkContent

            // 发送 synthesis 流式内容
            config.writer?.({
              type: 'content',
              phase: 'synthesis',
              status: 'generating',
              data: {
                text: chunkContent,
              },
            })
          }
        }

        outputLangGraphTokenUsage(config, lastSynthesisChunk!)

        finalAnswer = synthesisContent || finalContent

        // 发送 synthesis 完成事件
        config.writer?.({
          type: 'content',
          phase: 'synthesis',
          status: 'completed',
          data: {
            text: finalAnswer,
          },
        })
      }
      catch (synthesisError) {
        console.error('❌ Simple synthesis failed:', synthesisError)
        // 如果总结失败，使用原始内容
        finalAnswer = finalContent

        // 发送 synthesis 错误事件
        config.writer?.({
          type: 'content',
          phase: 'synthesis',
          status: 'error',
          data: {
            text: synthesisError instanceof Error ? synthesisError.message : String(synthesisError),
          },
        })
      }
    }

    // 返回更新后的状态
    return {
      messages, // 更新消息历史
      final_answer: finalAnswer,
      synthesis_thinking: thinkingContent,
    }
  }
  catch (error) {
    config.writer?.({
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : String(error),
      },
    })
    console.error('Simple node fatal error:', error)
    return {
      final_answer: 'Fatal error in simple chat',
    }
  }
}
