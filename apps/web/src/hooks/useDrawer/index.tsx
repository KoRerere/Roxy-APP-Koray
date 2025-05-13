import { createVNode, getCurrentInstance, render } from 'vue'
import type { VNode } from 'vue'

import Drawer from './components/drawer.vue'

export function useDrawer() {
  const appContext = getCurrentInstance()?.appContext
  if (!appContext) {
    throw new Error('useDrawer must be used within a component setup')
  }

  const _visible = ref(false)
  const _innerProps = ref<any>({})
  let _currentVNode: VNode | null = null

  const _DrawerComponent = () => {
    const { slots, ...props } = _innerProps.value
    return (
      <Drawer v-slots={slots} {...props} v-model:visible={_visible.value}></Drawer>
    )
  }

  const _renderCmp = async () => {
    _destroy()
    const vnode = createVNode(_DrawerComponent)
    vnode.appContext = appContext
    _currentVNode = vnode
    render(vnode, document.body)
    await nextTick()
  }

  const showDrawer = async (props: any) => {
    try {
      _innerProps.value = props
      await _renderCmp()
      _visible.value = true
    } catch (error) {
      console.error('Failed to show drawer:', error)
    }
  }

  const hideDrawer = () => {
    _visible.value = false
  }

  const _destroy = () => {
    if (_currentVNode) {
      render(null, document.body)
      _currentVNode = null
    }
  }

  onUnmounted(() => {
    _destroy()
  })

  return {
    showDrawer,
    hideDrawer,
  }
}
