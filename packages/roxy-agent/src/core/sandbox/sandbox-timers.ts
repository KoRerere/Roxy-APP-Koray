export interface SandboxTimers {
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
  setImmediate: typeof setImmediate
  clearImmediate: typeof clearImmediate
  dispose: () => void
}

export function createSandboxTimers(isActive: () => boolean, onError: (error: unknown) => void): SandboxTimers {
  const timeouts = new Set<NodeJS.Timeout>()
  const intervals = new Set<NodeJS.Timeout>()
  const immediates = new Set<NodeJS.Immediate>()

  const invoke = (callback: (...args: any[]) => void, args: any[]): void => {
    if (!isActive()) {
      return
    }
    try {
      callback(...args)
    }
    catch (error) {
      onError(error)
    }
  }

  const sandboxSetTimeout = ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
    let handle: NodeJS.Timeout
    handle = setTimeout(() => {
      timeouts.delete(handle)
      invoke(callback, args)
    }, delay)
    timeouts.add(handle)
    return handle
  }) as typeof setTimeout

  const sandboxClearTimeout = ((handle?: NodeJS.Timeout) => {
    if (handle) {
      timeouts.delete(handle)
      clearTimeout(handle)
    }
  }) as typeof clearTimeout

  const sandboxSetInterval = ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
    const handle = setInterval(() => invoke(callback, args), delay)
    intervals.add(handle)
    return handle
  }) as typeof setInterval

  const sandboxClearInterval = ((handle?: NodeJS.Timeout) => {
    if (handle) {
      intervals.delete(handle)
      clearInterval(handle)
    }
  }) as typeof clearInterval

  const sandboxSetImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => {
    let handle: NodeJS.Immediate
    handle = setImmediate(() => {
      immediates.delete(handle)
      invoke(callback, args)
    })
    immediates.add(handle)
    return handle
  }) as typeof setImmediate

  const sandboxClearImmediate = ((handle?: NodeJS.Immediate) => {
    if (handle) {
      immediates.delete(handle)
      clearImmediate(handle)
    }
  }) as typeof clearImmediate

  return {
    setTimeout: sandboxSetTimeout,
    clearTimeout: sandboxClearTimeout,
    setInterval: sandboxSetInterval,
    clearInterval: sandboxClearInterval,
    setImmediate: sandboxSetImmediate,
    clearImmediate: sandboxClearImmediate,
    dispose: () => {
      for (const handle of timeouts) clearTimeout(handle)
      for (const handle of intervals) clearInterval(handle)
      for (const handle of immediates) clearImmediate(handle)
      timeouts.clear()
      intervals.clear()
      immediates.clear()
    },
  }
}
