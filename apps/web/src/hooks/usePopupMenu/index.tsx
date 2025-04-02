import { createVNode, getCurrentInstance, render } from 'vue'
import type { VNode } from 'vue'

import Menu from './components/menu.vue';
import type { MenuProps } from './type';

export function usePopupMenu() {
  const appContext = getCurrentInstance()?.appContext
  if (!appContext) {
    throw new Error('usePopoverMenu must be used within a component setup')
  }

  const opRef = ref()
  const innerProps = ref<MenuProps>({})
  let currentVNode: VNode | null = null

  const popupMenuComponent = () => {
    const { slots, ...props } = innerProps.value
    return (
      <Menu ref={opRef} v-slots={slots} {...props}></Menu>
    )
  }

  const renderCmp = async () => {
    destroy()
    const vnode = createVNode(popupMenuComponent)
    vnode.appContext = appContext
    currentVNode = vnode
    render(vnode, document.body)
    await nextTick()
  }

  const showMenu = async (event: MouseEvent, props: MenuProps) => {
    try {
      innerProps.value = props
      await renderCmp()
      // 异步会导致 event.currentTarget 为 null,等待官方支持指定 target
      // https://github.com/primefaces/primevue/issues/7556
      const _event = new Proxy(event, {
        get(target, prop) {
          return prop === 'currentTarget' && !Reflect.get(target, 'currentTarget')
            ? Reflect.get(target, 'target')
            : Reflect.get(target, prop)
        }
      })
      opRef.value?.toggle(_event)
    } catch (error) {
      console.error('Failed to show popup menu:', error)
    }
  }

  const destroy = () => {
    if (currentVNode) {
      render(null, document.body)
      currentVNode = null
    }
  }

  onUnmounted(() => {
    destroy()
  })

  return { showMenu, destroy }
}
