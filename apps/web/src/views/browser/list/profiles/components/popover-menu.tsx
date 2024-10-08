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
      <Popover ref={opRef} onHide={_onHide}>
        {operation && (
          <Menu
            model={operation}
            v-slots={{
              item: ({ item, props }: any) => (
                <a v-ripple class="flex items-center" {...props.action}>
                  <label class="cursor-pointer w-full" for={item.value}>
                    {
                      type === 'radio'
                      && <RadioButton v-model={selected.value} name="radio" input-id={item.value} value={item.value} />
                    }
                    {
                      type === 'checkbox'
                      && <Checkbox v-model={selected.value} name="checkbox" input-id={item.value} value={item.value} />
                    }
                    <span>{item.label}</span>
                  </label>
                </a>
              ),
            }}
          >
          </Menu>
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
