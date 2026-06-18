import { $t } from '/@/locales'

/**
 * deepagents 内置工具的友好文案映射（本项目实际暴露的 7 个）。
 * 其余工具（MCP 提供的，如 browser_click / roxy_*）走默认「正在使用工具」文案。
 */
const BUILTIN_TOOL_LABELS: Record<string, () => string> = {
  read_file: () => $t('读取文件'),
  write_file: () => $t('写入文件'),
  edit_file: () => $t('编辑文件'),
  ls: () => $t('浏览目录'),
  glob: () => $t('匹配文件'),
  grep: () => $t('搜索内容'),
  execute: () => $t('执行命令'),
}

/**
 * 根据工具调用的 meta 信息生成面向用户的友好文案。
 * 不同工具走不同分支：
 * - parallel_dispatch：正在创建 N 个并行任务（N 由后端注入 assignmentsCount）
 * - load_skill_file：正在加载 skill: <name>（name 由后端解析 skillName）
 * - 内置工具：各自映射文案
 * - 其他（MCP）：正在使用工具：<tool-name>
 */
export function getToolCallLabel(meta: Record<string, any> | undefined): string {
  const name = (meta?.toolName as string) || ''

  if (name === 'parallel_dispatch') {
    // 兼容老数据：未携带 assignmentsCount 字段时，回退到原始工具名显示
    if (meta?.assignmentsCount == null) {
      return name
    }
    return $t('创建 {count} 个并行任务', { count: meta.assignmentsCount as number })
  }

  if (name === 'load_skill_file') {
    // 兼容老数据：未携带 skillName 字段（或解析失败）时，回退到原始工具名显示
    const skillName = meta?.skillName as string | undefined
    if (!skillName) {
      return name
    }
    return $t('加载 skill: {name}', { name: skillName })
  }

  if (BUILTIN_TOOL_LABELS[name]) {
    return BUILTIN_TOOL_LABELS[name]()
  }

  return $t('使用工具：{name}', { name })
}
