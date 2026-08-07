import type { StructuredTool } from '@langchain/core/tools'

/**
 * 会打开/连接浏览器窗口的工具。这些工具的 dirId 参数必须落在 worker 被授权的
 * 窗口集合内，否则模型可能在指定窗口报错后自行遍历列表打开别的窗口（包括其他
 * 账号的窗口）。
 */
const WINDOW_TARGET_TOOL_NAMES = new Set([
  'roxy_open_browsers',
  'roxy_browser_launch',
  'roxy_get_connection_info',
  'roxy_close_browsers',
  'run_script',
])

/** 打开窗口时禁止抢占其他用户已打开的窗口 */
const FORCE_OPEN_TOOL_NAMES = new Set([
  'roxy_open_browsers',
  'roxy_browser_launch',
])

export function isWindowTargetTool(toolName: string): boolean {
  return WINDOW_TARGET_TOOL_NAMES.has(toolName)
}

/** 从工具入参中抽取 dirId（兼容单个 dirId 与 dirIds 数组两种形状） */
export function extractDirIds(input: unknown): string[] {
  if (!input || typeof input !== 'object')
    return []

  const record = input as Record<string, unknown>
  const dirIds: string[] = []
  if (typeof record.dirId === 'string' && record.dirId)
    dirIds.push(record.dirId)
  if (Array.isArray(record.dirIds)) {
    for (const value of record.dirIds) {
      if (typeof value === 'string' && value)
        dirIds.push(value)
    }
  }
  return dirIds
}

export interface WindowScopeViolation {
  toolName: string
  requested: string[]
  allowed: string[]
}

/**
 * 校验入参 dirId 是否都在授权集合内。
 *
 * @param toolName 工具名
 * @param input 工具入参
 * @param allowed 授权窗口集合；`undefined` 表示该 worker 未绑定窗口（不限制）
 */
export function checkWindowScope(
  toolName: string,
  input: unknown,
  allowed: ReadonlySet<string> | undefined,
): WindowScopeViolation | undefined {
  if (!allowed || allowed.size === 0 || !isWindowTargetTool(toolName))
    return undefined

  const requested = extractDirIds(input)
  const outOfScope = requested.filter(dirId => !allowed.has(dirId))
  if (outOfScope.length === 0)
    return undefined

  return { toolName, requested: outOfScope, allowed: Array.from(allowed) }
}

export function formatWindowScopeViolation(violation: WindowScopeViolation): string {
  return [
    `❌ ${violation.toolName} 被拒绝：dirId ${violation.requested.join(', ')} 不在本次任务授权的窗口范围内。`,
    `本次任务只允许操作以下窗口：${violation.allowed.join(', ')}。`,
    '不要改用其他窗口，也不要调用 roxy_list_browsers 挑选替代窗口。',
    '如果授权窗口不可用，请直接停止并向用户报告该窗口不可用的原因。',
  ].join('\n')
}

/** 打开窗口时强制 forceOpen: false，避免抢占其他账号已打开的窗口 */
export function applyForceOpenPolicy(toolName: string, input: unknown): unknown {
  if (!FORCE_OPEN_TOOL_NAMES.has(toolName) || !input || typeof input !== 'object')
    return input
  return { ...(input as Record<string, unknown>), forceOpen: false }
}

/**
 * 包装 MCP 工具，加入窗口作用域校验与 forceOpen 策略。
 *
 * 用 `Object.create` 保留原工具的 name/description/schema 以及 LangChain 内部
 * 方法，仅覆盖 `invoke`。
 */
export function withWindowScopeGuard<T extends StructuredTool>(
  tool: T,
  getAllowedDirIds: () => ReadonlySet<string> | undefined,
): T {
  if (!isWindowTargetTool(tool.name))
    return tool

  const guarded: T = Object.create(tool)
  guarded.invoke = async (input: any, config?: any) => {
    const violation = checkWindowScope(tool.name, input, getAllowedDirIds())
    if (violation) {
      console.warn(`[MCP] window scope violation: ${tool.name} requested ${violation.requested.join(',')}`)
      return formatWindowScopeViolation(violation)
    }
    return tool.invoke(applyForceOpenPolicy(tool.name, input) as any, config)
  }
  return guarded
}
