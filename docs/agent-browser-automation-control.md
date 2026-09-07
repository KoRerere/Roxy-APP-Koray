# Agent 浏览器自动化标签组

## 目标与边界

RoxyBrowser 在 Agent 实际操作的 Chromium 标签页上显示一个原生、标题为 `AI` 的
Tab Group。它不注入网页 DOM，不显示覆盖层，也不拦截用户输入；因此不会影响
Playwright 的截图、snapshot、locator 或 CDP/BiDi 操作。

Firefox 没有等价的 `chrome.tabGroups` 扩展 API，不支持此 UI。

## 协议

所有接口继续使用现有 OpenAPI `token` 鉴权，且不要求请求体中的 `workspaceId`。

| 接口 | 调用方 | 用途 |
| --- | --- | --- |
| `POST /browser/automation/sync` | 当前 roxy-agent | 将指定 CDP page target 同步到 AI 标签组；可重复调用。 |
| `POST /browser/automation/release` | 当前 roxy-agent | 当最后一个操作该窗口的 binding 结束时移除标签组。 |
| `POST /browser/automation/acquire` | 旧版 agent | 兼容接口，按当前活动标签页处理；新代码不得使用。 |

`sync` 请求体：

```json
{
  "dirId": "profile-1",
  "executionId": "run-123",
  "targetId": "CDP_PAGE_TARGET_ID",
  "label": "AI"
}
```

`dirId`、`executionId`、`targetId` 均为 trim 后非空字符串；`label` 可选，默认
`AI`，最大 16 个字符。

Electron 按 `dirId` 保存状态，并使用 `executionId` 防止旧执行释放新执行的
标签组。相同 target 的 `sync` 也会下发给扩展：这使得用户手动删除标签组或扩展
worker 重建后，下一次页面工具调用可以恢复 UI。

## 标签选择与恢复

1. agent 的 in-memory Playwright MCP runtime 通过 `listTabs()` 读取 `active: true`
   的标签，其 `id` 就是 Chromium CDP `TargetID`。
2. 扩展使用 `chrome.debugger.getTargets()` 将该 target 映射为 `tabId`，只将这个
   tab 放入 AI 组。
3. 当 target 改变时，扩展先恢复旧 tab 原有的分组关系，再将新 target 放入 AI 组。
4. release 时同样恢复原组；原组不存在时按保存的标题、颜色、折叠状态重建。

扩展**不得**通过 `tabs.onActivated`、`tabs.onCreated` 或 `tabs.onUpdated` 自动向
AI 组添加标签。工作台页、用户焦点切换和其他标签页都不是 Agent 实际 target 的
可靠信号。

扩展的 `manifest.json` 需要 `tabs`、`tabGroups`、`storage` 和 `debugger` 权限。

## Agent 生命周期

`ProfileRuntimeManager` 将 Playwright 资源按 `dirId` 复用，但 UI 所有权按
`bindingId` 记录：

```text
roxy_browser_launch / roxy_browser_connect
  -> 连接并缓存资源；不创建 AI 标签组

普通页面工具
  -> 读取 active CDP target
  -> sync(dirId, executionId, targetId)
  -> 执行工具

browser_tabs
  -> 工具完成后再次 sync，反映新建、关闭或选中的 target

binding release / 切换到另一窗口
  -> 删除该 binding 的引用
  -> 同一 dirId 没有其余 binding 时 release 标签组
```

同一执行的 root/child binding 可以共同使用一个窗口；只有最后一个 binding 释放时
才调用 `release`。一个 binding 从窗口 A 切换到 B 时会立即释放它在 A 上的引用，
避免整轮执行结束才清理旧窗口。

若 `sync` 返回失败（例如 Electron 与 agent 版本不匹配、扩展暂未就绪），不会写入
成功缓存，下一次页面工具会重试，且不会阻断自动化。浏览器窗口关闭时，agent 会
清除该窗口的引用和资源；同一 agent 后续重新打开窗口并执行页面工具，会重新
`sync` 并恢复 AI 标签组。

## Unpacked extension ID

自动化扩展会复制到每个 profile 的稳定临时目录：

```text
{tempDir}/automation-control-extension/{sha256(dirId)[0:24]}
```

`genExtensionID({ type: 'path' })` 必须与 Chromium 的 `GenerateIdForPath` 使用相同
字节序列：POSIX 路径为 UTF-8；Windows 路径为 UTF-16LE，并只将盘符标准化为
大写。不得把每个 JavaScript 字符后附加 NUL 再按 UTF-8 编码，否则 macOS/Linux
会计算出与浏览器已安装扩展不同的 ID，CDP 无法找到 service worker。

## 验收

- 启动浏览器后、首次页面工具前，不显示 AI 组；实际 agent target 首次被操作时才显示。
- 工作台页和用户手动切换的标签不会自动加入 AI 组。
- `browser_tabs` 新建、关闭、选择标签后，AI 组跟随当前 agent target，旧 tab 恢复原组。
- 多个 root/child binding 同时操作同一窗口时，前一个结束不移除组；最后一个结束才移除。
- 用户关闭窗口后 agent 重新打开并继续页面操作，AI 组重新出现。
- 本地 `pnpm dev` 下 bridge 能找到扩展 worker；其扩展 ID 与 Chromium profile 的
  Preferences 中 ID 一致。
