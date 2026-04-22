import type { StructuredTool } from '@langchain/core/tools'

interface ToolWrapOptions {
  workerId?: string
  maxErrorsPerWorker?: number
}

const DEFAULT_WORKER_ID = '__default_worker__'
const DEFAULT_MAX_ERRORS_PER_WORKER = 10
const workerErrorCounts = new Map<string, number>()

function getWorkerId(options?: ToolWrapOptions): string {
  return options?.workerId?.trim() || DEFAULT_WORKER_ID
}

/**
 * 包装工具，捕获异常并转换为正常的返回值
 * 这样 AI 就能看到错误信息并继续尝试，而不是直接中断
 */
export function wrapToolWithErrorHandling(tool: StructuredTool, options?: ToolWrapOptions): StructuredTool {
  const originalInvoke = tool.invoke.bind(tool)
  const workerId = getWorkerId(options)
  const maxErrorsPerWorker = options?.maxErrorsPerWorker ?? DEFAULT_MAX_ERRORS_PER_WORKER

  // 直接在原对象上替换 invoke，保持实例引用（===）不变，避免 AgentNode 的 wrapModelCall 校验报错
  tool.invoke = async function (input: any, config?: any) {
    try {
      return await originalInvoke(input, config)
    }
    catch (error: any) {
      const currentErrors = (workerErrorCounts.get(workerId) ?? 0) + 1
      workerErrorCounts.set(workerId, currentErrors)

      // 捕获异常，转换为包含错误信息的字符串返回
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      console.warn(`[Tool Error Caught] ${tool.name}:`, errorMessage)

      if (currentErrors >= maxErrorsPerWorker) {
        console.warn(`[Tool Error Limit Reached] worker=${workerId}, limit=${maxErrorsPerWorker}, tool=${tool.name}`)
        return `### Tool Error Limit Reached

**Worker**: ${workerId}
**Tool**: ${tool.name}
**Status**: Stopped
**Current Error Count**: ${currentErrors}
**Max Allowed Errors**: ${maxErrorsPerWorker}
**Latest Error**: ${errorMessage}

${errorStack ? `**Stack Trace**:\n\`\`\`\n${errorStack}\n\`\`\`` : ''}

**Note**: The worker has reached the maximum number of tool execution errors.
Please summarize why the task cannot progress further and end the task now.`
      }

      // 返回格式化的错误信息，让 AI 能够理解并继续尝试
      return `### Tool Execution Error

**Tool**: ${tool.name}
**Status**: Failed
**Worker**: ${workerId}
**Current Error Count**: ${currentErrors}/${maxErrorsPerWorker}
**Error**: ${errorMessage}

${errorStack ? `**Stack Trace**:\n\`\`\`\n${errorStack}\n\`\`\`` : ''}

**Note**: This tool call failed, but you can:
1. You can read the relevant skills' guides/ or examples/
2. The tool call parameters may be incorrect, try adjusting them
3. Summarize the reason for the failure, then end the task`
    }
  }

  return tool
}

/**
 * 批量包装工具数组
 */
export function wrapToolsWithErrorHandling(tools: StructuredTool[], options?: ToolWrapOptions): StructuredTool[] {
  return tools.map(tool => wrapToolWithErrorHandling(tool, options))
}
