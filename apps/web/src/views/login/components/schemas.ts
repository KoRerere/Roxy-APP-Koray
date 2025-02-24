import type { z } from 'zod'
import { defineFormSchema } from '/@/components/rx-form/'
import { $t } from '/@/locales'

export function getRegisterValidation(z: z.ZodString) {
  const tip = $t('必须包含数字和字母，6-20位')

  return z.min(6, tip).max(20, tip).refine((val) => {
    return /[a-z]/i.test(val) && /\d/.test(val)
  }, {
    message: tip,
  })
}

export function getFormSchemas(isRegister = false) {
  return defineFormSchema([
    ...getEmailSchemas(isRegister),
    {
      field: 'password',
      component: 'Password',
      label: () => $t('密码'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => isRegister ? $t('请设置您的密码') : $t('请输入您的密码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()

          if (isRegister) {
            return getRegisterValidation(zod.string().min(1, $t('请设置您的密码')))
          }
          return z.min(1, $t('请输入您的密码'))
        },
      },
    },
  ])
}

export function getEmailSchemas(isRegister = false) {
  return defineFormSchema([
    {
      field: 'user_name',
      component: 'InputText',
      label: $t('邮箱'),
      componentProps: {
        placeholder: $t('请输入您的邮箱'),
      },
      rule: {
        trigger: 'change',
        validator(zod) {
          const z = zod.string()
          if (isRegister) {
            return z.min(1, $t('请输入您的邮箱')).email($t('请输入正确的邮箱'))
          }
          return z.min(1, $t('请输入您的邮箱'))
        },
      },
    }
  ])
}

export function getResetPasswordSchemas() {
  return defineFormSchema([
    {
      field: 'newPassword',
      component: 'Password',
      label: $t('新密码'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => $t('请输入您的新密码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
          return getRegisterValidation(z.min(1, $t('请输入您的新密码')))
        },
      },
    },
    {
      field: 'confirmPassword',
      component: 'Password',
      label: $t('确认密码'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => $t('请再次输入您的新密码'),
      },
      rule: {
        validator(zod, formModel) {
          const z = zod.string()
          return z
            .min(1, $t('请再次输入您的新密码'))
            .refine((val) => {
              return val === formModel.value.newPassword
            }, {
              message: $t('两次输入的密码不一致'),
            })
        },
      },
    },
  ])
}
