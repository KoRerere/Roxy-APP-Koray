<script setup lang="tsx">
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { ProjectPin } from '/@/enums/project'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import columnsRow from './columns'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'

type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>

const tableRef = useTemplateRef('accountTable')
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const toast = useToast()
const confirm = useConfirm()
const { getProjects } = useProjectStore()
const { currentWorkspace } = useWorkspaceStore()
const [show] = useContextMenu()
const [projectModfiyDialog] = useProjectActions()
const [showToast] = useResponseToast()

const [columns] = useColumns(columnsRow)

const role = useRoleStore()

function getOperation(data: Project) {
  return [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: role.isOwner || role.isManager,
    },
    {
      name: 'pin',
      label: data.topTime ? $t('取消固定到侧边栏') : $t('固定到侧边栏'),
      icon: data.topTime ? 'base/rx_ic_pin_solid' : 'base/rx_ic_pin_line',
      iconClass: data.topTime ? 'text-orange' : '',
      power: role.isOwner || role.isManager,
      quick: true,
    },
    {
      name: 'invite',
      label: $t('邀请'),
      icon: 'base/rx_ic_user_add',
      power: role.isOwner || role.isManager || role.isEditor,
      quick: true,
    },
    {
      separator: true,
      power: role.isOwner || role.isManager,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      power: role.isOwner || role.isManager,
    },
  ]
}

function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':
      projectModfiyDialog({
        confirmNext: () => {
          tableRef.value?.refresh()
        },
      })
      break
    case 'pin':
      pinProject(data)
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

async function pinProject(data: Project) {
  const topStatus = data.topTime ? ProjectPin.none : ProjectPin.pinned
  const { code, msg } = await API.limit.userMdfProjectInfoCreate({ id: data.project_id, topStatus })
  if (code === 0) {
    tableRef.value?.refresh()
    showToast(code, data.topTime ? $t('取消固定到侧边栏') : $t('成功固定到侧边栏'))
  }
  else {
    showToast(code, msg)
  }
}

function deletePopup(item: Project) {
  confirm.require({
    header: $t('删除项目'),
    message: $t('您确认要删除 {projectName} 项目吗？该操作会移除所有项目成员，且所有窗口将回归默认项目。', { projectName: item.projectName }),
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
      // 先删除本地项目
      await electronAPI.send('util:removeProject', { workspaceId: currentWorkspace?.id, projectId: item.project_id })
      const { code, msg } = await API.limit.userDelProjectInfoCreate({ projectId: item.project_id! })
      if (code === 0) {
        tableRef.value?.refresh()
        toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('删除成功'), life: 3000 })
      }
      else {
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg || $t('删除失败'), life: 3000 })
      }
    },
  })
}

function showOperationMenu({ event, operation }: { event: Event, operation: any }, data: any) {
  show(event, {
    operation,
    operationHandler: (operate: any) => operationHandler(operate, data),
  })
}
</script>

<template>
  <div class="flex flex-col h-full account">
    <ViewsHeader class="account-header" :title="$t('项目管理')">
      <RxButton v-if="role.isOwner || role.isManager" size="xxs" severity="info" icon="base/rx_ic_plus" :label="$t('创建项目')" @click="operationHandler({ name: 'create' })" />
    </ViewsHeader>
    <div class="account-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="accountTable" v-model:columns="columns" :table-request="tableRequest" :table-operation="getOperation" :operation-handler="operationHandler" :show-gridlines="false"
        :show-actions-menu="false" :show-actions="false" data-key="project_id">
        <template #table-empty>
          <CustomEmpty icon="empty/rx_illustration_stack.svg" :title="$t('暂无项目')" :desc="$t('项目功能可以帮助您将窗口或团队成员进行分配，并更高效地管理。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_stack_add" :label="$t('创建项目')" @click="operationHandler({ name: 'create' })" />
                <!-- <RxButton text severity="secondary" size="xs" :label="$t('项目文档')" /> -->
              </div>
            </template>
          </CustomEmpty>
        </template>
        <template #projectName="{ data }">
          <router-link class="flex items-center gap-2 project-name" :to="{ name: 'project-item', params: { id: data.project_id }, query: { title: data.projectName } }">
            <RxSvgIcon name="base/rx_ic_stack" />
            <span>{{ data.projectName }}</span>
          </router-link>
        </template>
        <template #actions="{ data }">
          <Actions :operation="getOperation(data)" @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
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

.project-name {
  font-size: 13px;
}
</style>
