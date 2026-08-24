import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import test from 'node:test'

function interpolate(value: string, options?: Record<string, unknown>): string {
  return value.replace(/\{(\w+)\}/g, (match, key) => String(options?.[key] ?? match))
}

const translate = (value: string, options?: Record<string, unknown>) => interpolate(value, options)
globalThis.$t = translate
const { friendlyToolName, readFileSkillName, friendlyMemoryToolGroupName } = await import('./toolName')

test('browser tools use action-specific labels after MCP namespace normalization', () => {
  globalThis.$t = translate
  assert.equal(friendlyToolName('browser_snapshot', 'running'), '正在读取页面')
  assert.equal(friendlyToolName('mcp_roxybrowser_playwright_chat_1__browser_snapshot', 'success'), '已读取页面')
  assert.equal(
    friendlyToolName('mcp_roxybrowser_playwright_chat_1__browser_navigate', 'running', { url: 'https://example.com/path?q=private' }),
    '正在打开网页 example.com',
  )
  assert.equal(
    friendlyToolName('browser_click', 'success', { element: '登录按钮', target: 'button[type="submit"]' }),
    '已点击页面元素 登录按钮',
  )
  assert.equal(
    friendlyToolName('browser_type', 'running', { element: '搜索框', text: '不应显示的输入内容' }),
    '正在输入内容 搜索框',
  )
  assert.equal(friendlyToolName('roxy_browser_connect', 'running'), '正在连接浏览器窗口')
  assert.equal(friendlyToolName('roxy_browser_launch', 'success'), '已启动浏览器窗口')
})

test('browser labels use tool parameters for tabs and waits without exposing typed text', () => {
  globalThis.$t = translate
  assert.equal(friendlyToolName('browser_tabs', 'running', { action: 'list' }), '正在获取标签页列表')
  assert.equal(
    friendlyToolName('browser_tabs', 'success', { action: 'new', url: 'https://docs.example.com/secret' }),
    '已打开新标签页 docs.example.com',
  )
  assert.equal(friendlyToolName('browser_tabs', 'success', { action: 'select', index: 2 }), '已切换标签页')
  assert.equal(friendlyToolName('browser_tabs', 'running', { action: 'close' }), '正在关闭标签页')
  assert.equal(friendlyToolName('browser_wait_for', 'running', { text: '支付成功' }), '正在等待页面内容 支付成功')
  assert.equal(friendlyToolName('browser_wait_for', 'success', { textGone: '加载中' }), '页面内容已消失 加载中')
  assert.equal(friendlyToolName('browser_wait_for', 'success', { time: 2 }), '已等待页面响应')
})

test('browser tool families and unknown browser tools have useful fallback labels', () => {
  globalThis.$t = translate
  assert.equal(friendlyToolName('browser_cookie_list', 'running'), '正在读取 Cookie')
  assert.equal(friendlyToolName('browser_cookie_set', 'success'), '已修改 Cookie')
  assert.equal(friendlyToolName('browser_network_requests', 'success'), '已读取网络请求')
  assert.equal(friendlyToolName('browser_localstorage_set', 'running'), '正在修改页面存储')
  assert.equal(friendlyToolName('browser_future_action', 'running'), '正在执行浏览器操作：browser_future_action')
  assert.equal(friendlyToolName('browser_future_action', 'success'), '已执行浏览器操作：browser_future_action')
})

test('web search tools use action-specific running and completed labels', () => {
  globalThis.$t = translate
  const searchAction = {
    type: 'search',
    queries: ['RoxyBrowser 价格', 'AdsPower 价格', 'ws_call_id=ws_1'],
  }
  assert.equal(
    friendlyToolName('web_search', 'running', searchAction),
    '正在搜索 “RoxyBrowser 价格” “AdsPower 价格”',
  )
  assert.equal(
    friendlyToolName('web_search', 'success', searchAction, { finished: true }),
    '已搜索 “RoxyBrowser 价格” “AdsPower 价格”',
  )
  assert.equal(
    friendlyToolName('web_search', 'running', {
      type: 'open_page',
      url: 'https://roxybrowser.cn/pricing?from=agent&ws_call_id=ws_2#ws_call_id=ws_2',
    }),
    '正在打开页面 https://roxybrowser.cn/pricing?from=agent',
  )
  assert.equal(
    friendlyToolName('web_search', 'success', {
      type: 'open_page',
      url: 'https://roxybrowser.cn/docs/#ws_call_id=ws_3',
    }, { finished: true }),
    '已打开页面 https://roxybrowser.cn/docs/',
  )
  const findInPageAction = {
    type: 'find_in_page',
    url: 'https://roxybrowser.cn/faqs#ws_call_id=ws_4',
    pattern: '普通浏览器',
  }
  assert.equal(
    friendlyToolName('web_search', 'running', findInPageAction),
    '正在页面 https://roxybrowser.cn/faqs 中搜索 "普通浏览器"',
  )
  assert.equal(
    friendlyToolName('web_search', 'success', findInPageAction, { finished: true }),
    '已在页面 https://roxybrowser.cn/faqs 中搜索 "普通浏览器"',
  )
})

test('current playwright tools all have explicit user-facing labels', () => {
  globalThis.$t = translate
  const toolNames = [
    'roxy_browser_connect',
    'roxy_browser_launch',
    'browser_get_config',
    'browser_close',
    'browser_resize',
    'browser_navigate',
    'browser_navigate_back',
    'browser_navigate_forward',
    'browser_reload',
    'browser_wait_for',
    'browser_snapshot',
    'browser_find',
    'browser_generate_locator',
    'browser_click',
    'browser_drag',
    'browser_hover',
    'browser_select_option',
    'browser_type',
    'browser_press_key',
    'browser_press_sequentially',
    'browser_keydown',
    'browser_keyup',
    'browser_fill_form',
    'browser_check',
    'browser_uncheck',
    'browser_file_upload',
    'browser_drop',
    'browser_take_screenshot',
    'browser_pdf_save',
    'browser_tabs',
    'browser_handle_dialog',
    'browser_evaluate',
    'browser_run_code_unsafe',
    'browser_console_messages',
    'browser_console_clear',
    'browser_cookie_list',
    'browser_cookie_get',
    'browser_cookie_set',
    'browser_cookie_delete',
    'browser_cookie_clear',
    'browser_storage_state',
    'browser_set_storage_state',
    'browser_localstorage_list',
    'browser_localstorage_get',
    'browser_localstorage_set',
    'browser_localstorage_delete',
    'browser_localstorage_clear',
    'browser_sessionstorage_list',
    'browser_sessionstorage_get',
    'browser_sessionstorage_set',
    'browser_sessionstorage_delete',
    'browser_sessionstorage_clear',
    'browser_network_requests',
    'browser_network_request',
    'browser_network_clear',
    'browser_network_state_set',
    'browser_route',
    'browser_route_list',
    'browser_unroute',
    'browser_start_tracing',
    'browser_stop_tracing',
    'browser_mouse_move_xy',
    'browser_mouse_click_xy',
    'browser_mouse_drag_xy',
    'browser_verify_element_visible',
    'browser_verify_text_visible',
    'browser_verify_list_visible',
    'browser_verify_value',
  ]

  for (const toolName of toolNames) {
    const label = friendlyToolName(`mcp_roxybrowser_playwright_worker-1__${toolName}`, 'running')
    assert.doesNotMatch(label, /控制浏览器|浏览器操作：/, toolName)
  }
})

test('special tool labels match current tool names by contained local name', () => {
  globalThis.$t = translate
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_profile_list', 'running'), '获取窗口列表')
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_profile_get', 'success'), '已获取窗口详情')
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_profile_open', 'running'), '打开窗口')
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_proxy_get', 'success'), '已获取代理 IP 详情')
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_proxy_update', 'running'), '修改代理 IP')
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_proxy_detect_channels', 'success'), '已获取代理检测通道')
  assert.equal(friendlyToolName('mcp_roxybrowser_openapi__roxy_platform_account_list', 'success'), '已获取平台账号列表')
  assert.equal(
    friendlyToolName('exec_command', 'running', { cmd: 'pnpm test\n  --runInBand' }),
    '正在执行命令 pnpm test --runInBand',
  )
  assert.equal(
    friendlyToolName('exec_command', 'success', { cmd: 'pnpm build' }),
    '已执行命令 pnpm build',
  )
  assert.equal(
    friendlyToolName('exec_command', 'success', { cmd: 'pnpm build' }, { finished: false }),
    '正在执行命令 pnpm build',
  )
  assert.equal(friendlyToolName('update_plan', 'running'), '正在更新计划')
  assert.equal(friendlyToolName('update_plan', 'success'), '已更新计划')
  assert.equal(friendlyToolName('todo_read', 'running'), '正在读取待办事项')
  assert.equal(friendlyToolName('todo_read', 'success'), '已读取待办事项')
  assert.equal(
    friendlyToolName('update_plan', 'success', undefined, { finished: false }),
    '正在更新计划',
  )
  assert.equal(friendlyToolName('unknown_tool', 'running'), '使用工具：unknown_tool')
  assert.equal(friendlyToolName('get_tools', 'running'), '使用工具：get_tools')

  globalThis.$t = (value, options) => `[${interpolate(value, options)}]`
  assert.equal(friendlyToolName('unknown_tool', 'running'), '[使用工具：unknown_tool]')
})

test('roxybrowser openapi labels match the current browser preset tool names', () => {
  globalThis.$t = translate
  const cases: Array<[string, string, string]> = [
    ['roxy_workspace_list', '获取工作区列表', '已获取工作区列表'],
    ['roxy_project_list', '获取项目列表', '已获取项目列表'],
    ['roxy_label_list', '获取标签列表', '已获取标签列表'],
    ['roxy_profile_list', '获取窗口列表', '已获取窗口列表'],
    ['roxy_profile_get', '获取窗口详情', '已获取窗口详情'],
    ['roxy_profile_create', '创建窗口', '已创建窗口'],
    ['roxy_profile_update', '修改窗口', '已修改窗口'],
    ['roxy_profile_open', '打开窗口', '已打开窗口'],
    ['roxy_profile_close', '关闭窗口', '已关闭窗口'],
    ['roxy_profile_delete', '删除窗口', '已删除窗口'],
    ['roxy_profile_connection_info', '获取窗口连接信息', '已获取窗口连接信息'],
    ['roxy_profile_randomize_fingerprint', '随机生成窗口指纹', '已随机生成窗口指纹'],
    ['roxy_profile_clear_local_cache', '清理窗口本地缓存', '已清理窗口本地缓存'],
    ['roxy_profile_clear_server_cache', '清理窗口云端缓存', '已清理窗口云端缓存'],
    ['roxy_proxy_list', '获取代理 IP 列表', '已获取代理 IP 列表'],
    ['roxy_proxy_get', '获取代理 IP 详情', '已获取代理 IP 详情'],
    ['roxy_proxy_create', '创建代理 IP', '已创建代理 IP'],
    ['roxy_proxy_update', '修改代理 IP', '已修改代理 IP'],
    ['roxy_proxy_delete', '删除代理 IP', '已删除代理 IP'],
    ['roxy_proxy_detect', '检测代理 IP', '已检测代理 IP'],
    ['roxy_proxy_detect_channels', '获取代理检测通道', '已获取代理检测通道'],
    ['roxy_platform_account_list', '获取平台账号列表', '已获取平台账号列表'],
    ['roxy_platform_account_create', '创建平台账号', '已创建平台账号'],
    ['roxy_platform_account_update', '修改平台账号', '已修改平台账号'],
    ['roxy_platform_account_delete', '删除平台账号', '已删除平台账号'],
  ]

  for (const [toolName, running, completed] of cases) {
    assert.equal(friendlyToolName(`mcp_roxybrowser_openapi__${toolName}`, 'running'), running)
    assert.equal(friendlyToolName(`mcp_roxybrowser_openapi__${toolName}`, 'success'), completed)
  }
})

test('read_file uses localized running and completed labels with the file basename', () => {
  const localized = (value: string) => `[${value}]`
  globalThis.$t = localized

  assert.equal(
    friendlyToolName('read_file', 'running', { path: 'relative/report.txt' }),
    '[正在读取文件] report.txt',
  )
  assert.equal(
    friendlyToolName('read_file', 'success', { path: '/tmp/report.txt' }),
    '[已读取文件] report.txt',
  )
  assert.equal(
    friendlyToolName('read_file', 'success', { path: '/tmp/ignored.txt' }, { target: 'C:\\reports\\sandbox-api.d.ts' }),
    '[已读取文件] sandbox-api.d.ts',
  )
  assert.equal(
    friendlyToolName('read_file', 'success', { path: 'pending.txt' }, { finished: false }),
    '[正在读取文件] pending.txt',
  )
})

test('read_file renders skill loads when reading a skill markdown entry', () => {
  const localized = (value: string) => `[${value}]`
  globalThis.$t = localized

  assert.equal(
    friendlyToolName('read_file', 'success', { path: '/skills/roxybrowser-playwright-skills/SKILL.md' }),
    '[加载 skill]：roxybrowser-playwright-skills',
  )
  assert.equal(
    friendlyToolName('read_file', 'running', { path: '/skills/automation-script-writing/skill.md' }),
    '[加载 skill]：automation-script-writing',
  )
  assert.equal(
    friendlyToolName('read_file', 'success', { path: '/tmp/ignored.md' }, { target: 'C:\\skills\\legacy-skills\\Skill.md' }),
    '[加载 skill]：legacy-skills',
  )

  assert.equal(readFileSkillName('/skills/not-skill/skills.md'), undefined)
})

test('apply_patch labels preserve single-file paths and collapse multi-file patches', () => {
  globalThis.$t = translate
  assert.equal(
    friendlyToolName('apply_patch', 'running', '*** Begin Patch\n*** Add File: /tmp/new.txt\n+new\n*** End Patch'),
    '正在创建文件 /tmp/new.txt',
  )
  assert.equal(
    friendlyToolName('apply_patch', 'success', { operation: { type: 'update_file', path: 'src/app.ts' } }),
    '已修改文件 src/app.ts',
  )
  assert.equal(
    friendlyToolName('apply_patch', 'running', undefined, { patchType: 'delete', target: 'C:\\reports\\old.txt' }),
    '正在删除文件 C:\\reports\\old.txt',
  )
  assert.equal(
    friendlyToolName('apply_patch', 'success', '*** Begin Patch\n*** Add File: a.txt\n+a\n*** Delete File: b.txt\n*** End Patch'),
    '已更新多个文件',
  )
  assert.equal(
    friendlyToolName('apply_patch', 'success', undefined, { patchType: 'create', target: 'pending.txt', finished: false }),
    '正在创建文件 pending.txt',
  )
  assert.equal(
    friendlyToolName('apply_patch', 'success', undefined, { patchType: 'create', target: 'done.txt', finished: true }),
    '已创建文件 done.txt',
  )
})

test('memory entry tools use action labels and exclude MEMORY.md from the count', () => {
  globalThis.$t = translate

  assert.equal(
    friendlyToolName('read_file', 'running', { path: '/Users/test/.roxy-agent/memory/browser-workflow.md' }),
    '正在读取 1 条记忆',
  )
  assert.equal(
    friendlyToolName('read_file', 'success', { path: 'C:\\Users\\test\\.roxy-agent-dev\\memory\\browser-workflow.md' }),
    '已读取 1 条记忆',
  )
  assert.equal(
    friendlyToolName('read_file', 'success', { path: '/Users/test/.roxy-agent//memory/browser-workflow.md' }),
    '已读取 1 条记忆',
  )
  assert.equal(
    friendlyToolName('write_file', 'running', { path: '/Users/test/.roxy-agent-dev/memory/new-fact.md', content: 'fact' }),
    '正在写入 1 条记忆',
  )
  assert.equal(
    friendlyToolName('write_file', 'success', { path: '/Users/test/.roxy-agent-dev/memory/new-fact.md', content: 'fact' }),
    '已写入 1 条记忆',
  )
  assert.equal(
    friendlyToolName('edit_file', 'running', { path: '/Users/test/.roxy-agent/memory/existing-fact.md' }),
    '正在更新 1 条记忆',
  )
  assert.equal(
    friendlyToolName('edit_file', 'success', { path: '/Users/test/.roxy-agent/memory/existing-fact.md' }),
    '已更新 1 条记忆',
  )

  const createPatch = [
    '*** Begin Patch',
    '*** Add File: /Users/test/.roxy-agent/memory/first-memory.md',
    '+first',
    '*** Add File: /Users/test/.roxy-agent/memory/second-memory.md',
    '+second',
    '*** Update File: /Users/test/.roxy-agent/memory/MEMORY.md',
    '@@',
    ' old',
    '+new',
    '*** End Patch',
  ].join('\n')
  assert.equal(friendlyToolName('apply_patch', 'running', createPatch), '正在写入 2 条记忆')

  const updatePatch = [
    '*** Begin Patch',
    '*** Update File: /Users/test/.roxy-agent-dev/memory/existing-fact.md',
    '@@',
    '-old',
    '+new',
    '*** Update File: /Users/test/.roxy-agent-dev/memory/MEMORY.md',
    '@@',
    '-old index',
    '+new index',
    '*** End Patch',
  ].join('\n')
  assert.equal(friendlyToolName('apply_patch', 'success', updatePatch), '已更新 1 条记忆')

  assert.equal(
    friendlyToolName('read_file', 'running', { path: '/Users/test/project/memory/MEMORY.md' }),
    '正在读取文件 /Users/test/project/memory/MEMORY.md',
  )
})

test('memory group labels add counts only for consecutive operations of the same action', () => {
  globalThis.$t = translate

  assert.equal(
    friendlyMemoryToolGroupName([
      {
        toolName: 'read_file',
        status: 'success',
        finished: true,
        input: { path: '/Users/test/.roxy-agent/memory/first-memory.md' },
      },
      {
        toolName: 'read_file',
        status: 'success',
        finished: true,
        input: { path: '/Users/test/.roxy-agent/memory/second-memory.md' },
      },
    ]),
    '已读取 2 条记忆',
  )
  assert.equal(
    friendlyMemoryToolGroupName([
      {
        toolName: 'read_file',
        status: 'success',
        finished: true,
        input: { path: '/Users/test/.roxy-agent/memory/first-memory.md' },
      },
      {
        toolName: 'read_file',
        status: 'running',
        finished: false,
        input: { path: '/Users/test/.roxy-agent/memory/second-memory.md' },
      },
    ]),
    '正在读取 2 条记忆',
  )
  assert.equal(
    friendlyMemoryToolGroupName([
      {
        toolName: 'read_file',
        status: 'success',
        finished: true,
        input: { path: '/Users/test/.roxy-agent/memory/first-memory.md' },
      },
      {
        toolName: 'edit_file',
        status: 'success',
        finished: true,
        input: { path: '/Users/test/.roxy-agent/memory/second-memory.md' },
      },
    ]),
    undefined,
  )
})

test('subagent tools use dedicated running and completed labels', () => {
  globalThis.$t = translate
  assert.equal(
    friendlyToolName('spawn_agent', 'running', { name: 'browser_worker' }),
    '正在创建智能体 browser_worker',
  )
  assert.equal(
    friendlyToolName('spawn_agent', 'success', { name: ' browser_worker ' }),
    '已创建智能体 browser_worker',
  )
  assert.equal(friendlyToolName('spawn_agent', 'running'), '正在创建智能体')
  assert.equal(friendlyToolName('list_agents', 'running'), '正在列出智能体')
  assert.equal(friendlyToolName('list_agents', 'success'), '已列出智能体')
  assert.equal(friendlyToolName('wait_agent', 'running'), '正在等待智能体完成工作')
  assert.equal(friendlyToolName('wait_agent', 'success'), '智能体已完成工作')
})
