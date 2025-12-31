import PhoneInput from '/@/views/login/components/phone-login/phone.vue'
import CodeInput from '/@/views/login/components/phone-login/code.vue'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import TsFormInputPassword from '/@/views/lab/components/form/m-input-password.vue'
import { defineFormSchema } from '/@/components/rx-form/'

import type { z } from 'zod'

export function getRegisterValidation(z: z.ZodString) {
  const tip = $t('必须包含数字和字母，6-20位')

  return z.min(6, tip).max(20, tip).refine((val) => {
    return /[a-z]/i.test(val) && /\d/.test(val)
  }, {
    message: tip,
  })
}

export function getEmailSchemas(isRegister = false) {
  return defineFormSchema([
    {
      field: 'user_name',
      component: ({ formModel }) => {
        return <TsFormInputText v-model={formModel.value.user_name}></TsFormInputText>
      },
      componentProps: {
        size: 'lg',
        preIcon: 'base/rx_ic_mail',
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
    },
  ])
}

export function getFormSchemas(isRegister = false) {
  return defineFormSchema([
    ...getEmailSchemas(isRegister),
    {
      field: 'password',
      component: ({ formModel }) => {
        return <TsFormInputPassword v-model={formModel.value.password}></TsFormInputPassword>
      },
      componentProps: {
        size: 'lg',
        preIcon: 'base/rx_ic_unlock',
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

export function getPhoneSchemas() {
  return defineFormSchema([
    {
      field: 'phone',
      component: ({ formModel }) => {
        return (
          <PhoneInput v-model={formModel.value.phone}></PhoneInput>
        )
      },
      componentProps: {
        size: 'lg',
        feedback: false,
        toggleMask: true,
        placeholder: $t('请输入您的手机号'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
          return z.min(1, $t('请输入您的手机号')).max(11, $t('请输入正确的手机号'))
        },
      },
    },
    {
      field: 'verCode',
      component: ({ formModel }) => {
        return (
          <CodeInput v-model={formModel.value.verCode} phone={formModel.value.phone}></CodeInput>
        )
      },
      componentProps: {
        size: 'lg',
        preIcon: 'base/rx_ic_binary',
        feedback: false,
        toggleMask: true,
        placeholder: $t('请输入您的验证码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
          return z.min(1, $t('请输入您的验证码')).max(6, $t('验证码不超过 {num} 位', { num: 6 }))
        },
      },
    },
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
