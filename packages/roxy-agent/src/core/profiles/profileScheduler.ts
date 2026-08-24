import type { ProfileLeaseRegistry } from './profileLeaseRegistry'
import type { RuntimeMcpTool } from '@/core/mcp/runtimeMcpTool'
import type { RoxyPlugin, ToolMiddlewareContext, ToolResult } from 'roxy-agent-runtime'
import { profileMonitor } from '@/core/task-monitor'
import { profileLeaseRegistry } from './profileLeaseRegistry'

/**
 * 会操作指定浏览器窗口/profile 的工具。这些工具的 dirId 参数必须落在 worker 被授权的
 * 窗口集合内，否则模型可能在指定窗口报错后自行遍历列表打开别的窗口（包括其他
 * 账号的窗口）。
 */
const WINDOW_TARGET_TOOL_NAMES = new Set([
  'roxy_profile_open',
  'roxy_browser_launch',
  'roxy_profile_connection_info',
  'roxy_profile_close',
  'roxy_profile_delete',
  'roxy_script_run',
])

/** 打开窗口时禁止抢占其他用户已打开的窗口 */
const FORCE_OPEN_TOOL_NAMES = new Set([
  'roxy_profile_open',
  'roxy_browser_launch',
])

const PLAYWRIGHT_PROFILE_TOOL_PATTERN = /^mcp_roxybrowser_playwright_.+__(?:browser_|roxy_browser_)/i
const OPENAPI_PROFILE_CLOSE_TOOL_PATTERN = /^mcp_roxybrowser-openapi-mcp__roxy_profile_close$/i

function matchesToolName(toolName: string, originalName: string): boolean {
  return toolName === originalName || toolName.endsWith(`__${originalName}`)
}

export interface ProfileMonitorAttachInput {
  taskId: string
  browserId: string
  dirId: string
  label: string
  workerId?: string
  conversationId?: string
}

export interface ProfileMonitorEventInput {
  taskId: string
  browserId: string
  dirId: string
  stage: 'start' | 'end' | 'error'
  toolName: string
  input?: Record<string, unknown>
  result?: string
  success: boolean
  errorMessage?: string
  durationMs?: number
  timestamp?: number
  workerId?: string
  conversationId?: string
}

export interface ProfileMonitorFinishInput {
  taskId: string
  browserId: string
  dirId: string
}

export interface ProfileMonitorSink {
  attach: (input: ProfileMonitorAttachInput) => void
  event: (input: ProfileMonitorEventInput) => void
  finish: (input: ProfileMonitorFinishInput) => void
}

const defaultProfileMonitor: ProfileMonitorSink = {
  attach: profileMonitor.attach,
  event: profileMonitor.event,
  finish: profileMonitor.finish,
}

/** Process-local profile scheduler. A profile is held until its agent is disposed. */
export class ProfileScheduler {
  constructor(private readonly registry: ProfileLeaseRegistry = profileLeaseRegistry) {}

  acquire(ownerId: string, dirIds: readonly string[]): void {
    this.registry.acquire({ executionId: ownerId }, dirIds)
  }

  release(ownerId: string): string[] {
    return this.registry.release(ownerId)
  }

  getOwner(dirId: string): string | undefined {
    return this.registry.getOwner(dirId)?.executionId
  }

  getOwnedProfiles(ownerId: string): string[] {
    return this.registry.getOwnedProfiles(ownerId)
  }

  clear(): void {
    this.registry.clear()
  }
}

export const profileScheduler = new ProfileScheduler()

export function isWindowTargetTool(toolName: string): boolean {
  return [...WINDOW_TARGET_TOOL_NAMES].some(originalName => matchesToolName(toolName, originalName))
}

/** 从工具入参中抽取 dirId（兼容单个 dirId 与 dirIds 数组两种形状） */
export function extractDirIds(input: unknown): string[] {
  if (!input || typeof input !== 'object') {
    return []
  }

  const record = input as Record<string, unknown>
  const dirIds: string[] = []
  if (typeof record.dirId === 'string' && record.dirId) {
    dirIds.push(record.dirId)
  }
  if (Array.isArray(record.dirIds)) {
    for (const value of record.dirIds) {
      if (typeof value === 'string' && value) {
        dirIds.push(value)
      }
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
  if (!allowed || allowed.size === 0 || !isWindowTargetTool(toolName)) {
    return undefined
  }

  const requested = extractDirIds(input)
  if (requested.length === 0) {
    return { toolName, requested: ['<missing>'], allowed: Array.from(allowed) }
  }
  const outOfScope = requested.filter(dirId => !allowed.has(dirId))
  if (outOfScope.length === 0) {
    return undefined
  }

  return { toolName, requested: outOfScope, allowed: Array.from(allowed) }
}

export function formatWindowScopeViolation(violation: WindowScopeViolation): string {
  return [
    `${violation.toolName} was rejected: dirId ${violation.requested.join(', ')} is outside the window scope authorized for this task.`,
    `This task only allows operations on the following windows: ${violation.allowed.join(', ')}.`,
    'Do not switch to another window or call roxy_profile_list to choose an alternative.',
    'If the authorized window is unavailable, stop and report the reason to the user.',
  ].join('\n')
}

/** 打开窗口时强制 forceOpen: false，避免抢占其他账号已打开的窗口 */
export function applyForceOpenPolicy(toolName: string, input: unknown): unknown {
  const forceOpenTool = [...FORCE_OPEN_TOOL_NAMES].some(originalName => matchesToolName(toolName, originalName))
  if (!forceOpenTool || !input || typeof input !== 'object') {
    return input
  }
  return { ...(input as Record<string, unknown>), forceOpen: false }
}

/**
 * 包装 MCP 工具，加入窗口作用域校验与 forceOpen 策略。
 *
 * 保留 runtime descriptor，只包装 handler。
 */
export function withWindowScopeGuard(
  tool: RuntimeMcpTool,
  getAllowedDirIds: () => ReadonlySet<string> | undefined,
): RuntimeMcpTool {
  if (!isWindowTargetTool(tool.descriptor.name)) {
    return tool
  }
  return {
    ...tool,
    descriptor: tool.descriptor,
    handler: async (input, ctx) => {
      const violation = checkWindowScope(tool.descriptor.name, input, getAllowedDirIds())
      if (violation) {
        console.warn(`[MCP] window scope violation: ${tool.descriptor.name} requested ${violation.requested.join(',')}`)
        return { content: formatWindowScopeViolation(violation), isError: true }
      }
      return tool.handler(applyForceOpenPolicy(tool.descriptor.name, input), ctx)
    },
  }
}

export interface ProfileSchedulerPluginOptions {
  /** Stable owner for one runtime agent (conversation turn or worker). */
  ownerId: string
  taskId?: string
  workerId?: string
  conversationId?: string
  allowedDirIds?: readonly string[]
  scheduler?: ProfileScheduler
  monitor?: ProfileMonitorSink
  releaseOnDispose?: boolean
  onProfileClosed?: (dirId: string) => void | Promise<void>
}

function resultText(result: ToolResult): string {
  return typeof result.content === 'string' ? result.content : String(result.content)
}

function normalizedInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed }
    }
    catch {
      return { value: input }
    }
  }
  return input === undefined ? {} : { value: input }
}

function monitorSafeInput(input: Record<string, unknown>): Record<string, unknown> {
  const sensitive = /password|token|cookie|authorization|secret|apikey|api_key/i
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, sensitive.test(key) ? '[REDACTED]' : value]))
}

function isProfileTool(toolName: string): boolean {
  return PLAYWRIGHT_PROFILE_TOOL_PATTERN.test(toolName)
}

function canDiscoverProfileFromResult(toolName: string): boolean {
  return [
    'roxy_browser_launch',
    'roxy_browser_connect',
  ].some(originalName => matchesToolName(toolName, originalName))
}

function profileIdsFromResult(result: string): string[] {
  const ids = new Set<string>()
  for (const match of result.matchAll(/(?:Browser|dirId|dir_id|profile(?:Id|_id))[`*'"\s:#=-]*([\w-]{3,})/gi)) {
    if (match[1]) {
      ids.add(match[1])
    }
  }
  return [...ids]
}

/** Runtime plugin for profile ownership, browser lifecycle monitoring and force-open policy. */
export function createProfileSchedulerPlugin(
  options: ProfileSchedulerPluginOptions,
): RoxyPlugin {
  const scheduler = options.scheduler ?? profileScheduler
  const monitor = options.monitor ?? defaultProfileMonitor
  const allowed = options.allowedDirIds ? new Set(options.allowedDirIds.filter(Boolean)) : undefined
  const activeCalls = new Map<string, { dirIds: string[], startedAt: number, input: Record<string, unknown> }>()
  const closeCalls = new Map<string, string[]>()
  const attached = new Set<string>()
  let activeDirId = allowed?.size === 1 ? [...allowed][0] : undefined

  function browserId(dirId: string): string {
    return options.workerId ? `${options.workerId}:${dirId}` : dirId
  }

  function resolveDirIds(toolName: string, input: unknown): string[] {
    const requested = extractDirIds(input)
    if (requested.length > 0) {
      return requested
    }
    if (isProfileTool(toolName) && activeDirId) {
      return [activeDirId]
    }
    return []
  }

  function updateActiveDirId(dirIds: readonly string[]): void {
    if (dirIds.length === 1) {
      activeDirId = dirIds[0]
    }
  }

  function attach(dirId: string): void {
    if (!options.taskId || attached.has(dirId)) {
      return
    }
    attached.add(dirId)
    monitor.attach({
      taskId: options.taskId,
      browserId: browserId(dirId),
      dirId,
      label: dirId,
      workerId: options.workerId,
      conversationId: options.conversationId,
    })
  }

  return {
    name: 'profile-scheduler',
    version: '1.0.0',
    setup(api) {
      api.addToolMiddleware({
        match: OPENAPI_PROFILE_CLOSE_TOOL_PATTERN,
        async before(input, ctx: ToolMiddlewareContext) {
          closeCalls.set(ctx.toolUseId, [...new Set(extractDirIds(normalizedInput(input)))])
          return normalizedInput(input)
        },
        async after(result, ctx: ToolMiddlewareContext) {
          const dirIds = closeCalls.get(ctx.toolUseId) ?? []
          closeCalls.delete(ctx.toolUseId)
          if (!result.isError) {
            await Promise.all(dirIds.map(dirId => options.onProfileClosed?.(dirId)))
            if (activeDirId && dirIds.includes(activeDirId)) {
              activeDirId = undefined
            }
          }
          return result
        },
      })

      api.addToolMiddleware({
        match: PLAYWRIGHT_PROFILE_TOOL_PATTERN,
        async before(input, ctx: ToolMiddlewareContext) {
          const inputObject = normalizedInput(input)
          const dirIds = resolveDirIds(ctx.toolName, inputObject)
          if (allowed && allowed.size > 0) {
            const requested = dirIds.length > 0
              ? dirIds
              : (isWindowTargetTool(ctx.toolName) ? ['<missing>'] : [])
            const outOfScope = requested.filter(dirId => !allowed.has(dirId))
            if (outOfScope.length > 0) {
              const message = formatWindowScopeViolation({ toolName: ctx.toolName, requested: outOfScope, allowed: [...allowed] })
              emitError(outOfScope, ctx.toolName, inputObject, message)
              throw new Error(message)
            }
          }

          if (dirIds.length > 0) {
            try {
              scheduler.acquire(options.ownerId, dirIds)
            }
            catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              emitError(dirIds, ctx.toolName, inputObject, message)
              throw error
            }
            dirIds.forEach(attach)
            updateActiveDirId(dirIds)
          }

          const start = Date.now()
          activeCalls.set(ctx.toolUseId, { dirIds, startedAt: start, input: monitorSafeInput(inputObject) })
          if (options.taskId && dirIds.length > 0) {
            for (const dirId of dirIds) {
              monitor.event({
                taskId: options.taskId,
                browserId: browserId(dirId),
                dirId,
                stage: 'start',
                toolName: ctx.toolName,
                input: monitorSafeInput(inputObject),
                success: true,
                workerId: options.workerId,
                conversationId: options.conversationId,
                timestamp: start,
              })
            }
          }

          return applyForceOpenPolicy(ctx.toolName, inputObject)
        },
        async after(result, ctx: ToolMiddlewareContext) {
          const call = activeCalls.get(ctx.toolUseId)
          activeCalls.delete(ctx.toolUseId)
          const text = resultText(result)
          const observedDirIds = call?.dirIds.length
            ? call.dirIds
            : (canDiscoverProfileFromResult(ctx.toolName) ? profileIdsFromResult(text) : [])
          const dirIds = allowed && allowed.size > 0
            ? observedDirIds.filter(dirId => allowed.has(dirId))
            : observedDirIds
          if (dirIds.length > 0) {
            scheduler.acquire(options.ownerId, dirIds)
            dirIds.forEach(attach)
            updateActiveDirId(dirIds)
          }
          if (options.taskId) {
            for (const dirId of dirIds) {
              monitor.event({
                taskId: options.taskId,
                browserId: browserId(dirId),
                dirId,
                stage: result.isError ? 'error' : 'end',
                toolName: ctx.toolName,
                input: call?.input,
                result: text,
                success: !result.isError,
                ...(result.isError ? { errorMessage: text } : {}),
                durationMs: call ? Date.now() - call.startedAt : undefined,
                workerId: options.workerId,
                conversationId: options.conversationId,
                timestamp: Date.now(),
              })
            }
          }
          return result
        },
      })

      api.onDispose(() => {
        if (options.releaseOnDispose === false) {
          return
        }
        const dirIds = scheduler.release(options.ownerId)
        if (!options.taskId) {
          return
        }
        for (const dirId of dirIds) {
          monitor.finish({ taskId: options.taskId, browserId: browserId(dirId), dirId })
          attached.delete(dirId)
        }
      })
    },
  }

  function emitError(dirIds: string[], toolName: string, input: Record<string, unknown>, message: string): void {
    if (!options.taskId) {
      return
    }
    for (const dirId of dirIds.filter(dirId => dirId !== '<missing>')) {
      monitor.event({
        taskId: options.taskId,
        browserId: browserId(dirId),
        dirId,
        stage: 'error',
        toolName,
        input: monitorSafeInput(input),
        result: message,
        success: false,
        errorMessage: message,
        workerId: options.workerId,
        conversationId: options.conversationId,
        timestamp: Date.now(),
      })
    }
  }
}
