import { defineFormSchema } from '/@/components/rx-form/'

export const formSchemas = defineFormSchema([
  {
    field: 'user_name',
    component: 'InputText',
    label: 'Email',
    componentProps: {
      placeholder: 'Email address',
    },
    rule: {
      trigger: 'change',
      validator(zod) {
        return zod.string()
          .min(1, 'Email is required')
        // .email('Invalid email address')
      },
    },
  },
  {
    field: 'password',
    component: 'Password',
    label: 'Password',
    componentProps: {
      feedback: false,
      toggleMask: true,
      placeholder: 'Login password',
    },
    rule: {
      validator(zod) {
        return zod.string()
          .min(1, 'Password is required')
          .min(6, 'Password must be at least 6 characters')
          .max(20, 'Password must be less than 20 characters')
      },
    },
  },
])
