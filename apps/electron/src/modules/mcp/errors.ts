import type { McpFailureType } from '@roxy/electron-preload'

/**
 * MCP 错误数据结构
 */
export interface McpErrorData {
  type: McpFailureType
  message?: string
  details?: Record<string, any>
}

/**
 * MCP 自定义错误类
 */
export class McpError extends Error {
  type: McpFailureType
  details?: Record<string, any>

  constructor(type: McpFailureType, message?: string, details?: Record<string, any>) {
    super(message || type)
    this.name = 'McpError'
    this.type = type
    this.details = details
  }
}

/**
 * 创建 MCP 错误的辅助函数
 */
export function createMcpError(type: McpFailureType, message?: string, details?: Record<string, any>): McpError {
  return new McpError(type, message, details)
}

/**
 * 判断是否为 MCP 错误
 */
export function isMcpError(error: unknown): error is McpError {
  return error instanceof McpError
}

/**
 * 将错误转换为 IPC 返回格式
 */
export function toMcpErrorResponse(error: unknown): { success: false, type: McpFailureType, message?: string, details?: Record<string, any> } {
  if (isMcpError(error)) {
    return {
      success: false,
      type: error.type,
      message: error.message,
      details: error.details,
    }
  }
  if (error instanceof Error) {
    return {
      success: false,
      type: 'unknown_error',
      message: error.message,
    }
  }
  return {
    success: false,
    type: 'unknown_error',
    message: String(error),
  }
}
