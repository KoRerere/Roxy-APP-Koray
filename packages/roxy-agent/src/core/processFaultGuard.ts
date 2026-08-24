interface FaultLogger {
  error: (...args: unknown[]) => void
}

interface ProcessFaultGuardOptions {
  label?: string
  target?: NodeJS.Process
  logger?: FaultLogger
  onFault?: (fault: { kind: 'uncaughtException' | 'unhandledRejection', error: unknown }) => void
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}

/**
 * Keeps ordinary JavaScript faults from taking down the long-lived Agent
 * utility process. This is a last-resort guard; request/tool/sandbox code
 * should still catch and return domain errors at its own boundary.
 */
export function installProcessFaultGuards(options: ProcessFaultGuardOptions = {}): () => void {
  const target = options.target ?? process
  const logger = options.logger ?? console
  const label = options.label ?? 'agent'

  const notifyFault = (fault: { kind: 'uncaughtException' | 'unhandledRejection', error: unknown }): void => {
    try {
      options.onFault?.(fault)
    }
    catch (error) {
      logger.error(`[process-fault:${label}] fault handler failed; process remains alive`, {
        error: formatError(error),
      })
    }
  }

  const onUncaughtException = (error: Error, origin: NodeJS.UncaughtExceptionOrigin): void => {
    notifyFault({ kind: 'uncaughtException', error })
    logger.error(`[process-fault:${label}] uncaughtException captured; process remains alive`, {
      origin,
      error: formatError(error),
    })
  }

  const onUnhandledRejection = (reason: unknown): void => {
    notifyFault({ kind: 'unhandledRejection', error: reason })
    logger.error(`[process-fault:${label}] unhandledRejection captured; process remains alive`, {
      error: formatError(reason),
    })
  }

  target.on('uncaughtException', onUncaughtException)
  target.on('unhandledRejection', onUnhandledRejection)

  return () => {
    target.off('uncaughtException', onUncaughtException)
    target.off('unhandledRejection', onUnhandledRejection)
  }
}
