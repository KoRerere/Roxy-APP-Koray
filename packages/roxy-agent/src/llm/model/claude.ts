import { ChatAnthropic } from '@langchain/anthropic'
import { DebugLogger } from '../../agent/utils/logger'
import { env } from '../../config'

export class Claude extends ChatAnthropic {
  /**
   * 重写 _streamResponseChunks 以添加调试日志
   */
  async* _streamResponseChunks(
    messages: any[],
    options: this['ParsedCallOptions'],
    runManager?: any,
  ): AsyncGenerator<any> {
    // 获取实际的 invocationParams 来检查工具
    const params = (this as any).invocationParams(options)

    // 调试：记录发送到 API 的实际参数
    if (env.DEBUG) {
      await DebugLogger.log('claude-api', 'Starting stream request', {
        messagesCount: messages.length,
        hasToolsInParams: !!params.tools,
        toolsCountInParams: params.tools?.length || 0,
        toolNamesInParams: params.tools?.map((t: any) => t.name) || [],
        // 检查第一个工具的完整格式
        firstToolInParams: params.tools?.[0]
          ? {
              name: params.tools[0].name,
              description: params.tools[0].description,
              input_schema: params.tools[0].input_schema,
              hasDefs: !!(params.tools[0].input_schema as any)?.$defs,
            }
          : null,
      })
    }

    // 调用父类方法
    const stream = super._streamResponseChunks(messages, options, runManager)

    let chunkIndex = 0
    for await (const chunk of stream) {
      // 调试：记录每个 chunk
      if (env.DEBUG) {
        await DebugLogger.log('claude-api', `Received chunk #${chunkIndex}`, {
          chunkType: chunk?.constructor?.name,
          hasMessage: !!(chunk as any)?.message,
          messageType: (chunk as any)?.message?.constructor?.name,
          messageToolCalls: (chunk as any)?.message?.tool_calls,
          messageToolCallChunks: (chunk as any)?.message?.tool_call_chunks,
          chunkToolCalls: (chunk as any)?.tool_calls,
          chunkToolCallChunks: (chunk as any)?.tool_call_chunks,
        })
      }
      chunkIndex++
      yield chunk
    }
  }
}
