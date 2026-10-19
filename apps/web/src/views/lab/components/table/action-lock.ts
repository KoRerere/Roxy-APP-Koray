import { reactive } from 'vue'

/**
 * 按单个操作项占用。
 * 同一项重复点击会被忽略，其它项可以同时执行。
 */
export function createActionScopes() {
  const pending = reactive(new Set<string>())

  function isBusy(scope: string) {
    return pending.has(scope)
  }

  async function run<T>(scope: string, fn: () => T | Promise<T>): Promise<T | false> {
    if (pending.has(scope)) {
      return false
    }
    pending.add(scope)
    try {
      return await fn()
    }
    finally {
      pending.delete(scope)
    }
  }

  return { isBusy, run }
}
