import { defineFormSchema } from './'

export const formSchemas = defineFormSchema([
  {
    field: 'user_name',
    component: 'InputText',
    label: 'Name',
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, 'Name is required')
          .min(2, 'Name must be at least 2 characters long')
          .max(30, 'Name must be less than 30 characters')
      },
    },
  },
  {
    field: 'email',
    component: 'InputText',
    label: 'Email',
    rule: {
      trigger: 'change',
      validator(zod) {
        return zod.string()
          .min(1, 'Email is required')
          .email('Invalid email address')
      },
    },
  },
  {
    field: 'password',
    component: 'InputText',
    label: 'Password',
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
