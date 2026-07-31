import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { watch } from 'vue'

/**
 * 页面可见时轮询，hidden 时暂停；回到 visible 时立即补跑一次 callback。
 */
export function useVisibilityAwareInterval(fn: () => void, intervalMs: number) {
  const visibility = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(fn, intervalMs, { immediate: false })

  watch(visibility, (state) => {
    if (state === 'visible') {
      fn()
      resume()
    }
    else {
      pause()
    }
  }, { immediate: true })
}
