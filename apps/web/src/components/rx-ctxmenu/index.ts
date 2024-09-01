import { createVNode, getCurrentInstance, render } from "vue";
import type ContextMenu from "primevue/contextmenu";
import rxMenu from "./index.vue";

type Menu = InstanceType<typeof ContextMenu>;

export function useContextMenu() {
  let vm: VNode;
  const instance = getCurrentInstance();

  const show = (event: Event, props: any) => {
    vm = createVNode(rxMenu, props);
    vm.appContext = instance!.appContext;
    render(vm, document.body);
    nextTick(() => {
      (vm.component?.refs.ctxMenu as Menu).show(event);
    });
  };

  const hide = () => {
    (vm.component?.refs.ctxMenu as Menu).hide();
  };

  return [show, hide];
}
