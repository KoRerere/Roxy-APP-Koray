import type { InjectionKey, Ref } from 'vue'

interface ProfileMonitorContext {
  open: Ref<boolean>
  available: Ref<boolean>
  runningTaskCount: Ref<number>
  toggle: () => void
}

const profileMonitorContextKey: InjectionKey<ProfileMonitorContext> = Symbol('ProfileMonitorContext')

export function provideProfileMonitorContext(open: Ref<boolean>, available: Ref<boolean>, runningTaskCount: Ref<number>) {
  provide(profileMonitorContextKey, {
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

export function useProfileMonitorContext() {
  const context = inject(profileMonitorContextKey)

  if (!context) throw new Error('ProfileMonitorToggle must be used inside agent-console')

  return context
}
