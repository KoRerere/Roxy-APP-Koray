import { format } from 'date-fns'
import log from 'electron-log/main'
import { readdirSync, renameSync } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { appConfig } from '/@/constants'
import { isPackaged } from '/@/utils'

export function setupLog() {
  // 记录渲染进程的日志
  // log.initialize()
  log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.console.useStyles = true
  // 禁用生产环境的控制台输出
  if (isPackaged) {
    log.transports.console.level = false
  }
  // 禁用同步写入
  log.transports.file.sync = false
  /**
   * 设置日志文件路径和文件名
   */
  log.transports.file.resolvePathFn = () => {
    // 格式化当前时间为 YYYY-MM-DD 格式
    const formattedDate = format(Date.now(), 'yyyy-MM-dd')
    return join(appConfig.logsDir, `${formattedDate}.log`)
  }
  // 限制文件大小，2 mb 之后会自动切割日志
  log.transports.file.maxSize = 2 * 1024 * 1024
  log.transports.file.archiveLogFn = (oldLogFile) => {
    const oldLogFilePath = oldLogFile.toString()
    const info = parse(oldLogFilePath)

    try {
      const maxCount = getMaxLogCount(info.dir, info.name)
      // 重命名日志文件
      renameSync(oldLogFilePath, join(info.dir, `${info.name}.old.${maxCount + 1}${info.ext}`))
    }
    catch (e) {
      console.warn('Could not rotate log', e)
      log.error('Could not rotate log', e)
    }
  }

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

function getMaxLogCount(logDir: string, logFileName: string) {
  const logFiles = readdirSync(logDir)
  const logFilePattern = new RegExp(`${logFileName}\\.old\\.(\\d+)\\.log$`)
  let maxCount = 0

  logFiles.forEach((file) => {
    const match = file.match(logFilePattern)
    if (match && match[1]) {
      const count = Number.parseInt(match[1], 10)
      if (count > maxCount) {
        maxCount = count
      }
    }
  })

  return maxCount
}
