import { defineFormSchema } from '/@/components/rx-form/'
import { $t } from '/@/locales'

export function getFormSchemas(isRegister = false) {
  return defineFormSchema([
    {
      field: 'user_name',
      component: 'InputText',
      label: () => $t('Email'),
      componentProps: {
        placeholder: () => $t('Email'),
      },
      rule: {
        trigger: 'change',
        validator(zod) {
          const z = zod.string().min(1, $t('Email is required'))
          if (isRegister) {
            return z.email($t('Invalid email address'))
          }
          return z.min(1, $t('Email is required'))
        },
      },
    },
    {
      field: 'password',
      component: 'Password',
      label: () => $t('Password'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => $t('Sign in password'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
            .min(1, $t('Password is required'))
            .min(6, $t('Password must be at least 6 characters'))
            .max(20, $t('Password must be at most 20 characters'))

          if (isRegister) {
            return z.refine((val) => {
              return /[a-z]/i.test(val) && /\d/.test(val)
            }, {
              message: $t('Password must contain at least one letter and one number'),
            })
          }
          return z
        },
      },
    },
  ])
}
