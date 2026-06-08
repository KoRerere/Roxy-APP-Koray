import { onBeforeUnmount, readonly, ref, watch } from 'vue'

// 全局共享的 now 时间源：所有进行中的思考块/任务共用同一个 100ms 计时器，
// 而不是每个组件各起一个 setInterval。引用计数为 0 时自动停表，避免空转。
const sharedNow = ref(Date.now())
let intervalId: ReturnType<typeof setInterval> | null = null
let refCount = 0

function start() {
  if (intervalId != null)
    return
  sharedNow.value = Date.now()
  intervalId = setInterval(() => {
    sharedNow.value = Date.now()
  }, 100)
}

function stop() {
  if (intervalId == null)
    return
  clearInterval(intervalId)
  intervalId = null
}

function acquire() {
  refCount += 1
  if (refCount === 1)
    start()
}

function release() {
  if (refCount === 0)
    return
  refCount -= 1
  if (refCount === 0)
    stop()
}

/**
 * 共享的「当前时间」时间源。
 *
 * @param active 一个返回 boolean 的取值函数：为 true 时该组件参与计时（持有一个引用），
 *               为 false 时释放引用。所有持有者释放后，全局计时器停止。
 * @returns 只读的 now ref（毫秒时间戳）
 */
export function useSharedNow(active: () => boolean) {
  let holding = false

  function sync(isActive: boolean) {
    if (isActive && !holding) {
      holding = true
      acquire()
    }
    else if (!isActive && holding) {
      holding = false
      release()
    }
  }

  watch(active, sync, { immediate: true })

  onBeforeUnmount(() => {
    if (holding) {
      holding = false
      release()
    }
  })

  return readonly(sharedNow)
}
