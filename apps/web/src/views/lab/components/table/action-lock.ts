import type { InjectionKey, Ref } from 'vue'

export interface LabTableActionLock {
  busy: Ref<boolean>
  /**
   * 同一时刻只跑一个 command。
   * 已占用时返回 false，调用方不要把它当成业务成功。
   */
  run: <T>(fn: () => T | Promise<T>) => Promise<T | false | undefined>
}

/** Symbol.for 跨 HMR 保持同一把 key，普通 Symbol 热更新后会对不上 */
const LAB_TABLE_ACTION_LOCK: InjectionKey<LabTableActionLock> = Symbol.for('labTableActionLock')

/** 在 table 根上创建锁；子树若要用 inject，必须走这把，不要自己 fallback 执行 */
export function provideLabTableActionLock(): LabTableActionLock {
  const busy = ref(false)

  async function run<T>(fn: () => T | Promise<T>) {
    if (busy.value) {
      return false
    }
    busy.value = true
    try {
      return await fn()
    }
    finally {
      busy.value = false
    }
  }

  const lock: LabTableActionLock = { busy, run }
  provide(LAB_TABLE_ACTION_LOCK, lock)
  return lock
}

/** 插槽自定义操作若在 table 子树内，可注入同一把锁；拿不到时不要自行执行 command */
export function useLabTableActionLock(): LabTableActionLock | undefined {
  return inject(LAB_TABLE_ACTION_LOCK, undefined)
}
