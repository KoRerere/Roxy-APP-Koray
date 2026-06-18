import { ToolMessage } from '@langchain/core/messages'
import { createMiddleware } from 'langchain'

const SAVE_IMAGE_SPEC_TOOL = 'save_image_spec'

export function createSaveImageSpecLimitMiddleware() {
  return createMiddleware({
    name: 'SaveImageSpecLimitMiddleware',
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

        const saveImageSpecCalls = toolCalls.filter(
          (tc: any) => tc.name === SAVE_IMAGE_SPEC_TOOL,
        )
        if (saveImageSpecCalls.length === 0)
          return

        // 只要 tool_calls 数组长度大于 1，即存在并行调用（无论是多个 save_image_spec
        // 还是 save_image_spec 与其他工具同批次调用），均视为违规。
        if (toolCalls.length <= 1)
          return

        const errorMessages: ToolMessage[] = saveImageSpecCalls.map(
          (tc: any) =>
            new ToolMessage({
              content: [
                '## save_image_spec parallel call not allowed',
                '',
                'save_image_spec must be called alone, without any other tool calls in the same turn.',
                'Do not call save_image_spec in parallel with other tools.',
                'Call save_image_spec again as the only tool call in the next turn.',
                'Write exact ONE prompt for multiple images.',
              ].join('\n'),
              name: SAVE_IMAGE_SPEC_TOOL,
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
