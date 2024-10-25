import type { Logger } from 'winston'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { appConfig } from '/@/constants/appConfig'

export function setupLog() {
  // 配置 daily rotate file 传输
  const transport = new DailyRotateFile({
    filename: '%DATE%.log',
    dirname: appConfig.logsDir, // 存放日志的目录
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true, // 是否压缩归档
    maxSize: '20m', // 单个日志文件的最大大小
    maxFiles: '14d', // 保留的最大天数
  })

  // 配置 winston logger
  const logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss', // 自定义时间格式
      }),
      format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : ''
        return `${timestamp} [${level}]: ${message} ${metaString}`.trim()
      }),
    ),
    transports: [
      new transports.Console(),
      transport,
    ],
    exceptionHandlers: [
      new transports.File({
        filename: 'exceptions.log',
        dirname: appConfig.logsDir,
      }),
    ],
    // 防止异常后退出进程
    exitOnError: false,
  })

  overrideConsole(logger)
}

function overrideConsole(logger: Logger) {
  // 将 logger 函数分配给 console 对象
  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn
  const originalConsoleInfo = console.info

  console.log = (...args: any[]) => {
    logger.info(...args)
    originalConsoleLog(...args)
  }

  console.error = (...args: any[]) => {
    logger.error(...args)
    originalConsoleError(...args)
  }

  console.warn = (...args: any[]) => {
    logger.warn(...args)
    originalConsoleWarn(...args)
  }

  console.info = (...args: any[]) => {
    logger.info(...args)
    originalConsoleInfo(...args)
  }
}
