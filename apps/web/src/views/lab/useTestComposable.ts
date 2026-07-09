import type { AppContext, VNode } from 'vue'
import { createVNode, getCurrentInstance, getCurrentScope, onScopeDispose, render } from 'vue'
import { app } from '/@/app'

let container: HTMLElement | null = null
let activeOwner: symbol | null = null

interface ShowOptions {
  onClose?: () => void
  [key: string]: unknown
}

export function useTestComposable() {
  const owner = Symbol('test-composable-owner')
  const appContext: AppContext = getCurrentInstance()?.appContext ?? app._context

  function hide() {
    const currentContainer = container
    if (!currentContainer)
      return

    render(null, currentContainer)

    if (currentContainer.parentNode)
      currentContainer.parentNode.removeChild(currentContainer)

    if (container === currentContainer) {
      container = null
      activeOwner = null
    }
  }

  function show(options: ShowOptions = {}) {
    if (typeof document === 'undefined' || !document.body)
      return hide

    hide()

    const { onClose, ...props } = options
    const nextContainer = document.createElement('div')
    document.body.appendChild(nextContainer)
    container = nextContainer
    activeOwner = owner

    const vnode: VNode = createVNode('div', {
      ...props,
      class: 'w-full h-full bg-orange-300',
      onClick: () => {
        onClose?.()
        hide()
      },
    })
    vnode.appContext = appContext
    render(vnode, nextContainer)

    return hide
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (activeOwner === owner)
        hide()
    })
  }

  return { show, hide }
}
