import { API } from '/@/api'
import { defineFormSchema } from '/@/components/rx-form'
import InputWithRole from './components/input-with-role.vue'

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

export const inviteUsersFormSchemas = defineFormSchema([
  {
    field: 'email',
    component: ({ formModel }) => {
      return <InputWithRole v-model:role={formModel.value.role}></InputWithRole>
    },
    componentProps: {
      placeholder: 'Enter email...',
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, 'Email is required')
          .email('Invalid email address')
      },
    },
  },
  {
    field: 'projectIds',
    component: 'MultiSelect',
    label: 'Invite to projects',
    componentProps: {
      filter: true,
      optionLabel: 'projectName',
      optionValue: 'project_id',
      display: 'chip',
      request: async () => {
        const { data } = await API.limit.userGetProjectInfoByWorkspaceList()
        return data.rows
      },
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.number()
          .array()
          .min(1, 'Project is required')
      },
    },
  },
])
