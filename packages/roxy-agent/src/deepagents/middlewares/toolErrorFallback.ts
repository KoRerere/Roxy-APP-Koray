import { ToolMessage } from '@langchain/core/messages'
import { isGraphBubbleUp } from '@langchain/langgraph'
import { createMiddleware } from 'langchain'
import { isAbortLike } from '@/core/agentError'

const DEFAULT_MAX_ERRORS = 10

/**
 * 统一工具异常兜底。
 *
 * catch 工具执行（含 schema 校验）阶段抛出的任何异常，转成一个包含错误信息的
 * `ToolMessage` 返给 agent，让 agent 有机会修正参数后重试，而不是让异常向上冒泡
 * 成 `agent_internal_error`、整个 run 硬退出。
 *
 * 覆盖范围：deepagents 内置的 filesystem 工具（`write_file`/`read_file`/`edit_file`/
 * `execute` 等）以及所有 MCP 工具——这些工具的调用都会经过 `wrapToolCall` 钩子。
 *
 * 熔断：每个 middleware 实例维护一个错误计数，达到 `maxErrors` 后返回"请结束任务"。
 * 普通 chat agent 下每个 worker 是独立子进程 / 独立 agent 实例 / 独立 middleware 实例，
 * 因此实例级计数等价于 worker 级计数；计数随实例销毁自动释放，不会跨 run 累积。
 */
export function createToolErrorFallbackMiddleware(options?: { maxErrors?: number }) {
  const maxErrors = options?.maxErrors ?? DEFAULT_MAX_ERRORS
  let errorCount = 0

  return createMiddleware({
    name: 'ToolErrorFallbackMiddleware',
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request)
      }
      catch (error: any) {
        if (isGraphBubbleUp(error) || isAbortLike(error)) {
          throw error
        }

        errorCount += 1

        const toolName = request.toolCall?.name ?? 'unknown'
        const toolCallId = request.toolCall?.id
        const message = error instanceof Error ? error.message : String(error)
        // ToolInputParsingException.output 为出错参数的 JSON，便于 agent 定位丢了哪个字段
        const badInput = (error as any)?.output

        console.warn(`[Tool Error Fallback] ${toolName} (${errorCount}/${maxErrors}):`, message)

        const limitReached = errorCount >= maxErrors
        const content = limitReached
          ? `### Tool Error Limit Reached

**Tool**: ${toolName}
**Status**: Stopped
**Error Count**: ${errorCount}/${maxErrors}
**Latest Error**: ${message}
${badInput ? `**Your Input**: ${badInput}` : ''}

**Note**: 已达到工具错误次数上限，无法继续。请总结任务无法推进的原因，然后结束当前任务。`
          : `### Tool Execution Error

**Tool**: ${toolName}
**Status**: Failed
**Error Count**: ${errorCount}/${maxErrors}
**Error**: ${message}
${badInput ? `**Your Input**: ${badInput}` : ''}

**Note**: 工具调用参数不符合要求或执行失败。请：1) 检查必填参数是否齐全、类型是否正确；2) 修正后重新调用该工具；3) 若多次仍失败，总结原因并结束任务。`

        return new ToolMessage({
          content,
          status: 'error',
          name: toolName,
          tool_call_id: toolCallId || '',
        })
      }
    },
  })
}
