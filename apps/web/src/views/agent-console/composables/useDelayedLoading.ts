import type { Ref } from 'vue'
import { onBeforeUnmount, ref, watch } from 'vue'

const DEFAULT_DELAY_MS = 200

export function useDelayedLoading(
  loading: Readonly<Ref<boolean>>,
  delay = DEFAULT_DELAY_MS,
) {
  const delayedLoading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  watch(loading, (isLoading) => {
    clearTimer()

    if (!isLoading) {
      delayedLoading.value = false
      return
    }

    timer = setTimeout(() => {
      delayedLoading.value = true
      timer = undefined
    }, delay)
  }, { immediate: true })

  onBeforeUnmount(clearTimer)

  return delayedLoading
}
