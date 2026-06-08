import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'

export interface FormAsyncGate {
  pending: Ref<number>
  isReady: ComputedRef<boolean>
  run: <T>(task: () => Promise<T>) => Promise<T>
  waitUntilReady: () => Promise<void>
}

export function createFormAsyncGate(): FormAsyncGate {
  const pending = ref(0)
  const isReady = computed(() => pending.value === 0)

  async function run<T>(task: () => Promise<T>): Promise<T> {
    pending.value++
    try {
      return await task()
    }
    finally {
      pending.value--
    }
  }

  function waitUntilReady(): Promise<void> {
    if (isReady.value)
      return Promise.resolve()

    return new Promise((resolve) => {
      const stop = watch(isReady, (ready) => {
        if (ready) {
          stop()
          resolve()
        }
      })
    })
  }

  return { pending, isReady, run, waitUntilReady }
}
