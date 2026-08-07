import type { InjectionKey, Ref } from 'vue'

interface TaskMonitorContext {
  open: Ref<boolean>
  available: Ref<boolean>
  runningTaskCount: Ref<number>
  toggle: () => void
}

const taskMonitorContextKey: InjectionKey<TaskMonitorContext> = Symbol('TaskMonitorContext')

export function provideTaskMonitorContext(open: Ref<boolean>, available: Ref<boolean>, runningTaskCount: Ref<number>) {
  provide(taskMonitorContextKey, {
    open,
    available,
    runningTaskCount,
    toggle: () => {
      if (!available.value)
        return

      open.value = !open.value
    },
  })
}

export function useTaskMonitorContext() {
  const context = inject(taskMonitorContextKey)

  if (!context) throw new Error('TaskMonitorToggle must be used inside agent-console')

  return context
}
