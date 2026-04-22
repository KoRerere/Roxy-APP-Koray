import type { McpFailureType } from '@roxy/electron-preload'
import { getMcpErrorMessage } from '/@/stores/roxy-claw'

/**
 * 处理 MCP 错误响应，返回用户友好的消息
 * @param result MCP IPC 响应
 * @returns 处理结果，包含成功/失败和消息
 */
export function handleMcpResponse<T extends { success: boolean, type?: McpFailureType, message?: string, details?: Record<string, any> }>(
  result: T,
): { success: boolean, message: string } {
  if (result.success) {
    return { success: true, message: '' }
  }

  const errorMessage = result.type
    ? getMcpErrorMessage(result.type, result.details)
    : result.message || $t('服务异常，请稍后重试')

  return { success: false, message: errorMessage }
}
