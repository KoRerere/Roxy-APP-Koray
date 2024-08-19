import path from 'node:path'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { appConfig } from '/@/constants/appConfig'

export function setupLog() {
  const transport: DailyRotateFile = new DailyRotateFile({
    filename: path.join(appConfig.logsDir, '%DATE%.log'),
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    // maxSize: '20m',
    maxFiles: '14d',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      format.printf((info) => {
        if (info.message.constructor === Object) {
          info.message = JSON.stringify(info.message, null, 4)
        }

        return `[${info.timestamp}] [${info.level}] ${info.message}`
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
  })

  // 将 logger 函数分配给 console 对象
  Object.assign(console, {
    log: (...args: any[]) => logger.info(args.join(' ')),
    error: (...args: any[]) => logger.error(args.join(' ')),
    warn: (...args: any[]) => logger.warn(args.join(' ')),
    info: (...args: any[]) => logger.info(args.join(' ')),
    debug: (...args: any[]) => logger.debug(args.join(' ')),
  })
}
