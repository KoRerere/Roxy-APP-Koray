import type { MessageBlock, PlanningState, ThinkingBlock, ToolCallStatus, WorkerThinking } from '../types'
import type { SvgNames } from '/@/components/rx-icon'

/**
 * 消息项组件共享逻辑
 */
export function useMessageItem() {
  // 记录已展开的 thinking blocks
  const expandedThinkingMap = ref<Record<string, boolean>>({})

  function toggleThinkingExpand(thinkingId: string) {
    expandedThinkingMap.value[thinkingId] = !expandedThinkingMap.value[thinkingId]
  }

  function isThinkingExpanded(thinkingId: string): boolean {
    return !!expandedThinkingMap.value[thinkingId]
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
 * 格式化 ThinkingBlock 的持续时间
 */
export function formatThinkingDuration(block: ThinkingBlock | WorkerThinking): string {
  return formatDuration(block.startTimestamp, block.endTimestamp)
}

/**
 * 格式化规划状态的持续时间
 */
export function formatPlanningDuration(state: PlanningState): string {
  return formatDuration(state.startTimestamp, state.endTimestamp)
}

/**
 * 获取消息块的唯一键
 */
export function getBlockKey(block: MessageBlock): string {
  switch (block.type) {
    case 'thinking':
      return `thinking:${block.thinkingId}`
    case 'content':
      return `content:${block.contentId}`
    case 'tool_call':
      return `tool_call:${block.toolId}`
  }
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
export function getStatusIconProps(status: ToolCallStatus) {
  return STATUS_ICON_CONFIG[status]
}
