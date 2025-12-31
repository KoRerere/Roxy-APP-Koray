import { API } from '/@/api'
import { defineFormSchema } from '/@/components/rx-form'

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

export function getInviteUsersFormSchemas(projectIds = []) {
  let allProjectIds: number[] = []
  return defineFormSchema([
    {
      field: 'email',
      component: ({ formModel, schema }) => {
        return (
          <InputWithRole
            v-model:role={formModel.value.role}
            onUpdate:role={(val) => {
              if (val === 2) {
                formModel.value.projectIds = allProjectIds
              }
              else {
                formModel.value.projectIds = projectIds
              }
            }}
          >
          </InputWithRole>
        )
      },
      rule: {
        trigger: 'blur',
        validator(zod) {
          return zod.string()
            .min(1, $t('请输入邮箱'))
        },
      },
    },
    {
      field: 'projectIds',
      component: 'MultiSelect',
      label: `${$t('邀请至项目')}`,
      vIf: ({ formModel }) => formModel.value.role !== 2,
      componentProps: {
        filter: true,
        optionLabel: 'projectName',
        optionValue: 'project_id',
        display: 'chip',
        emptyMessage: $t('暂无可加入项目，请先创建项目'),
        request: async () => {
          const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
          allProjectIds = data.rows.map(item => item.project_id!)
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
}
