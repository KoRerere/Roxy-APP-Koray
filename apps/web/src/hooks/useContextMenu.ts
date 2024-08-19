import ContextMenu from 'primevue/contextmenu'
import { createVNode, getCurrentInstance, ref, render } from 'vue'

type Menu = InstanceType<typeof ContextMenu>

export function useContextMenu() {
  let vm: VNode
  const instance = getCurrentInstance()
  // const menu = ref<InstanceType<typeof ContextMenu>>()
  const items = ref([
    { label: 'Copy', icon: 'pi pi-copy' },
    { label: 'Rename', icon: 'pi pi-file-edit' },
  ])

  const show = (event: Event) => {
    if (!vm) {
      vm = createVNode(ContextMenu, { model: items.value })
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
