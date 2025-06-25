import { useDialog, type UseDialogProps, type UseDialogInstance } from "/@/hooks/useDialog"
import { $t } from "/@/locales"
import Verify2FA from "./verify-2fa.vue"
import type { Ref } from "vue"
import RxButton from '/@/components/rx-button'

export const useAuth2FA = (): [(options: UseDialogProps) => UseDialogInstance, Ref<string>] => {
  const [showModal] = useDialog()
  const code = ref<string>('')

  const showAuth2FA = (options: UseDialogProps) => {
    return showModal({
      header: $t('身份验证'),
      style: {
        width: '384px',
      },
      pt: {
        mask: {
          class: '!backdrop-blur',
        }
      },
      cancelText: '',
      okText: $t('确认'),
      okProps: {
        class: 'flex-1'
      },
      slots: {
        default: () => <Verify2FA modelValue={code.value} onUpdate:modelValue={(val: string | undefined) => code.value = val || ''} />,
        footer: () => <div class="w-full flex justify-end">
          <RxButton label={$t('确认')} severity="primary" class="w-full" onClick={options.handleOk} />
        </div>
      },
      ...options,
    })
  }

  return [showAuth2FA, code]
}