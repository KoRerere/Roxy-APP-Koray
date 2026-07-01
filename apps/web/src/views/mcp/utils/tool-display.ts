import { $t } from '/@/locales'

/**
 * deepagents 内置工具的友好文案映射。
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
  list_scripts: () => $t('获取脚本列表'),
  run_script: () => $t('运行脚本'),
}

/**
 * 带操作目标（文件名/目录名/pattern/脚本名）的工具集合。
 * 命中且 meta.target 非空时，文案后拼接该目标；目标为用户/脚本数据（非 i18n 文本），故直接拼接不翻译。
 * execute 按需求不拼接 command（命令可能过长无法完整展示）；list_scripts 无参数，二者均不在此集合。
 */
const TOOLS_WITH_TARGET = new Set([
  'read_file',
  'write_file',
  'edit_file',
  'ls',
  'glob',
  'grep',
  'run_script',
])

/**
 * 根据工具调用的 meta 信息生成面向用户的友好文案。
 * 不同工具走不同分支：
 * - parallel_dispatch：正在创建 N 个并行任务（N 由后端注入 assignmentsCount）
 * - load_skill_file：正在加载 skill: <name>（name 由后端解析 skillName）
 * - 内置工具：各自映射文案；带目标的工具追加 meta.target（文件名/目录名/pattern/脚本名）
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
    // 优先展示「skill 名 + 文件相对路径」（如 tiktok-matrix-upload/references/harness.md），
    // 兼容老数据：未携带 skillFilePath 时回退到 skillName（仅目录名），再回退原始工具名
    const skillFilePath = meta?.skillFilePath as string | undefined
    if (skillFilePath) {
      return $t('加载 skill: {name}', { name: skillFilePath })
    }
    const skillName = meta?.skillName as string | undefined
    if (skillName) {
      return $t('加载 skill: {name}', { name: skillName })
    }
    return name
  }

  if (BUILTIN_TOOL_LABELS[name]) {
    const base = BUILTIN_TOOL_LABELS[name]()
    // 带目标的工具：后端注入 target 非空时拼接展示（缺失则回退纯文案，兼容历史回放）
    if (TOOLS_WITH_TARGET.has(name)) {
      const target = meta?.target
      if (typeof target === 'string' && target) {
        return `${base} ${target}`
      }
    }
    return base
  }

  return $t('使用工具：{name}', { name })
}
