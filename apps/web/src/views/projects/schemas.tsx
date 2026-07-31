import { API } from '/@/api'
import { defineFormSchema } from '/@/components/rx-form'
import type { ProjectEntityLabels } from '/@/composables/useProjectEntityLabels'
import { createProjectEntityLabels } from '/@/composables/useProjectEntityLabels'

import InputWithRole from './components/input-with-role.vue'

/** 按术语模式生成项目/分组表单 schema */
export function createProjectFormSchemas(labels: ProjectEntityLabels) {
  return defineFormSchema([
    {
      field: 'projectName',
      component: 'InputText',
      componentProps: {
        placeholder: labels.namePlaceholder,
      },
      rule: {
        trigger: 'blur',
        validator(zod) {
          return zod.string()
            .min(1, labels.nameRequired)
            .min(2, labels.nameMinLength)
            .max(30, labels.nameMaxLength)
        },
      },
    },
  ])
}

/** @deprecated 普通模式静态 schema，新代码请使用 createProjectFormSchemas */
export const projectFormSchemas = createProjectFormSchemas(createProjectEntityLabels(false))

export function getInviteUsersFormSchemas(projectIds = [], labels = createProjectEntityLabels(false)) {
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
      label: labels.inviteToLabel,
      vIf: ({ formModel }) => formModel.value.role !== 2,
      componentProps: {
        filter: true,
        optionLabel: 'projectName',
        optionValue: 'project_id',
        display: 'chip',
        emptyMessage: $t('暂无可加入{entity}，请先创建{entity}', { entity: labels.entity }),
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
            .min(1, labels.selectPlaceholder)
        },
      },
    },
  ])
}
