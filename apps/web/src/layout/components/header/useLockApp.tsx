import { defineFormSchema } from '/@/components/rx-form'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { $t } from '/@/locales'
import { useLock } from '/@/stores/lock'

const passwordSchemas = defineFormSchema([
  {
    field: 'password',
    label: $t('密码'),
    component: 'Password',
    defaultValue: '',
    componentProps: {
      toggleMask: true,
      feedback: false,
      placeholder: $t('请输入密码'),
      autofocus: true,
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(4, { message: $t('密码长度需为 4-12 位') })
          .max(12, { message: $t('密码长度需为 4-12 位') })
          .regex(/^[^\u4e00-\u9fa5]+$/, { message: $t('密码中包含不允许的字符。请使用字母、数字以及符号组合。') })
      },
    },
  },
  {
    field: 'confirmPassword',
    label: $t('确认密码'),
    component: 'Password',
    defaultValue: '',
    componentProps: {
      toggleMask: true,
      feedback: false,
      placeholder: $t('请再次输入您的密码'),
    },
    rule: {
      trigger: 'blur',
      validator(zod, data) {
        return zod.string()
          .refine((val) => {
            return val === data.value.password
          }, {
            message: $t('两次输入的密码不一致'),
          })
      },
    },
  },
])

export function useLockApp() {
  const { lockData, openLockMark, setPassword } = useLock()
  const [showFormDialog] = useFormDialog()

  function openLockApp() {
    if (lockData.password) {
      openLockMark()
      return
    }

    showFormDialog({
      header: $t('设置应用打开密码'),
      modal: true,
      draggable: false,
      class: '!w-[384px]',
      cancelText: '',
      okText: $t('确认并上锁'),
      formProps: {
        layout: 'vertical',
      },
      schemas: passwordSchemas,
      dialogSlots: {
        beforeForm: () => (
          <span class="text-sm text-gray-500">
            {$t('密码格式：4-12 个字符（字母、数字或符号）')}
          </span>
        ),
      },
      async handleOk(formValue) {
        setPassword(formValue.confirmPassword)
        openLockMark()
      },
    })
  }

  return { openLockApp }
}
