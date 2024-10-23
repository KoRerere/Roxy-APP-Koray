import path from 'node:path'
import util from 'node:util'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { appConfig } from '/@/constants/appConfig'

export function setupLog() {
  const transport: DailyRotateFile = new DailyRotateFile({
    filename: path.join(appConfig.logsDir, '%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    // maxSize: '20m',
    maxFiles: '14d',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      format.json(),

    ),
  })

  transport.on('error', (error) => {
    // log or handle errors here
    console.error('transport error', error)
  })

  // transport.on('rotate', (oldFilename, newFilename) => {
  // do something fun
  // })

  const logger = createLogger({
    transports: [
      new transports.Console({
        format: format.combine(
          format.json(),
          format.colorize(), // 彩色输出
          format.errors({ stack: true }),
          format.prettyPrint(),
          format.splat(),
          format.simple(),
        ),
      }), // 控制台输出
      transport,
    ],
    exceptionHandlers: [
      new transports.File({
        dirname: path.join(appConfig.logsDir, 'errorlogs'),
        filename: 'error.log',
      }),
    ],
  })

  function formatLogArgs(args: any[]) {
    return args.map((arg) => {
      if (arg && typeof arg === 'object') {
        return arg || util.format('%o', arg)
      }
      return arg
    }).join(' ')
  }

  // 将 logger 函数分配给 console 对象
  Object.assign(console, {
    log: (...args: any[]) => logger.info(formatLogArgs(args)),
    error: (...args: any[]) => logger.error(formatLogArgs(args)),
    warn: (...args: any[]) => logger.warn(formatLogArgs(args)),
    info: (...args: any[]) => logger.info(formatLogArgs(args)),
    debug: (...args: any[]) => logger.debug(formatLogArgs(args)),
  })
}
