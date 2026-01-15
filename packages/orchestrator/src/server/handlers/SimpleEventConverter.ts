import type { StreamEvent } from '../types.js'
import { getSimpleGraph } from '../../agent'
// import { EventLogger } from '../eventLogger'
import { ChatLogger } from '../chatLogger'

/**
 * Simple 模式事件转换器
 * 负责将 LangGraph 事件转换为前端 SSE 事件
 *
 * Simple 模式的事件流：
 * 1. 对话阶段：on_chat_model_start -> on_chat_model_stream (思考+内容)
 * 2. 工具调用：on_tool_start -> on_tool_end
 * 3. 总结阶段：on_chain_end (simpleChat 节点完成)
 */
export class SimpleEventConverter {
  /**
   * 转换整个流
   */
  async convertStream(
    input: any,
    config: any,
    onStream: (event: StreamEvent) => void,
  ): Promise<void> {
    const simpleGraph = await getSimpleGraph()

    const chatLogger = new ChatLogger(config.configurable.thread_id)

    try {
      const stream = await simpleGraph.stream(input, config)
      // @ts-ignore
      for await (const [mode, event] of stream) {
        if (mode === 'custom') {
          onStream(event)
          chatLogger.addEvent(event)
        }
        // originalEventLogger.addEvent(event)
        // const eventType = event.event
        // const rawEvent: any = event

        // // 处理工具调用事件
        // if (eventType === 'on_tool_start' || eventType === 'on_tool_end') {
        //   const toolName = rawEvent.name
        //     || rawEvent.data?.name
        //     || rawEvent.data?.tool_name
        //     || 'unknown_tool'

        //   if (eventType === 'on_tool_start') {
        //     const args = rawEvent.data?.input
        //       ?? rawEvent.data?.tool_input
        //       ?? rawEvent.data?.args
        //       ?? {}

        //     onStream({
        //       type: 'tool_call',
        //       data: {
        //         toolName,
        //         args,
        //         status: 'calling', // 工具调用开始
        //       },
        //       timestamp: Date.now(),
        //     })
        //   }

        //   if (eventType === 'on_tool_end') {
        //     const result = rawEvent.data?.output
        //       ?? rawEvent.data?.result
        //       ?? rawEvent.data

        //     const executionTime = typeof rawEvent.data?.execution_time === 'number'
        //       ? rawEvent.data.execution_time
        //       : undefined

        //     // 检查是否是错误结果
        //     const isError = result && typeof result === 'string' && result.startsWith('Error executing tool:')
        //     const status = isError ? 'error' : 'success'

        //     onStream({
        //       type: 'tool_result',
        //       data: {
        //         toolName,
        //         result,
        //         executionTime,
        //         status, // 成功或失败状态
        //       },
        //       timestamp: Date.now(),
        //     })
        //   }
        //   continue
        // }

        // // 处理流式内容（思考和回答）
        // if (eventType === 'on_chat_model_stream') {
        //   const chunk = event.data?.chunk
        //   if (chunk) {
        //     // 提取思考内容（reasoning）
        //     const reasoning = chunk?.additional_kwargs?.reasoning
        //       || (chunk?.additional_kwargs as any)?.reasoning_content
        //       || (chunk as any).response_metadata?.reasoning

        //     if (reasoning) {
        //       const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
        //       onStream({
        //         type: 'planning_thinking',
        //         data: {
        //           text: reasoningStr
        //         },
        //         timestamp: Date.now(),
        //       })
        //     }

        //     // 提取内容
        //     const content = this.extractContent(chunk)
        //     if (content) {
        //       onStream({
        //         type: 'planning_content',
        //         data: {
        //           taskId: 'simple',
        //           text: content,
        //         },
        //         timestamp: Date.now(),
        //       })
        //     }
        //   }
        //   continue
        // }
      }
    }
    catch (simpleError: any) {
      console.error('Simple event converter error:', simpleError)
      throw simpleError
    }
    finally {
      chatLogger.saveToFile()
    }
  }

  /**
   * 从 chunk 中提取内容
   */
  private extractContent(chunk: any): string | null {
    // 尝试多种方式提取内容
    if (chunk.content) {
      return typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content)
    }

    // 检查 additional_kwargs
    if (chunk.additional_kwargs?.content) {
      return chunk.additional_kwargs.content
    }

    // 检查 response_metadata
    if (chunk.response_metadata?.content) {
      return chunk.response_metadata.content
    }

    return null
  }
}
