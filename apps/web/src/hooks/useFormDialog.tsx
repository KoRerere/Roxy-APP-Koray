import type { DialogProps, DialogSlots } from 'primevue/dialog'
import type { HTMLAttributes } from 'vue'
import type { FormSchema, RxFormProps } from '/@/components/rx-form/'
import { RxForm } from '/@/components/rx-form'
import { useDialog, type UseDialogProps } from '/@/hooks/useDialog'

type FormDialogProps = UseDialogProps & {
  handleCancel?: () => any
  handleOk?: (formModel: Recordable) => any
  schemas?: FormSchema[]
  formProps?: Partial<RxFormProps>
  dialogSlots?: Partial<FormDialogSlots>
}

interface FormDialogSlots extends DialogSlots {
  beforeForm?: () => any
}

export function useFormDialog() {
  const [showDialog] = useDialog()

  async function showModal(props: FormDialogProps) {
    const formRef = ref<InstanceType<typeof RxForm>>()
    const innerProps = ref<FormDialogProps>({
      ...props,

    })

    innerProps.value = {
      ...innerProps.value,
      handleCancel: () => {
        dialogInstance.hideModal()
        props?.handleCancel?.()
      },
      handleOk: async () => {
        const res = await formRef.value?.submit()
        await props?.handleOk?.(res!)
        dialogInstance.hideModal()
      },
    }

    const dialogInstance = showDialog({
      ...innerProps.value,
      slots: {
        default: () => {
          return <>
            {innerProps.value.dialogSlots?.beforeForm?.()}
            <RxForm ref={formRef} {...innerProps.value.formProps} schemas={innerProps.value.schemas} footer={false}></RxForm>
          </>
        },
        ...innerProps.value.dialogSlots,
      },
    })

    await nextTick()

    return {
      formRef,
      hideModal: dialogInstance.hideModal,
      handleOk: () => innerProps.value.handleOk?.(),
      handleCancel: () => innerProps.value.handleCancel?.(),
    }
  }

  return [showModal]
}
