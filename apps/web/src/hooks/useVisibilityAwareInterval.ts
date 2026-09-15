import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/**
 * 页面可见时轮询，hidden 时暂停；回到 visible 时立即补跑一次 callback。
 * `enabled` 为 false 时同样暂停，避免无关场景空转。
 */
export function useVisibilityAwareInterval(
  fn: () => void,
  intervalMs: number,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const visibility = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(fn, intervalMs, { immediate: false })

  watch(
    [visibility, () => toValue(enabled)],
    ([state, isEnabled]) => {
      if (state === 'visible' && isEnabled) {
        fn()
        resume()
      }
      else {
        pause()
      }
    },
    { immediate: true },
  )
}
