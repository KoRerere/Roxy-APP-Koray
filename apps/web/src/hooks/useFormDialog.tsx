import type { DialogProps, DialogSlots } from 'primevue/dialog'
import type { HTMLAttributes } from 'vue'
import type { FormSchema, RxFormProps } from '/@/components/rx-form/'
import { RxForm } from '/@/components/rx-form'
import { useDialog } from '/@/hooks/useDialog'

interface FormDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  handleCancel?: () => any
  handleOk?: (formModel: Recordable) => any
  schemas?: FormSchema[]
  formProps?: Partial<RxFormProps>
  dialogSlots?: Partial<FormDialogSlots>
}

interface FormDialogSlots extends DialogSlots {
}

export function useFormDialog() {
  const [dialogInstance] = useDialog()

  const formRef = ref<InstanceType<typeof RxForm>>()
  const innerProps = ref<FormDialogProps>({})

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
    await dialogInstance.showModal({
      ...innerProps.value,
      slots: {
        default: () => {
          return <RxForm ref={formRef} {...innerProps.value.formProps} schemas={innerProps.value.schemas} footer={false}></RxForm>
        },
        ...innerProps.value.dialogSlots,
      },
    })
  }

  function hideModal() {
    dialogInstance.hideModal()
  }

  const instance = {
    formRef,
    showModal,
    hideModal,
    handleOk: (formModel: Recordable) => innerProps.value.handleOk?.(formModel),
    handleCancel: () => innerProps.value.handleCancel?.(),
  }

  return [instance]
}
