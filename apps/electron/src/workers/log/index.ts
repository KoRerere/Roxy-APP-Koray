import log from 'electron-log'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { parentPort } from 'node:worker_threads'
import { appConfig } from '/@/constants'

// 监听来自主进程的消息
parentPort.on('message', ({ level, message }) => {
  log[level](message) // 处理日志记录
})

function initLog() {
  log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.console.useStyles = true
  /**
   * 设置日志文件路径和文件名
   */
  log.transports.file.resolvePathFn = () => join(appConfig.logsDir, `${new Date().toISOString().split('T')[0]}.log`)
  // 限制文件大小
  log.transports.file.maxSize = 20 * 1024 * 1024 // 20 MB

  // 收集渲染进程中 console.log 写入的日志
  // log.initialize({ spyRendererConsole: true })

  Object.assign(console, log.functions)
  log.errorHandler.startCatching()
  cleanupOldLogs()
}

/**
 * 清理过期日志（保留 14 天）
 */
async function cleanupOldLogs() {
  const logDir = appConfig.logsDir

  try {
    const files = await readdir(logDir)

    const now = Date.now()
    files.forEach(async (file) => {
      const filePath = join(logDir, file)
      const stats = await stat(filePath)
      const fileAge = now - stats.mtimeMs

      // 删除超过 14 天的日志
      if (fileAge > 14 * 24 * 60 * 60 * 1000) {
        rm(filePath)
          .then(() => {
            log.info(`已删除过期日志文件: ${file}`)
          })
          .catch((err) => {
            log.error(`删除文件失败: ${file}`, err)
          })
      }
    })
  }
  catch (error) {
    log.error('无法读取日志目录:', error)
  }
}

initLog()
