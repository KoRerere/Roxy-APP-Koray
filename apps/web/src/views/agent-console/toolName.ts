import type { MemoryToolAction, MemoryToolEventLike } from './memoryToolPresentation'
import { getMemoryToolPresentation, summarizeMemoryToolEvents } from './memoryToolPresentation'
import { getWebSearchToolPresentation } from './webSearchToolPresentation'

/** Return the MCP server-local tool name used for user-facing labels. */
export function originalToolName(toolName: string): string {
  return toolName.split('__').at(-1) || toolName
}

type ApplyPatchType = 'create' | 'update' | 'delete' | 'mixed'

interface ToolLabelMetadata {
  finished?: boolean
  patchType?: ApplyPatchType
  target?: string
}

function spawnAgentName(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const name = (input as Record<string, unknown>).name
  return typeof name === 'string' && name.trim() ? name.trim() : undefined
}

const SPECIAL_TOOL_LABELS: Array<[string, string, string]> = [
  ['update_plan', $t('正在更新计划'), $t('已更新计划')],
  ['todo_read', $t('正在读取待办事项'), $t('已读取待办事项')],
  ['ask_user', $t('正在询问用户'), $t('已询问用户')],
  ['glob', $t('匹配文件'), $t('已匹配文件')],
  ['grep', $t('搜索内容'), $t('已搜索内容')],
  ['roxy_script_run', $t('运行脚本'), $t('已运行脚本')],
  ['roxy_script_describe', $t('获取脚本详情信息'), $t('已获取脚本详情信息')],
  ['roxy_workspace_list', $t('获取工作区列表'), $t('已获取工作区列表')],
  ['roxy_project_list', $t('获取项目列表'), $t('已获取项目列表')],
  ['roxy_label_list', $t('获取标签列表'), $t('已获取标签列表')],
  ['roxy_profile_connection_info', $t('获取窗口连接信息'), $t('已获取窗口连接信息')],
  ['roxy_profile_randomize_fingerprint', $t('随机生成窗口指纹'), $t('已随机生成窗口指纹')],
  ['roxy_profile_clear_local_cache', $t('清理窗口本地缓存'), $t('已清理窗口本地缓存')],
  ['roxy_profile_clear_server_cache', $t('清理窗口云端缓存'), $t('已清理窗口云端缓存')],
  ['roxy_profile_list', $t('获取窗口列表'), $t('已获取窗口列表')],
  ['roxy_profile_get', $t('获取窗口详情'), $t('已获取窗口详情')],
  ['roxy_profile_create', $t('创建窗口'), $t('已创建窗口')],
  ['roxy_profile_update', $t('修改窗口'), $t('已修改窗口')],
  ['roxy_profile_open', $t('打开窗口'), $t('已打开窗口')],
  ['roxy_profile_close', $t('关闭窗口'), $t('已关闭窗口')],
  ['roxy_profile_delete', $t('删除窗口'), $t('已删除窗口')],
  ['roxy_proxy_detect_channels', $t('获取代理 IP 检测通道'), $t('已获取代理 IP 检测通道')],
  ['roxy_proxy_list', $t('获取代理 IP 列表'), $t('已获取代理 IP 列表')],
  ['roxy_proxy_get', $t('获取代理 IP 详情'), $t('已获取代理 IP 详情')],
  ['roxy_proxy_create', $t('创建代理 IP'), $t('已创建代理 IP')],
  ['roxy_proxy_update', $t('修改代理 IP'), $t('已修改代理 IP')],
  ['roxy_proxy_delete', $t('删除代理 IP'), $t('已删除代理 IP')],
  ['roxy_proxy_detect', $t('检测代理 IP'), $t('已检测代理 IP')],
  ['roxy_platform_account_list', $t('获取平台账号列表'), $t('已获取平台账号列表')],
  ['roxy_platform_account_create', $t('创建平台账号'), $t('已创建平台账号')],
  ['roxy_platform_account_update', $t('修改平台账号'), $t('已修改平台账号')],
  ['roxy_platform_account_delete', $t('删除平台账号'), $t('已删除平台账号')],
]

type ToolLabelPair = readonly [running: string, completed: string]

const TEMPLATE_TOOL_LABELS: Record<string, ToolLabelPair> = {
  roxy_read_template_info: [$t('正在获取模板详情'), $t('已获取模板详情')],
  roxy_save_user_template: [$t('正在保存用户模板'), $t('已保存用户模板')],
  roxy_delete_user_template: [$t('正在删除用户模板'), $t('已删除用户模板')],
}

const BROWSER_TOOL_LABELS: Record<string, ToolLabelPair> = {
  roxy_browser_connect: [$t('正在连接浏览器窗口'), $t('已连接浏览器窗口')],
  roxy_browser_launch: [$t('正在启动浏览器窗口'), $t('已启动浏览器窗口')],
  browser_get_config: [$t('正在读取浏览器配置'), $t('已读取浏览器配置')],
  browser_close: [$t('正在关闭浏览器'), $t('已关闭浏览器')],
  browser_resize: [$t('正在调整浏览器窗口大小'), $t('已调整浏览器窗口大小')],
  browser_navigate: [$t('正在打开网页'), $t('已打开网页')],
  browser_navigate_back: [$t('正在返回上一页'), $t('已返回上一页')],
  browser_navigate_forward: [$t('正在前往下一页'), $t('已前往下一页')],
  browser_reload: [$t('正在刷新页面'), $t('已刷新页面')],
  browser_wait_for: [$t('正在等待页面响应'), $t('已等待页面响应')],
  browser_snapshot: [$t('正在读取页面'), $t('已读取页面')],
  browser_find: [$t('正在查找页面元素'), $t('已查找页面元素')],
  browser_generate_locator: [$t('正在定位页面元素'), $t('已定位页面元素')],
  browser_click: [$t('正在点击页面元素'), $t('已点击页面元素')],
  browser_drag: [$t('正在拖动页面元素'), $t('已拖动页面元素')],
  browser_hover: [$t('正在悬停页面元素'), $t('已悬停页面元素')],
  browser_select_option: [$t('正在选择页面选项'), $t('已选择页面选项')],
  browser_type: [$t('正在输入内容'), $t('已输入内容')],
  browser_press_key: [$t('正在按下键盘按键'), $t('已按下键盘按键')],
  browser_press_sequentially: [$t('正在逐字输入内容'), $t('已逐字输入内容')],
  browser_keydown: [$t('正在按住键盘按键'), $t('已按住键盘按键')],
  browser_keyup: [$t('正在松开键盘按键'), $t('已松开键盘按键')],
  browser_fill_form: [$t('正在填写页面表单'), $t('已填写页面表单')],
  browser_check: [$t('正在勾选页面选项'), $t('已勾选页面选项')],
  browser_uncheck: [$t('正在取消勾选页面选项'), $t('已取消勾选页面选项')],
  browser_file_upload: [$t('正在上传文件'), $t('已上传文件')],
  browser_drop: [$t('正在拖放文件'), $t('已拖放文件')],
  browser_take_screenshot: [$t('正在截取页面'), $t('已截取页面')],
  browser_pdf_save: [$t('正在保存页面 PDF'), $t('已保存页面 PDF')],
  browser_tabs: [$t('正在管理标签页'), $t('已管理标签页')],
  browser_handle_dialog: [$t('正在处理页面弹窗'), $t('已处理页面弹窗')],
  browser_evaluate: [$t('正在读取页面数据'), $t('已读取页面数据')],
  browser_run_code_unsafe: [$t('正在执行页面代码'), $t('已执行页面代码')],
  browser_console_messages: [$t('正在读取浏览器日志'), $t('已读取浏览器日志')],
  browser_console_clear: [$t('正在清理浏览器日志'), $t('已清理浏览器日志')],
  browser_cookie_list: [$t('正在读取 Cookie'), $t('已读取 Cookie')],
  browser_cookie_get: [$t('正在读取 Cookie'), $t('已读取 Cookie')],
  browser_cookie_set: [$t('正在修改 Cookie'), $t('已修改 Cookie')],
  browser_cookie_delete: [$t('正在修改 Cookie'), $t('已修改 Cookie')],
  browser_cookie_clear: [$t('正在修改 Cookie'), $t('已修改 Cookie')],
  browser_storage_state: [$t('正在读取页面存储'), $t('已读取页面存储')],
  browser_set_storage_state: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_localstorage_list: [$t('正在读取页面存储'), $t('已读取页面存储')],
  browser_localstorage_get: [$t('正在读取页面存储'), $t('已读取页面存储')],
  browser_localstorage_set: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_localstorage_delete: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_localstorage_clear: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_sessionstorage_list: [$t('正在读取页面存储'), $t('已读取页面存储')],
  browser_sessionstorage_get: [$t('正在读取页面存储'), $t('已读取页面存储')],
  browser_sessionstorage_set: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_sessionstorage_delete: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_sessionstorage_clear: [$t('正在修改页面存储'), $t('已修改页面存储')],
  browser_network_requests: [$t('正在读取网络请求'), $t('已读取网络请求')],
  browser_network_request: [$t('正在读取网络请求'), $t('已读取网络请求')],
  browser_network_clear: [$t('正在清理网络请求记录'), $t('已清理网络请求记录')],
  browser_network_state_set: [$t('正在修改浏览器网络状态'), $t('已修改浏览器网络状态')],
  browser_route: [$t('正在设置网络请求规则'), $t('已设置网络请求规则')],
  browser_route_list: [$t('正在读取网络请求规则'), $t('已读取网络请求规则')],
  browser_unroute: [$t('正在移除网络请求规则'), $t('已移除网络请求规则')],
  browser_start_tracing: [$t('正在开始记录浏览器操作'), $t('已开始记录浏览器操作')],
  browser_stop_tracing: [$t('正在停止记录浏览器操作'), $t('已停止记录浏览器操作')],
  browser_mouse_move_xy: [$t('正在移动鼠标'), $t('已移动鼠标')],
  browser_mouse_click_xy: [$t('正在点击页面坐标'), $t('已点击页面坐标')],
  browser_mouse_drag_xy: [$t('正在拖动页面坐标'), $t('已拖动页面坐标')],
  browser_verify_element_visible: [$t('正在检查页面元素'), $t('已检查页面元素')],
  browser_verify_text_visible: [$t('正在检查页面文本'), $t('已检查页面文本')],
  browser_verify_list_visible: [$t('正在检查页面列表'), $t('已检查页面列表')],
  browser_verify_value: [$t('正在检查页面值'), $t('已检查页面值')],
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function inputString(input: unknown, key: string): string | undefined {
  const value = asRecord(input)[key]
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return undefined
  }
  return normalized.length > 80 ? `${normalized.slice(0, 79)}…` : normalized
}

function inputUrlHost(input: unknown): string | undefined {
  const value = inputString(input, 'url')
  if (!value) {
    return undefined
  }
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
    return url.host || (url.protocol === 'about:' ? value : undefined)
  }
  catch {
    return undefined
  }
}

function withToolTarget(label: string, target: string | undefined): string {
  return target ? `${label} ${target}` : label
}

function templateToolLabel(toolName: string, completed: boolean, input: unknown): string | undefined {
  if (toolName === 'roxy_list_templates') {
    const scope = inputString(input, 'scope')
    if (scope === 'official') {
      return completed ? $t('已获取官方模板列表') : $t('正在获取官方模板列表')
    }
    if (scope === 'user') {
      return completed ? $t('已获取用户模板列表') : $t('正在获取用户模板列表')
    }
    return undefined
  }

  const labels = TEMPLATE_TOOL_LABELS[toolName]
  return labels ? labels[completed ? 1 : 0] : undefined
}

function browserTabsLabel(completed: boolean, input: unknown): string {
  const action = inputString(input, 'action')
  if (action === 'list') {
    return completed ? $t('已获取标签页列表') : $t('正在获取标签页列表')
  }
  if (action === 'new') {
    const label = completed ? $t('已打开新标签页') : $t('正在打开新标签页')
    return withToolTarget(label, inputUrlHost(input))
  }
  if (action === 'select') {
    return completed ? $t('已切换标签页') : $t('正在切换标签页')
  }
  if (action === 'close') {
    return completed ? $t('已关闭标签页') : $t('正在关闭标签页')
  }
  return completed ? $t('已管理标签页') : $t('正在管理标签页')
}

function browserWaitLabel(completed: boolean, input: unknown): string {
  const textGone = inputString(input, 'textGone')
  if (textGone) {
    return withToolTarget(completed ? $t('页面内容已消失') : $t('正在等待页面内容消失'), textGone)
  }
  const text = inputString(input, 'text')
  if (text) {
    return withToolTarget(completed ? $t('页面内容已出现') : $t('正在等待页面内容'), text)
  }
  return completed ? $t('已等待页面响应') : $t('正在等待页面响应')
}

function browserToolLabel(displayName: string, completed: boolean, input: unknown): string | undefined {
  if (!displayName.startsWith('browser_') && !displayName.startsWith('roxy_browser_')) {
    return undefined
  }
  if (displayName === 'browser_tabs') {
    return browserTabsLabel(completed, input)
  }
  if (displayName === 'browser_wait_for') {
    return browserWaitLabel(completed, input)
  }

  const labels = BROWSER_TOOL_LABELS[displayName]
  if (labels) {
    const label = labels[completed ? 1 : 0]
    if (displayName === 'browser_navigate') {
      return withToolTarget(label, inputUrlHost(input))
    }
    if (displayName === 'browser_click' || displayName === 'browser_hover' || displayName === 'browser_select_option' || displayName === 'browser_type') {
      return withToolTarget(label, inputString(input, 'element'))
    }
    return label
  }

  return completed
    ? $t('已执行浏览器操作：{name}', { name: displayName })
    : $t('正在执行浏览器操作：{name}', { name: displayName })
}

function inputPath(input: unknown): string | undefined {
  const path = asRecord(input).path
  return typeof path === 'string' && path ? path : undefined
}

function pathBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path
}

function pathSegments(path: string): string[] {
  return path.split(/[\\/]/).filter(Boolean)
}

export function readFileSkillName(path: string | undefined): string | undefined {
  if (!path) {
    return undefined
  }

  const segments = pathSegments(path)
  const filename = segments.at(-1)
  if (!filename) {
    return undefined
  }

  const extensionIndex = filename.lastIndexOf('.')
  const stem = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename
  const extension = extensionIndex >= 0 ? filename.slice(extensionIndex).toLowerCase() : ''
  if (stem.toUpperCase() !== 'SKILL' || extension !== '.md') {
    return undefined
  }

  const directoryName = segments.at(-2)
  if (!directoryName) {
    return undefined
  }

  return directoryName
}

function inputCommand(input: unknown): string | undefined {
  const command = asRecord(input).cmd
  if (typeof command !== 'string') {
    return undefined
  }

  const normalized = command.trim().replace(/\s+/g, ' ')
  return normalized || undefined
}

function applyPatchMetadata(input: unknown): ToolLabelMetadata {
  const record = asRecord(input)
  const operation = asRecord(record.operation)
  const operationType = operation.type
  const operationPath = operation.path
  if (typeof operationType === 'string' && typeof operationPath === 'string' && operationPath) {
    const patchType = operationType === 'create_file'
      ? 'create'
      : operationType === 'update_file'
        ? 'update'
        : operationType === 'delete_file'
          ? 'delete'
          : undefined
    return patchType ? { patchType, target: operationPath } : { patchType: 'mixed' }
  }

  const patch = typeof input === 'string' ? input : typeof record.patch === 'string' ? record.patch : ''
  const operations: Array<{ patchType: Exclude<ApplyPatchType, 'mixed'>, target: string }> = []
  for (const line of patch.split(/\r?\n/)) {
    const match = /^\*\*\* (Add File|Update File|Delete File): (.+)$/.exec(line)
    if (!match) {
      continue
    }

    const patchType = match[1] === 'Add File' ? 'create' : match[1] === 'Update File' ? 'update' : 'delete'
    operations.push({ patchType, target: match[2]!.trim() })
  }

  return operations.length === 1 ? operations[0]! : { patchType: 'mixed' }
}

function applyPatchLabel(
  status: string | undefined,
  input: unknown,
  metadata: ToolLabelMetadata,
): string {
  const completed = status === 'success' && metadata.finished !== false
  const resolved = metadata.patchType ? metadata : applyPatchMetadata(input)
  if (resolved.patchType === 'mixed') {
    return completed ? $t('已更新多个文件') : $t('正在更新多个文件')
  }

  const labels = {
    create: completed ? $t('已创建文件') : $t('正在创建文件'),
    update: completed ? $t('已修改文件') : $t('正在修改文件'),
    delete: completed ? $t('已删除文件') : $t('正在删除文件'),
  } as const
  const label = labels[resolved.patchType ?? 'update']
  const target = metadata.target || resolved.target
  return target ? `${label} ${target}` : label
}

function friendlyMemoryToolName(action: MemoryToolAction, count: number, completed: boolean): string {
  if (action === 'read') {
    return completed
      ? $t('已读取 {n} 条记忆', { n: count })
      : $t('正在读取 {n} 条记忆', { n: count })
  }
  if (action === 'write') {
    return completed
      ? $t('已写入 {n} 条记忆', { n: count })
      : $t('正在写入 {n} 条记忆', { n: count })
  }
  return completed
    ? $t('已更新 {n} 条记忆', { n: count })
    : $t('正在更新 {n} 条记忆', { n: count })
}

function friendlyWebSearchToolName(completed: boolean, input: unknown): string | undefined {
  const presentation = getWebSearchToolPresentation(input)
  if (presentation?.action === 'search') {
    if (presentation.queries.length === 0) {
      return completed ? $t('已搜索') : $t('正在搜索')
    }
    const queries = presentation.queries.map(query => `“${query}”`).join(' ')
    return completed
      ? $t('已搜索 {queries}', { queries })
      : $t('正在搜索 {queries}', { queries })
  }
  if (presentation?.action === 'open_page') {
    return completed
      ? $t('已打开页面 {url}', { url: presentation.url })
      : $t('正在打开页面 {url}', { url: presentation.url })
  }
  if (presentation?.action === 'find_in_page') {
    return completed
      ? $t('已在页面 {url} 中搜索 "{keyword}"', { url: presentation.url, keyword: presentation.pattern })
      : $t('正在页面 {url} 中搜索 "{keyword}"', { url: presentation.url, keyword: presentation.pattern })
  }
  return undefined
}

export function friendlyMemoryToolGroupName(events: MemoryToolEventLike[]): string | undefined {
  const summary = summarizeMemoryToolEvents(events)
  return summary
    ? friendlyMemoryToolName(summary.action, summary.count, summary.completed)
    : undefined
}

export function friendlyToolName(
  toolName: string,
  status: string | undefined,
  input?: unknown,
  metadata: ToolLabelMetadata = {},
): string {
  const displayName = originalToolName(toolName)
  const completed = status === 'success' && metadata.finished !== false
  const memoryPresentation = getMemoryToolPresentation(toolName, input, metadata)
  if (memoryPresentation?.kind === 'entries') {
    return friendlyMemoryToolName(memoryPresentation.action, memoryPresentation.count, completed)
  }
  if (displayName === 'apply_patch') {
    return applyPatchLabel(status, input, metadata)
  }
  if (displayName === 'spawn_agent') {
    const label = completed ? $t('已创建智能体') : $t('正在创建智能体')
    const agentName = spawnAgentName(input)
    return agentName ? `${label} ${agentName}` : label
  }
  if (displayName === 'list_agents') {
    return completed ? $t('已列出智能体') : $t('正在列出智能体')
  }
  if (displayName === 'wait_agent') {
    return completed ? $t('智能体已完成工作') : $t('正在等待智能体完成工作')
  }
  if (displayName === 'read_file') {
    const target = metadata.target || inputPath(input)
    const skillName = readFileSkillName(target)
    if (skillName) {
      return `${$t('加载 skill')}：${skillName}`
    }

    const label = completed ? $t('已读取文件') : $t('正在读取文件')
    return target ? `${label} ${pathBasename(target)}` : label
  }
  if (displayName === 'exec_command') {
    const label = completed ? $t('已执行命令') : $t('正在执行命令')
    const command = inputCommand(input)
    return command ? `${label} ${command}` : label
  }
  if (displayName === 'web_search') {
    const label = friendlyWebSearchToolName(completed, input)
    if (label) {
      return label
    }
  }
  const templateLabel = templateToolLabel(displayName, completed, input)
  if (templateLabel) {
    return templateLabel
  }
  const browserLabel = browserToolLabel(displayName, completed, input)
  if (browserLabel) {
    return browserLabel
  }
  if (displayName === 'ls') {
    return status === 'success' ? $t('已浏览目录') : $t('浏览目录')
  }

  const label = SPECIAL_TOOL_LABELS.find(([name]) => displayName.includes(name))
  if (label) {
    return completed ? label[2] : label[1]
  }

  return $t('使用工具：{name}', { name: displayName })
}
