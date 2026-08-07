# Playwright 与 Agent 存储目录集成说明

本文档记录 `packages/roxy-agent` 与自研 `@roxybrowser/playwright` 的当前对接方式。Playwright 源码侧的权威说明见 `/Users/macos/Projects/roxybrowser-playwright-mcp/README.md`，这里仅描述 agent 如何消费最新接口。

## 包入口

- 页面 API：`@roxybrowser/playwright`
- MCP factory / transport：`@roxybrowser/playwright/mcp`

agent 中只有 sandbox 脚本直接注入页面 API；MCP worker 必须从 `/mcp` 入口导入 `createRoxyBrowserMcpInMemory` 和相关类型。

## MCP worker 目录

`packages/roxy-agent/src/core/mcp/mcpManager.ts` 为每个 worker 创建独立 in-memory MCP，并显式传入 Playwright asset dirs：

```ts
await createRoxyBrowserMcpInMemory({
  artifactsDir: agentPaths.sessionBrowserDir(sessionId),
  downloadsDir: agentPaths.sessionBrowserDownloadsDir(sessionId),
  screenshotsDir: agentPaths.sessionBrowserScreenshotsDir(sessionId),
  snapshotsDir: agentPaths.sessionBrowserSnapshotsDir(sessionId),
  tracesDir: agentPaths.sessionBrowserTracesDir(sessionId),
  videosDir: agentPaths.sessionBrowserTracesDir(sessionId),
  tempDir: agentPaths.sessionBrowserSnapshotsDir(sessionId),
})
```

目录归属：

- 下载：`sessions/{sessionId}/browser/downloads/`
- 截图：`sessions/{sessionId}/browser/screenshots/`
- trace / video：`sessions/{sessionId}/browser/traces/`
- snapshot / temp：`sessions/{sessionId}/browser/snapshots/`

这些目录随 session 一起删除，不再做独立的全局日期轮转。

Playwright 的旧 MCP 专用环境变量不再使用：`ROXY_MCP_OUTPUT_DIR`、`PLAYWRIGHT_MCP_OUTPUT_DIR`、`ROXY_MCP_TEMP_DIR`、`PLAYWRIGHT_MCP_TEMP_DIR` 都不是有效接口。

## sandbox 目录

sandbox 子进程由 `packages/roxy-agent/src/services/sandboxService.ts` 注入：

- `SANDBOX_OUTPUT_DIR=workdir/{slug}`
- `SANDBOX_BROWSER_DIR=workdir/{slug}/browser/{yyyy-mm-dd}`
- `ROXY_PLAYWRIGHT_SCREENSHOTS_DIR=workdir/{slug}/browser/{yyyy-mm-dd}`
- `SANDBOX_ASSET_SLUG={slug}`（兼容字段，表示当前脚本 slug）

`packages/roxy-agent/src/modes/sandbox.ts` 中 `process.cwd()` 仍指向 `workdir/{slug}`，不会切换到 browser 目录。Playwright 通过专用环境变量解析相对产物路径，因此 `page.screenshot({ path: '文件名.png' })` 默认写入当天 browser 目录。脚本里的 `import { chromium, firefox } from 'playwright'` 直接映射到 `@roxybrowser/playwright` 导出的原生对象，不再在 agent 层包下载目录 proxy。

`@roxybrowser/sandbox/download` 已废弃，仅保留兼容。脚本直接调用 Playwright 获取内容或下载对象，并使用 sandbox 注入的原生 Node `fs` 落盘；文件系统访问由子进程的 Node permission flags 强制限制。浏览器产物应以 `SANDBOX_BROWSER_DIR` 为根，普通持久数据写入 `SANDBOX_OUTPUT_DIR`。

## 验证重点

1. sandbox 的 host-backed 下载文件在 `workdir/{slug}/browser/{yyyy-mm-dd}/`，系统 `~/Downloads` 没有新增同名文件。
2. MCP worker 触发下载后，文件在 `sessions/{sessionId}/browser/downloads/`。
3. MCP snapshot / 临时文件在 `sessions/{sessionId}/browser/snapshots/`，删除会话时一并清理。
4. 截图、trace、video 使用上面的显式 asset dirs，不回退到 Playwright 默认临时目录。
