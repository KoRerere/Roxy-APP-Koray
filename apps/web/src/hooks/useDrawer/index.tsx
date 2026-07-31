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
  // 独立挂载点：避免多个 useDrawer 实例共用 document.body 时互相卸载
  let _container: HTMLElement | null = null

  const _DrawerComponent = () => {
    const { slots, ...props } = _innerProps.value
    return (
      <Drawer v-slots={slots} {...props} v-model:visible={_visible.value}></Drawer>
    )
  }

  const _destroy = () => {
    if (_container) {
      render(null, _container)
      _container.remove()
      _container = null
    }
    _currentVNode = null
  }

  const _renderCmp = async () => {
    _destroy()
    _container = document.createElement('div')
    document.body.appendChild(_container)
    const vnode = createVNode(_DrawerComponent)
    vnode.appContext = appContext
    _currentVNode = vnode
    render(vnode, _container)
    await nextTick()
  }

  const showDrawer = async (props: any) => {
    try {
      _innerProps.value = props
      await _renderCmp()
      _visible.value = true
    }
    catch (error) {
      console.error('Failed to show drawer:', error)
    }
  }

  const hideDrawer = () => {
    _visible.value = false
  }

  onUnmounted(() => {
    _destroy()
  })

  return {
    showDrawer,
    hideDrawer,
  }
}
