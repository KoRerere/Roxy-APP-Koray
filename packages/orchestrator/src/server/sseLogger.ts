import fs from 'node:fs'

export class SSELogger {
  stream: fs.WriteStream

  constructor(private readonly filename: string) {
    this.stream = fs.createWriteStream(this.filename)
  };

  log(event: any) {
    this.stream.write(event)
  }

  close() {
    this.stream.end()
  }
}

class SSELoggerManager {
  private loggers: Map<string, SSELogger> = new Map()

  constructor() {}

  createLogger(filename: string): SSELogger {
    const logger = new SSELogger(filename)
    this.loggers.set(filename, logger)
    return logger
  }

  getLogger(filename: string): SSELogger {
    return this.loggers.get(filename)!
  }

  closeLogger(filename: string): void {
    this.loggers.get(filename)?.close()
    this.loggers.delete(filename)
  }

  closeAllLoggers(): void {
    this.loggers.forEach(logger => logger.close())
    this.loggers.clear()
  }
}

export const sseLoggerManager = new SSELoggerManager()
