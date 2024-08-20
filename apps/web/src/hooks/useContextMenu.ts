import ContextMenu from 'primevue/contextmenu'
import { createVNode, getCurrentInstance, ref, render } from 'vue'

type Menu = InstanceType<typeof ContextMenu>

export function useContextMenu(props: any) {
  let vm: VNode
  const instance = getCurrentInstance()

  const show = (event: Event) => {
    if (!vm) {
      vm = createVNode(ContextMenu, props)
      vm.appContext = instance!.appContext
      render(vm, document.body)
    }
    nextTick(() => {
      ;(vm.component?.proxy as Menu)?.show(event)
    })
  }

  const hide = () => {
    ;(vm.component?.proxy as Menu)?.hide()
  }

  return [show, hide]
}
