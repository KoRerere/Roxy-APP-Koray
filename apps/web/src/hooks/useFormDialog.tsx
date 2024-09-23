import type { FormSchema, RxFormProps } from '/@/components/rx-form/'
import Dialog, { type DialogProps } from 'primevue/dialog'
import { createVNode, type FunctionalComponent, type HTMLAttributes, render } from 'vue'
import { RxForm } from '/@/components/rx-form'
import RxButton from '/@/components/ry-button/'

interface FormDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  handleCancel?: () => void
  handleOk?: (formModel: Recordable) => void
  schemas?: FormSchema[]
  formProps?: Partial<RxFormProps>
}

export function useFormDialog() {
  let _modalInstance: any
  const appContext = getCurrentInstance()!.appContext

  const visible = ref(false)
  const formRef = ref<InstanceType<typeof RxForm>>()
  const innerProps = ref<FormDialogProps>({})

  const FormDialogComponent: FunctionalComponent<FormDialogProps> = () => {
    const { formProps, schemas, handleCancel, handleOk, ...dialogProps } = innerProps.value

    return (
      <Dialog modal {...dialogProps} v-model:visible={visible.value}>
        <RxForm ref={formRef} {...formProps} schemas={schemas} footer={false}></RxForm>
        <div class="flex justify-end gap-2">
          <RxButton type="button" label="Cancel" severity="secondary" onClick={handleCancel}></RxButton>
          <RxButton type="button" label="Save" onClick={handleOk}></RxButton>
        </div>
      </Dialog>
    )
  }

  const renderDialog = async () => {
    if (_modalInstance) {
      return _modalInstance
    }
    const vnode = createVNode(FormDialogComponent)
    vnode.appContext = appContext
    render(vnode, document.body)
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
    await renderDialog()
    visible.value = true
    innerProps.value = rewriteProps(props)
  }

  function hideModal() {
    visible.value = false
  }

  const instance = {
    formRef,
    showModal,
    hideModal,
  }

  return [instance]
}
