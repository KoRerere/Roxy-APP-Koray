import TieredMenu from 'primevue/tieredMenu'
import { createVNode, getCurrentInstance, ref, render } from 'vue'

type Menu = InstanceType<typeof TieredMenu>

export function useTieredMenu() {
  let vm: VNode
  const instance = getCurrentInstance()
  const items = ref([
    { label: 'Copy', icon: 'pi pi-copy' },
    { label: 'Rename', icon: 'pi pi-file-edit' }
  ])

  const show = (event: Event) => {
    if (!vm) {
      vm = createVNode(TieredMenu, { model: items.value, popup: true })
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
