import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { installProcessFaultGuards } from './processFaultGuard'

class FakeProcess extends EventEmitter {
  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener)
  }

  off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(eventName, listener)
  }
}

describe('process fault guard', () => {
  it('logs process-level JavaScript faults without exiting the Agent process', () => {
    // Regression: an unhandled async rejection or uncaught callback exception
    // let Node terminate the Agent utility process and drop active script runs.
    // Fixed by: installing process-level guards that record the fault and keep
    // the Agent process alive; Electron still owns intentional shutdown.
    const target = new FakeProcess()
    const logger = { error: vi.fn() }
    const onFault = vi.fn()

    const uninstall = installProcessFaultGuards({
      label: 'agent',
      target: target as unknown as NodeJS.Process,
      logger,
      onFault,
    })

    const exception = new Error('timer callback failed')
    const rejection = new Error('async task failed')
    target.emit('uncaughtException', exception, 'uncaughtException')
    target.emit('unhandledRejection', rejection, Promise.reject().catch(() => {}))

    expect(onFault).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(2)
    expect(target.listenerCount('uncaughtException')).toBe(1)
    expect(target.listenerCount('unhandledRejection')).toBe(1)

    uninstall()

    expect(target.listenerCount('uncaughtException')).toBe(0)
    expect(target.listenerCount('unhandledRejection')).toBe(0)
  })

  it('contains faults thrown by the fault callback itself', () => {
    const target = new FakeProcess()
    const logger = { error: vi.fn() }
    const callbackError = new Error('fault reporter failed')

    installProcessFaultGuards({
      label: 'sandbox',
      target: target as unknown as NodeJS.Process,
      logger,
      onFault: () => {
        throw callbackError
      },
    })

    expect(() => target.emit('uncaughtException', new Error('script timer failed'), 'uncaughtException')).not.toThrow()
    expect(logger.error).toHaveBeenCalledWith(
      '[process-fault:sandbox] fault handler failed; process remains alive',
      { error: callbackError.stack },
    )
  })
})
