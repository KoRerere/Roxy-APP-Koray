import type { MenuItem } from 'primevue/menuitem'
import Menu from 'primevue/menu'
import Popover from 'primevue/popover'
import { createVNode, getCurrentInstance, render } from 'vue'

interface Items extends Omit<MenuItem, 'command'> {
  command: () => any
}
interface Props {
  model: Items[]
  beforeCmp?: () => any
  afterCmp?: () => any
}

export function usePopoverMenu() {
  const appContext = getCurrentInstance()!.appContext

  const opRef = ref<InstanceType<typeof Popover>>()
  const innerProps = ref<Props>()

  const dcmp = defineComponent(() => {
    function onItemClick() {
      opRef.value?.hide()
    }

    return () => (
      <Popover ref={opRef} pt={{ root: 'min-w-50 !before:content-none !after:content-none', content: '!pa-0' }}>
        {innerProps.value?.beforeCmp?.()}
        {innerProps.value?.model && (
          <div class="overflow-y-auto max-h-65">
            <Menu
              pt={{ root: '!border-0 !rounded-b-none', list: '!py-1.5 !px-1 !gap-0' }}
              model={innerProps.value.model}
              v-slots={{
                item: ({ item, props }: any) => (
                  <a v-ripple class="flex items-center !py-2 !px-2.5 max-w-60" {...props.action}>
                    {
                      item.render ? item.render() : <div class="w-full text-4 ellipsis-1 cursor-pointer" title={item.label}>{item.label}</div>
                    }
                  </a>
                ),
              }}
            >
            </Menu>
          </div>
        )}
        {innerProps.value?.afterCmp?.()}
      </Popover>
    )
  })

  const renderCmp = async () => {
    const vnode = createVNode(dcmp)
    vnode.appContext = appContext
    render(null, document.body)
    render(vnode, document.body)
    await nextTick()
  }

  const showMenu = async (event: Event, props: Props) => {
    innerProps.value = props
    await renderCmp()
    opRef.value?.toggle(event, event.target)
  }
  return [showMenu]
}
