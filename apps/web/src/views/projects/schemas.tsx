import { API } from '/@/api'
import { defineFormSchema } from '/@/components/rx-form'
import { $t } from '/@/locales'
import InputWithRole from './components/input-with-role.vue'

export const projectFormSchemas = defineFormSchema([
  {
    field: 'projectName',
    component: 'InputText',
    componentProps: {
      placeholder: $t('请输入您的项目名称'),
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, $t('请输入您的项目名称'))
          .min(2, $t('项目名称必须大于 1 个字符'))
          .max(30, $t('项目名称最多不超过 30 个字符'))
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
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, $t('请输入邮箱'))
          .email($t('请输入正确的邮箱'))
      },
    },
  },
  {
    field: 'projectIds',
    component: 'MultiSelect',
    label: `${$t('邀请至项目')}`,
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
          .min(1, $t('请选择项目'))
      },
    },
  },
])
