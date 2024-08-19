import TieredMenu from 'primevue/tieredmenu'
import { createVNode, getCurrentInstance, ref, render } from 'vue'

type Menu = InstanceType<typeof TieredMenu>

export function useTieredMenu() {
  let vm: VNode

  const items = ref([
    { label: 'cdpf', icon: 'pi pi-copy' },
    { label: 'aaaa', icon: 'pi pi-file-edit' },
  ])

  const instance = getCurrentInstance()
  const show = (event: Event, props: any) => {
    if (!vm) {
      vm = createVNode(TieredMenu, { model: items.value, popup: true, ...props })
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
