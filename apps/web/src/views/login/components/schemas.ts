import { defineFormSchema } from '/@/components/rx-form/'
import { $t } from '/@/locales'

export const formSchemas = defineFormSchema([
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
        return zod.string()
          .min(1, $t('login.emailRequired'))
        // .email('Invalid email address')
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
        return zod.string()
          .min(1, $t('login.passwordRequired'))
          .min(6, $t('login.passwordMinLength'))
          .max(20, $t('login.passwordMaxLength'))
      },
    },
  },
])
