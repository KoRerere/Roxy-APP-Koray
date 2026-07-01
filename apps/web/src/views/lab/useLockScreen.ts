import type { AppContext, VNode } from 'vue'
import { createVNode, getCurrentInstance, render } from 'vue'
import { app } from '/@/app'
import LockScreenOverlay from './screen.vue'

let container: HTMLElement | null = null
let vnode: VNode | null = null
let appContext: AppContext | null = null

function resolveAppContext() {
  appContext ||= getCurrentInstance()?.appContext ?? app._context
  return appContext
}

/**
 * 锁屏 composable：调用 showLockScreen 时在 body 中挂载锁屏层
 */
export function useLockScreen() {
  function hideLockScreen() {
    if (!container)
      return

    render(null, container)
    container.remove()
    container = null
    vnode = null
  }

  function showLockScreen() {
    if (container)
      return

    container = document.createElement('div')
    document.body.appendChild(container)

    vnode = createVNode(LockScreenOverlay, {
      onClose: hideLockScreen,
    })
    vnode.appContext = resolveAppContext()
    render(vnode, container)
  }

  return [showLockScreen, hideLockScreen] as const
}
