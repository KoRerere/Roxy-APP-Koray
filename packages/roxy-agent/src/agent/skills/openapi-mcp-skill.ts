export const browserSkill = {
  name: 'roxy_browser_skill',
  description: 'RoxyBrowser 浏览器管理技能',
  content: `
# RoxyBrowser 浏览器管理技能

本技能包含 RoxyBrowser 浏览器的完整生命周期管理功能，包括创建、查询、打开、修改、关闭和删除浏览器等操作。

## 可用工具

### roxy_create_browser
创建一个新的浏览器配置。可以配置名称、操作系统、浏览器内核版本、代理、指纹信息、平台账号等。

### roxy_batch_create_browsers
批量创建多个浏览器配置。返回每个浏览器的创建结果（成功或失败）。

### roxy_update_browser
更新浏览器配置。可以修改浏览器的所有配置项。

### roxy_open_browsers
打开一个或多个浏览器并返回其 CDP WebSocket 端点。返回的 CDP 端点可用于 Playwright 等自动化工具连接。

### roxy_list_browsers
获取当前工作空间/项目中的浏览器列表。支持按项目、窗口名称过滤，支持分页查询。

### roxy_close_browsers
关闭一个或多个浏览器实例。

### roxy_delete_browsers
删除一个或多个浏览器配置。

### roxy_get_browser_detail
获取特定浏览器的详细信息，包括配置、状态、项目信息等。

### roxy_clear_local_cache
清除指定浏览器的本地缓存文件。

### roxy_clear_server_cache
清除指定浏览器的服务器端缓存。

### roxy_random_fingerprint
为指定浏览器随机化指纹。随机化后需要重启浏览器才能生效。

### roxy_list_labels
获取指定工作空间中的标签列表。标签可用于对浏览器进行分类管理。

### roxy_get_connection_info
获取已打开浏览器的连接信息（CDP 端点、PID 等）。

## 使用流程示例

### 创建并打开浏览器
1. 调用 \`roxy_create_browser\` 创建配置 → 返回 dirId
2. 调用 \`roxy_open_browsers\` 打开浏览器 → 返回 CDP WebSocket 端点

### 创建带代理的浏览器
1. 先用 \`roxy_list_proxies\` 或 \`roxy_store_proxies\` 获取代理列表
2. 调用 \`roxy_create_browser\` 时通过 \`proxyInfo.moduleId\` 绑定代理

### 创建绑定账号的浏览器
1. 先用 \`roxy_list_accounts\` 获取账号列表
2. 调用 \`roxy_create_browser\` 时通过 \`windowPlatformList\` 绑定账号

### 批量操作
1. 使用 \`roxy_batch_create_browsers\` 批量创建多个浏览器
2. 使用 \`roxy_open_browsers\` 传入多个 dirId 批量打开

## 注意事项

- 打开浏览器后返回的 CDP WebSocket 端点可用于自动化工具（如 Playwright）
- 修改指纹后需要重启浏览器才能生效
`,

  allowTools: [
    'roxy_create_browser',
    'roxy_batch_create_browsers',
    'roxy_update_browser',
    'roxy_open_browsers',
    'roxy_list_browsers',
    'roxy_close_browsers',
    'roxy_delete_browsers',
    'roxy_get_browser_detail',
    'roxy_clear_local_cache',
    'roxy_clear_server_cache',
    'roxy_random_fingerprint',
    'roxy_list_labels',
    'roxy_get_connection_info',
  ],
}

export const proxiesSkill = {
  name: 'roxy_proxies_skill',
  description: 'RoxyBrowser 代理管理技能',
  content: `
# RoxyBrowser 代理管理技能

本技能包含 RoxyBrowser 代理的完整管理功能，包括代理列表查询、代理商店、创建、删除、查询、修改和检测代理信息等操作。

## 可用工具

### roxy_list_proxies
获取代理配置列表。返回用户自定义的代理配置。如果你想获取已购买的代理配置列表，请使用 \`roxy_store_proxies\`。

### roxy_store_proxies
获取代理商店中的代理配置列表。返回从代理商店购买的代理配置。

### roxy_create_proxy
创建新的代理配置。支持 HTTP、HTTPS、SOCKS5、SSH 协议。创建后可以使用 \`roxy_detect_proxy\` 检测代理的 IP 地理位置信息。

### roxy_batch_create_proxies
批量创建多个代理配置。用于一次性创建多个代理，提高效率。

### roxy_detect_proxy
检测/测试代理配置并更新其 IP 信息。用于验证代理可用性和获取代理的 IP 地理位置等信息。

### roxy_modify_proxy
修改/更新现有的代理配置。可以更新代理的所有配置项。

### roxy_delete_proxies
删除一个或多个代理配置。删除操作不可恢复，请谨慎使用。

### roxy_get_detect_channels
获取可用的 IP 检测通道。检测通道用于检测代理的 IP 地理位置等信息，包括 IPRust.io、IP-API、IP123.in 等。

## 使用流程示例

### 创建并检测代理
1. 调用 \`roxy_create_proxy\` 创建代理配置
2. 调用 \`roxy_detect_proxy\` 检测代理 IP 信息和可用性

### 将代理绑定到浏览器
1. 用 \`roxy_list_proxies\` 或 \`roxy_store_proxies\` 获取代理 id
2. 创建浏览器时通过 \`proxyInfo.moduleId\` 绑定

### 批量操作
1. 使用 \`roxy_batch_create_proxies\` 批量创建多个代理
2. 使用 \`roxy_delete_proxies\` 批量删除代理

## 注意事项

- \`roxy_list_proxies\` 返回用户自定义的代理配置
- \`roxy_store_proxies\` 返回从代理商店购买的代理配置
- 删除代理操作不可恢复，请谨慎使用
`,
  allowTools: [
    'roxy_list_proxies',
    'roxy_store_proxies',
    'roxy_create_proxy',
    'roxy_batch_create_proxies',
    'roxy_detect_proxy',
    'roxy_modify_proxy',
    'roxy_delete_proxies',
    'roxy_get_detect_channels',
  ],
}

export const accountsSkill = {
  name: 'roxy_accounts_skill',
  description: 'RoxyBrowser 账号管理技能',
  content: `
# RoxyBrowser 账号管理技能

本技能包含 RoxyBrowser 平台账号的完整管理功能。平台账号用于存储网站登录凭证（用户名、密码、Cookie），可以绑定到浏览器配置中。

## 可用工具

### roxy_list_accounts
获取指定工作空间中的账号（平台凭证）列表。支持按账号 ID 过滤，支持分页查询。

### roxy_create_account
创建新的平台账号（带凭证）。可以配置平台 URL、用户名、密码、Cookie 等信息。账号的 Cookie 信息可以用于自动登录平台。

### roxy_batch_create_accounts
批量创建多个平台账号。用于一次性创建多个账号，提高效率。

### roxy_modify_account
修改/更新现有的平台账号。可以更新账号的所有信息，包括密码、Cookie 等。

### roxy_delete_accounts
删除一个或多个平台账号。删除操作不可恢复，请谨慎操作。

## 使用流程示例

### 创建账号并绑定到浏览器
1. 调用 \`roxy_create_account\` 创建平台账号
2. 用 \`roxy_list_accounts\` 获取账号 id
3. 创建浏览器时通过 \`windowPlatformList\` 绑定账号

### 批量操作
1. 使用 \`roxy_batch_create_accounts\` 批量创建多个账号
2. 使用 \`roxy_delete_accounts\` 批量删除账号

## 注意事项

- 账号的 Cookie 信息可以用于自动登录平台
- 删除账号操作不可恢复，请谨慎操作
`,
  allowTools: [
    'roxy_list_accounts',
    'roxy_create_account',
    'roxy_batch_create_accounts',
    'roxy_modify_account',
    'roxy_delete_accounts',
  ],
}

export const otherSkill = {
  name: 'roxy_other_skill',
  description: 'RoxyBrowser 其他功能技能',
  content: `
# RoxyBrowser 其他功能技能

本技能包含 RoxyBrowser 的工作空间列表和健康检查功能。

## 可用工具

### roxy_list_workspaces
获取 RoxyBrowser 中所有工作空间及其项目的列表。每个工作空间包含工作空间名称、ID 和项目详情。大多数其他工具都需要 workspaceId 参数，可以通过此工具获取。

### roxy_health_check
检查 RoxyBrowser 服务器是否正常运行。当 API 调用失败时，可以使用此工具诊断连接问题。

## 使用场景

1. **获取工作空间**: 使用 \`roxy_list_workspaces\` 获取可用的工作空间 ID（大多数工具都需要 workspaceId 参数）
2. **连接问题排查**: 当 API 调用失败时，使用 \`roxy_health_check\` 诊断问题

## 注意事项

- 大多数其他工具都需要 workspaceId 参数，建议先调用 \`roxy_list_workspaces\` 获取
`,
  allowTools: [
    'roxy_list_workspaces',
    'roxy_health_check',
  ],
}

export const openapiMcpSkills = [
  browserSkill,
  proxiesSkill,
  accountsSkill,
  otherSkill,
]
