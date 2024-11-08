import Checkbox from 'primevue/checkbox'
import Menu from 'primevue/menu'
import Popover from 'primevue/popover'
import RadioButton from 'primevue/radiobutton'
import { createVNode, getCurrentInstance, render } from 'vue'

export function usePopoverMenu() {
  const appContext = getCurrentInstance()!.appContext

  const opRef = ref<InstanceType<typeof Popover>>()
  const innerProps = ref<any>()
  const selected = ref()

  const dcmp = defineComponent(() => {
    const { type, operation, onHide } = innerProps.value || {}

    async function _onHide() {
      await onHide?.(selected.value)
    }
    return () => (
      <Popover ref={opRef} onHide={_onHide} pt={{ root: 'min-w-50 !before:content-none !after:content-none', content: '!pa-0' }}>
        {innerProps.value.beforeCmp?.()}
        {operation && (
          <div class="overflow-y-auto max-h-65">
            <Menu
              pt={{ root: '!border-0 !rounded-b-none', list: '!py-1.5 !px-1 !gap-0' }}
              model={operation}
              v-slots={{
                item: ({ item, props }: any) => (
                  <a v-ripple class="flex items-center !py-2 !px-2.5" {...props.action}>
                    <label class="flex items-center gap-1 cursor-pointer w-full" for={item.value}>
                      {
                        type === 'radio'
                        && <RadioButton v-model={selected.value} name="radio" input-id={item.value} value={item.value} />
                      }
                      {
                        type === 'checkbox'
                        && <Checkbox v-model={selected.value} name="checkbox" input-id={item.value} value={item.value} />
                      }
                      {
                        item.render ? item.render() : <span>{item.label}</span>
                      }
                    </label>
                  </a>
                ),
              }}
            >
            </Menu>
          </div>
        )}
        {innerProps.value.afterCmp?.()}
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

  const showMenu = async (event: any, props: any) => {
    innerProps.value = props
    selected.value = props.value
    await renderCmp()
    opRef.value?.toggle(event, event.target)
  }
  return [showMenu]
}
