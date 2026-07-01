import { ToolMessage } from '@langchain/core/messages'
import { createMiddleware } from 'langchain'
import { buildParallelToolCallLimitMessage } from '../prompt/tools'

/**
 * 限制某个工具的并行调用：当模型在同一轮 tool_calls 中把指定 `toolName` 与任何其他
 * 工具（或多个同名调用）一起并行调用时，拦截并回灌错误，要求模型在下一轮**单独**调用该工具。
 *
 * 适用于「最终一步 / 收尾型」工具（如 save_image_spec、save_script）：它们必须独占一轮、
 * 不与其他工具混批，以保证退出 agent loop 时的消息配对正确、副作用唯一。
 *
 * @param toolName 需要限制并行的工具名（如 'save_image_spec' / 'save_script'）
 */
export function createParallelToolCallLimitMiddleware(toolName: string) {
  return createMiddleware({
    name: `ParallelToolCallLimitMiddleware(${toolName})`,
    afterModel: {
      hook: async (state) => {
        const messages = (state as any).messages as any[]
        if (!Array.isArray(messages) || messages.length === 0)
          return

        // 取最新一条 AI message（模型刚返回的）
        const lastAiMessage = [...messages].reverse().find(
          (msg: any) => msg._getType?.() === 'ai' || msg.constructor?.name === 'AIMessage',
        )
        if (!lastAiMessage)
          return

        const toolCalls: any[] = lastAiMessage.tool_calls ?? []
        if (toolCalls.length === 0)
          return

        const targetCalls = toolCalls.filter((tc: any) => tc.name === toolName)
        if (targetCalls.length === 0)
          return

        if (toolCalls.length <= 1)
          return

        const errorMessages: ToolMessage[] = targetCalls.map(
          (tc: any) =>
            new ToolMessage({
              content: buildParallelToolCallLimitMessage(toolName),
              name: toolName,
              tool_call_id: tc.id,
            }),
        )

        return {
          messages: errorMessages,
          jumpTo: 'model' as const,
        }
      },
      canJumpTo: ['model'] as const,
    },
  })
}
