import type { FormSchema, RxFormProps } from '/@/components/rx-form/'
import Dialog, { type DialogProps, type DialogSlots } from 'primevue/dialog'
import { createVNode, type FunctionalComponent, type HTMLAttributes, render, type VNode } from 'vue'
import { RxForm } from '/@/components/rx-form'
import RxButton from '/@/components/ry-button/'

interface FormDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  handleCancel?: () => void
  handleOk?: (formModel: Recordable) => void
  schemas?: FormSchema[]
  formProps?: Partial<RxFormProps>
  dialogSlots?: Partial<FormDialogSlots>
}

interface FormDialogSlots extends DialogSlots {
}

export function useFormDialog() {
  let _modalInstance: any
  const appContext = getCurrentInstance()!.appContext

  const visible = ref(false)
  const formRef = ref<InstanceType<typeof RxForm>>()
  const innerProps = ref<FormDialogProps>({})

  const FormDialogComponent: FunctionalComponent<FormDialogProps> = (props, { slots }) => {
    const { formProps, schemas, handleCancel, handleOk, dialogSlots, ...dialogProps } = innerProps.value

    const __dialogSlots = {
      footer: () => (
        <div class="flex justify-end gap-2">
          <RxButton type="button" label="Cancel" severity="secondary" onClick={handleCancel}></RxButton>
          <RxButton type="button" label="Save" onClick={handleOk}></RxButton>
        </div>
      ),
      ...dialogSlots,
    }

    return (
      <Dialog v-slots={__dialogSlots} contentClass="!pb-2" modal {...dialogProps} v-model:visible={visible.value}>
        <RxForm ref={formRef} {...formProps} schemas={schemas} footer={false}></RxForm>
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

  const rewriteProps = (props?: FormDialogProps) => {
    return {
      ...props,
      handleCancel: () => {
        hideModal()
        props?.handleCancel?.()
      },
      handleOk: async () => {
        const res = await formRef.value?.submit()
        await props?.handleOk?.(res!)
        hideModal()
      },
    }
  }

  async function showModal(props: FormDialogProps) {
    innerProps.value = rewriteProps(props)
    await renderDialog()
    visible.value = true
  }

  function hideModal() {
    visible.value = false
  }

  const instance = {
    formRef,
    showModal,
    hideModal,
    handleOk: () => innerProps.value.handleOk?.(),
    handleCancel: () => innerProps.value.handleCancel?.(),
  }

  return [instance]
}
