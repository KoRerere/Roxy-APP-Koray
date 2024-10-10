import { defineFormSchema } from '/@/components/rx-form/'
import { $t } from '/@/locales'

export function getFormSchemas(isRegister = false) {
  return defineFormSchema([
    {
      field: 'user_name',
      component: 'InputText',
      label: () => $t('login.email'),
      componentProps: {
        placeholder: () => $t('login.email'),
      },
      rule: {
        trigger: 'change',
        validator(zod) {
          const z = zod.string().min(1, $t('login.emailRequired'))
          if (isRegister) {
            return z.email('Invalid email address')
          }
          return z.min(1, $t('login.emailRequired'))
        },
      },
    },
    {
      field: 'password',
      component: 'Password',
      label: () => $t('login.password'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => $t('login.password'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
            .min(1, $t('login.passwordRequired'))
            .min(6, $t('login.passwordMinLength'))
            .max(12, $t('login.passwordMaxLength'))

          if (isRegister) {
            return z.refine((val) => {
              return /[a-z]/i.test(val) && /\d/.test(val)
            }, {
              message: 'Password must contain at least one letter and one number',
            })
          }
          return z
        },
      },
    },
  ])
}
