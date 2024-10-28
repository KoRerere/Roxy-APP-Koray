<script setup lang="tsx">
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import useColumns from '/@/hooks/useColumns'
import { $t } from '/@/locales'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import columnsRow from './columns'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'

const tableRef = useTemplateRef('accountTable')
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const toast = useToast()
const confirm = useConfirm()
const { getProjects } = useProjectStore()
const { currentWorkspace } = useWorkspaceStore()

const [projectModfiyDialog] = useProjectActions()

const [columns] = useColumns(columnsRow)

const role = useRoleStore()

const operation = ref([
  {
    name: 'edit',
    label: $t('Edit'),
    icon: 'base/rx_ic_edit',
    power: role.isOwner,
    quick: true,
  },
  {
    name: 'invite',
    label: $t('Invite'),
    icon: 'base/rx_ic_user_add',
    power: role.isOwner,
    quick: true,
  },
  {
    name: 'delete',
    label: $t('Delete'),
    icon: 'base/rx_ic_bin_1',
    power: role.isOwner,
    quick: true,
  },
])

function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':
      projectModfiyDialog({
        confirmNext: () => {
          tableRef.value?.refresh()
        },
      })
      break
    case 'invite':
      showInviteUserFormDialog({ projectIds: [data.project_id], tableRef })

      break
    case 'edit':
      projectModfiyDialog({
        ...data,
        confirmNext: () => {
          tableRef.value?.refresh()
        },
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
    message = $t('您确认要删除 {projectName} 项目吗？该操作会移除所有项目成员，且所有窗口将回归默认项目。', { projectName: item.projectName })
  }

  confirm.require({
    header: $t('删除项目'),
    message,
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
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
    <ViewsHeader class="account-header" :title="$t('项目管理')">
      <RxButton v-if="role.isOwner" size="xxs" severity="info" icon="base/rx_ic_plus" :label="$t('创建项目')" @click="operationHandler({ name: 'create' })" />
    </ViewsHeader>
    <div class="account-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="accountTable" :columns="columns" :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler" :show-gridlines="false" :show-actions-menu="false"
        :show-actions="false" data-key="project_id">
        <template #table-empty>
          <CustomEmpty icon="empty/rx_illustration_stack.svg" :title="$t('暂无项目')" :desc="$t('项目功能可以帮助您将窗口或团队成员进行分配，并更高效地管理。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_stack_add" :label="$t('创建项目')" @click="operationHandler({ name: 'create' })" />
                <RxButton text severity="secondary" size="xs" :label="$t('项目文档')" />
              </div>
            </template>
          </CustomEmpty>
        </template>

        <template #open="{ data }">
          <router-link :to="{ name: 'project-item', params: { id: data.project_id }, query: { title: data.projectName } }" class="text-black">
            <span class="text-[blue]">{{ data.projectName }}</span>
          </router-link>
        </template>
        <template #members="{ data }">
          <AvatarGroup>
            <template v-for="person in data.user_info" :key="person.userId">
              <Avatar v-if="person.avatar" v-tooltip.top="person.userName" :image="person.avatar" shape="circle" />
              <Avatar v-else v-tooltip.top="person.userName" :label="person.userName?.at(0)" shape="circle" />
            </template>
          </AvatarGroup>
        </template>
        <template #actions="{ data }">
          <Actions :operation="operation" :show-menu="false" @quick-click="operationHandler($event, data)" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account {
  &-header {
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
