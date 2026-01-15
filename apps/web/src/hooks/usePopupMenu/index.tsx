import { createVNode, getCurrentInstance, nextTick, render } from 'vue'
import type { VNode } from 'vue'

import Menu from './components/menu.vue'
import type { MenuProps } from './type'

export function usePopupMenu() {
  const appContext = getCurrentInstance()?.appContext
  if (!appContext) {
    throw new Error('usePopoverMenu must be used within a component setup')
  }

  const opRef = ref()
  const innerProps = ref<MenuProps>({})
  let currentVNode: VNode | null = null
  let domContainer: HTMLElement | null = null

  const popupMenuComponent = () => {
    const { slots, ...props } = innerProps.value
    return (
      <Menu ref={opRef} v-slots={slots} {...props}></Menu>
    )
  }

  const renderCmp = async () => {
    try {
      destroy()
      // 创建容器元素
      domContainer = document.createElement('div')
      document.body.appendChild(domContainer)

      const vnode = createVNode(popupMenuComponent)
      vnode.appContext = appContext
      currentVNode = vnode

      // 使用容器元素进行渲染
      render(vnode, domContainer)
      await nextTick()
    }
    catch (error) {
      console.error('Failed to render popup menu:', error)
      destroy()
    }
  }

  async function showMenu(event: MouseEvent, props: MenuProps) {
    try {
      innerProps.value = props
      await renderCmp()

      if (!opRef.value) {
        throw new Error('Menu component reference is not available')
      }

      // 异步会导致 event.currentTarget 为 null,等待官方支持指定 target
      // https://github.com/primefaces/primevue/issues/7556
      const _event = new Proxy(event, {
        get(target, prop) {
          return prop === 'currentTarget' && !Reflect.get(target, 'currentTarget')
            ? Reflect.get(target, 'target')
            : Reflect.get(target, prop)
        },
      })

      opRef.value?.toggle(_event)
    }
    catch (error) {
      console.error('Failed to show popup menu:', error)
      destroy()
    }
  }

  function destroy() {
    if (currentVNode && domContainer) {
      render(null, domContainer)
      currentVNode = null
    }
    if (domContainer) {
      document.body.removeChild(domContainer)
      domContainer = null
    }
  }

  onUnmounted(() => {
    destroy()
  })

  return { showMenu, destroy }
}
