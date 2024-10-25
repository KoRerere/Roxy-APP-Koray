import Dialog, { type DialogProps, type DialogSlots } from 'primevue/dialog'
import { createVNode, type DefineComponent, type FunctionalComponent, type HTMLAttributes, render, type VNode } from 'vue'
import RxButton from '/@/components/rx-button/'
import { $t } from '/@/locales'

export interface UseDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  handleCancel?: () => void
  handleOk?: () => void
  slots?: Partial<DialogSlots>
}

export function useDialog(comp?: VNode | DefineComponent) {
  let _modalInstance: any
  const appContext = getCurrentInstance()!.appContext

  const visible = ref(false)
  const innerProps = ref<UseDialogProps>({})

  const FormDialogComponent: FunctionalComponent<UseDialogProps> = () => {
    const { handleCancel, handleOk, slots, ...dialogProps } = innerProps.value

    const __dialogSlots = {
      footer: () => (
        <div class="flex justify-end gap-2">
          <RxButton type="button" label={$t('取消')} outlined severity="secondary" onClick={handleCancel}></RxButton>
          <RxButton type="button" label={$t('保存')} onClick={handleOk}></RxButton>
        </div>
      ),
      default: slots?.default || comp,
      ...slots,
    }

    return (
      <Dialog v-slots={__dialogSlots} contentClass="!pb-2" modal {...dialogProps} v-model:visible={visible.value}>
      </Dialog>
    )
  }

  const renderDialog = async () => {
    if (_modalInstance) {
      return _modalInstance
    }
    const div = document.createElement('div')
    const vnode = createVNode(FormDialogComponent)
    vnode.appContext = appContext
    render(vnode, div)
    _modalInstance = vnode.component!
    await nextTick()
    return _modalInstance
  }

  const rewriteProps = (props?: UseDialogProps) => {
    return {
      ...props,
      handleCancel: () => {
        hideModal()
        props?.handleCancel?.()
      },
      handleOk: async () => {
        await props?.handleOk?.()
        hideModal()
      },
    }
  }

  async function showModal(props: UseDialogProps) {
    innerProps.value = rewriteProps(props)
    await renderDialog()
    visible.value = true
  }

  function hideModal() {
    visible.value = false
  }

  const instance = {
    showModal,
    hideModal,
    handleOk: () => innerProps.value.handleOk?.(),
    handleCancel: () => innerProps.value.handleCancel?.(),
  }

  return [instance]
}
