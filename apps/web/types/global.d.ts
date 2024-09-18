import type { ElectronAPI } from '@roxy/electron-preload'

declare global {
  var electronAPI: ElectronAPI
  const scheduler: Scheduler
}

interface Scheduler {
  postTask: (callback: () => void, options?: Pick<TimerOptions, 'signal'>) => Promise<void>
  /**
   * An experimental API defined by the [Scheduling APIs](https://github.com/WICG/scheduling-apis) draft specification being developed as a standard Web Platform API.
   *
   * Calling `timersPromises.scheduler.wait(delay, options)` is roughly equivalent to calling `timersPromises.setTimeout(delay, undefined, options)` except that the `ref`
   * option is not supported.
   *
   * ```js
   * import { scheduler } from 'node:timers/promises';
   *
   * await scheduler.wait(1000); // Wait one second before continuing
   * ```
   * @since v16.14.0
   * @experimental
   * @param [delay=1] The number of milliseconds to wait before fulfilling the promise.
   */
  wait: (delay?: number, options?: Pick<TimerOptions, 'signal'>) => Promise<void>
  /**
   * An experimental API defined by the [Scheduling APIs](https://nodejs.org/docs/latest-v20.x/api/async_hooks.html#promise-execution-tracking) draft specification
   * being developed as a standard Web Platform API.
   * Calling `timersPromises.scheduler.yield()` is equivalent to calling `timersPromises.setImmediate()` with no arguments.
   * @since v16.14.0
   * @experimental
   */
  yield: () => Promise<void>
}
