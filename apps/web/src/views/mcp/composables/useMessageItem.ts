import type { MessageEntryView, PlanningState, ToolCallStatus } from '../types'
import type { MessageEntry } from '../types'
import type { SvgNames } from '/@/components/rx-icon'

/**
 * 消息项组件共享逻辑
 */
export function useMessageItem() {
  const expandedThinkingMap = ref<Record<string, boolean>>({})

  function toggleThinkingExpand(id: string) {
    expandedThinkingMap.value[id] = !expandedThinkingMap.value[id]
  }

  function isThinkingExpanded(id: string): boolean {
    return !!expandedThinkingMap.value[id]
  }

  return {
    expandedThinkingMap,
    toggleThinkingExpand,
    isThinkingExpanded,
  }
}

/**
 * 格式化时间戳间隔为秒数字符串
 */
export function formatDuration(startTimestamp?: number, endTimestamp?: number): string {
  if (!startTimestamp || !endTimestamp)
    return ''
  const durationMs = endTimestamp - startTimestamp
  const seconds = Math.floor(durationMs / 100) / 10
  return `${seconds}s`
}

/**
 * 格式化消息条目的持续时间（使用 start/end 字段）
 */
export function formatThinkingDuration(block: MessageEntry): string {
  return formatDuration(block.start, block.end)
}

/**
 * 格式化规划状态的持续时间
 */
export function formatPlanningDuration(state: PlanningState): string {
  return formatDuration(state.startTimestamp, state.endTimestamp)
}

/**
 * 获取消息条目的唯一键
 */
export function getBlockKey(block: MessageEntryView): string {
  return `${block.type}:${block.id}`
}

/**
 * 工具状态图标属性配置
 */
const STATUS_ICON_CONFIG: Record<ToolCallStatus, { class?: string, name: SvgNames, size?: number }> = {
  pending: { class: 'loading-circle tool-loading', name: 'base/rx_ic_spin', size: 14 },
  success: { class: 'tool-success', name: 'base/rx_ic_check' },
  failed: { class: 'tool-failed', name: 'base/rx_ic_delete' },
}

/**
 * 获取工具状态图标属性
 */
export function getStatusIconProps(status: ToolCallStatus | string | undefined) {
  return STATUS_ICON_CONFIG[(status as ToolCallStatus) ?? 'pending'] ?? STATUS_ICON_CONFIG.pending
}
