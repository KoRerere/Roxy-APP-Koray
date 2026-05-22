// import { captureException, consoleLoggingIntegration, init as initSentry } from '@sentry/electron/main'
import { app, dialog, net } from 'electron'

// type NetFetchParams = Parameters<typeof net.fetch>

// globalThis.fetch = async (input: NetFetchParams[0], init?: NetFetchParams[1]) => {
//   await app.whenReady() // 确保 app 已准备好，避免在 app 未就绪时调用 fetch 导致的错误
//   return net.fetch(input, init)
// }

// 删除进程环境变量中的代理配置，避免影响其他模块
delete process.env.HTTP_PROXY
delete process.env.HTTPS_PROXY
delete process.env.http_proxy
delete process.env.https_proxy
delete process.env.ALL_PROXY
delete process.env.all_proxy

// Sentry 主进程初始化（尽早调用）
// DSN 来自环境变量：SENTRY_DSN；环境：SENTRY_ENV 或 NODE_ENV；版本：app.getVersion()
// initSentry({
//   dsn: import.meta.env.VITE_SENTRY_DSN,
//   release: import.meta.env.VITE_APP_VERSION,
//   sendDefaultPii: true,
//   // 启用结构化日志
//   enableLogs: true,
//   // 离线缓存参数（可按需调整）
//   transportOptions: {
//     maxAgeDays: 30,
//     maxQueueSize: 30,
//     flushAtStartup: false,
//   },
//   // 如需性能追踪，打开采样率（默认关闭以减少开销）
//   tracesSampleRate: 0,
//   // 将 console.* 同步为 Sentry 日志（取决于 SDK 版本）
//   integrations: [
//     consoleLoggingIntegration(),
//   ],
// })

// （不推荐）忽略 SSL 证书验证,让 axios 忽略 SSL 证书验证，绕过 UNABLE_TO_VERIFY_LEAF_SIGNATURE 错误
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

/**
 * 禁止弹出错误框
 */
dialog.showErrorBox = function (title, content) {
  // 只记录错误，不显示弹窗
  console.error(`Error logged without system dialog: ${title}\n${content}`)
}

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  // try {
  //   captureException(error)
  // }
  // catch { }
})

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason)
  // try {
  //   captureException(reason instanceof Error ? reason : new Error(String(reason)))
  // }
  // catch { }
})

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process gone:', details)
  // try {
  //   captureException(new Error(`Render process gone: ${JSON.stringify(details)}`))
  // }
  // catch { }
})

// 让 Sentry 管理 crashReporter，无需手动启动

// 方便测试崩溃信息
// setTimeout(() => {
//   process.crash()
// }, 6000)
