<script setup lang="tsx">
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import RxButton from '/@/components/ry-button'
import ryTable from '/@/components/ry-table'
import useColumns from '/@/hooks/useColumns'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { $t } from '/@/locales'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import columnsRow from './columns'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'
import { projectFormSchemas } from './schemas'

const tableRef = useTemplateRef('accountTable')
const [dialog] = useFormDialog()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const toast = useToast()
const confirm = useConfirm()
const { getProjects } = useProjectStore()
const { currentWorkspace } = useWorkspaceStore()

const [columns] = useColumns(columnsRow)

const role = useRoleStore()

const operation = ref([
  {
    name: 'edit',
    label: $t('Edit'),
    icon: 'base/rx_ic_edit',
    power: role.isOwner || role.isManager,
    quick: true,
  },
  {
    name: 'invite',
    label: $t('Invite'),
    icon: 'base/rx_ic_user_add',
    power: role.isOwner || role.isManager,
    quick: true,
  },
  {
    name: 'delete',
    label: $t('Delete'),
    icon: 'base/rx_ic_bin_1',
    power: role.isOwner,
    quick: true,
    multiple: true,
  },
])

async function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':
      dialog.showModal({
        header: $t('Create project'),
        class: 'w-[500px]',
        schemas: projectFormSchemas,
        formProps: {
          layout: 'vertical',
        },
        async handleOk(formModel) {
          const { code, msg } = await API.limit.userAddProjectInfoCreate(formModel)
          tableRef.value?.refresh()
          if (code === 0) {
            toast.add({ severity: 'success', summary: $t('Success'), detail: $t('Create Success!'), life: 3000 })
          }
          else {
            toast.add({ severity: 'error', summary: $t('Error'), detail: msg || $t('Create failed!'), life: 3000 })
          }
        },
      })
      break
    case 'invite':
      showInviteUserFormDialog({ projectIds: [data.project_id], tableRef })

      break
    case 'edit':
      await dialog.showModal({
        header: $t('Edit project'),
        class: 'w-[500px]',
        schemas: projectFormSchemas,
        formProps: {
          layout: 'vertical',
        },
        async handleOk(formModel: any) {
          const { code, msg } = await API.limit.userMdfProjectInfoCreate({ id: data.project_id, ...formModel })
          tableRef.value?.refresh()
          if (code === 0) {
            toast.add({ severity: 'success', summary: $t('Success'), detail: $t('Edited successfully'), life: 3000 })
          }
          else {
            toast.add({ severity: 'error', summary: $t('Error'), detail: msg || $t('Edit failed'), life: 3000 })
          }
        },
      })

      dialog.formRef.value?.setFieldsValue({
        id: data.project_id,
        ...data,
      })
      break
    case 'delete':
      deletePopup(data)
      break
  }
}

function tableRequest() {
  return getProjects()
}

function deletePopup(item: UnwrapRowType<UserGetProjectInfoByWorkspaceListData>) {
  let message = ''

  if (Array.isArray(item)) {
    message = $t(`Are you sure you want to delete the {count} selected items?`, { count: item.length })
  }
  else {
    message = $t('Are you sure you want to delete the project {projectName}?', { projectName: item.projectName })
  }

  confirm.require({
    header: $t('Warn'),
    message,
    rejectProps: {
      label: $t('Cancel'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('Confirm'),
      severity: 'danger',
    },
    accept: async () => {
      const { code, msg } = await API.limit.userDelProjectInfoCreate({ projectId: item.project_id! })
      if (code === 0) {
        tableRef.value?.refresh()
        toast.add({ severity: 'success', summary: $t('Success'), detail: $t('Delete successfully'), life: 3000 })
        electronAPI.send('util:removeProject', { workspaceId: currentWorkspace?.id, projectId: item.project_id })
      }
      else {
        toast.add({ severity: 'error', summary: $t('Error'), detail: msg || $t('Delete failed'), life: 3000 })
      }
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-full account">
    <div class="flex justify-between account-header">
      <div>{{ $t('Projects') }}</div>
      <RxButton v-if="role.isOwner || role.isManager" size="small" severity="info" icon="base/rx_ic_plus"
        :label="$t('Add project')" @click="operationHandler({ name: 'create' })" />
    </div>
    <div class="account-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <ry-table ref="accountTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest"
        :operation="operation" :operation-handler="operationHandler" :show-gridlines="false" :show-actions-menu="false">
        <template #members="{ data }">
          <AvatarGroup>
            <template v-for="person in data.user_info" :key="person.userId">
              <Avatar v-if="person.avatar" v-tooltip.top="person.userName" :image="person.avatar" shape="circle" />
              <Avatar v-else v-tooltip.top="person.userName" :label="person.userName?.at(0)" shape="circle" />
            </template>
            <!-- <Avatar label="+2" shape="circle" /> -->
          </AvatarGroup>
        </template>
        <template #open="{ data }">
          <router-link
            :to="{ name: 'project-item', params: { id: data.project_id }, query: { title: data.projectName } }"
            class="text-black">
            <RxButton outlined>
              {{ $t('Detail') }}
            </RxButton>
          </router-link>
        </template>
      </ry-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account {
  &-header {
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    gap: 10px;
    height: 48px;
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-content {
    height: calc(100% - 48px);
  }
}

.platform {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
