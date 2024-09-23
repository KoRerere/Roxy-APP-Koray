import { defineFormSchema } from '/@/components/rx-form'

export const projectFormSchemas = defineFormSchema([
  {
    field: 'projectName',
    component: 'InputText',
    label: 'Type your project name down below',
    componentProps: {
      placeholder: 'Project name...',
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, 'Project name is required')
          .min(2, 'Project name must be at least 2 characters long')
          .max(30, 'Project name must be less than 30 characters')
      },
    },
  },
])
