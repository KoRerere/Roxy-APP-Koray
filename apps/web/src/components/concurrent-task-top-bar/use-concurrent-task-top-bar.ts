import type { App as VueApp } from 'vue'
import { createApp, getCurrentInstance, h, reactive, shallowRef } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import ConcurrentTaskTopBar from './concurrent-task-top-bar.vue'

export interface ShowConcurrentTaskTopBarOptions {
  total: number
}

export function useConcurrentTaskTopBar() {
  const parent = getCurrentInstance()
  const parentContext = parent?.appContext

  const hostEl = shallowRef<HTMLDivElement | null>(null)
  const childApp = shallowRef<VueApp | null>(null)
  /** 驱动子应用根渲染刷新（进度来自 concurrentControl 回调，可能脱离模板追踪链） */
  const renderTick = shallowRef(0)

  const state = reactive({
    completed: 0,
    total: 0,
  })

  function updateProgress(p: { completed: number; total: number }) {
    state.completed = p.completed
    state.total = p.total
    bumpRender()
  }

  function bumpRender() {
    renderTick.value++
  }

  function show(opts: ShowConcurrentTaskTopBarOptions) {
    if (childApp.value)
      return

    state.completed = 0
    state.total = opts.total

    const el = document.createElement('div')
    hostEl.value = el
    document.body.appendChild(el)

    const app = createApp({
      setup() {
        return () => {
          void renderTick.value
          return h(ConcurrentTaskTopBar, {
            completed: state.completed,
            total: state.total,
          })
        }
      },
    })

    if (parentContext)
      (app as VueApp & { _context: typeof parentContext })._context = parentContext

    app.mount(el)
    childApp.value = app
  }

  function close() {
    if (!childApp.value || !hostEl.value)
      return
    childApp.value.unmount()
    hostEl.value.remove()
    childApp.value = null
    hostEl.value = null
  }

  tryOnScopeDispose(close)

  function isOpen() {
    return !!childApp.value
  }

  return {
    show,
    close,
    updateProgress,
    isOpen,
  }
}
