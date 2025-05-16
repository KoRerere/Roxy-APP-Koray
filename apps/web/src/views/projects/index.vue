<script setup lang="tsx">
import RxAvatar from '/@/components/rx-avatar'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProjectPin } from '/@/enums/project'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useUserStore } from '/@/stores/user'
import { BUSINESS_CODE } from '/@/constants/business-code'
import { SubLevelEnum } from '/@/enums/pay'
import { usePopupMenu } from '/@/hooks/usePopupMenu';
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'

type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>

const tableRef = useTemplateRef('account')
const confirm = useConfirm()
const [showToast, onlyErrorToast] = useResponseToast()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const [projectModfiyDialog] = useProjectActions({ toast: false })
const { getProjects } = useProjectStore()
const { currentWorkspace } = useWorkspaceStore()
const { handleBusinessCode } = useHandleBusinessCode()
const { userPayInfo } = storeToRefs(useUserStore())
const { showMenu: showPopupMenu } = usePopupMenu()

const columns = [
  {
    title: $t('项目信息'),
    key: 'projectName',
    slot: 'projectName',
  },
  {
    title: $t('成员'),
    render: ({ data }: any) => {
      const list = data.user_info.map((item: any) => ({
        avatar: item.avatar,
        name: item.userName.slice(0, 2),
        color: item.avatarColor,
      }))
      return <RxAvatar list={list} size={28} font-size={14} />
    },
  },
  {
    title: $t('其他'),
    style: 'width: 9rem',
    slot: 'actions',
  },
]

const role = useRoleStore()

function getOperation(data: Project) {
  const isPinned = data.pinStatus === ProjectPin.pinned

  return [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: role.isOwner || role.isManager,
      disabled: !!data.projectDefault || !!data.isTransfer,// 1 默认项目 0 非默认项目
      command: ({ item }: any) => {
        operationHandler(item, data)
      }
    },
    {
      name: 'pin',
      label: isPinned ? $t('取消固定到侧边栏') : $t('固定到侧边栏'),
      icon: isPinned ? 'base/rx_ic_pin_solid' : 'base/rx_ic_pin_line',
      iconClass: isPinned ? 'text-orange' : '',
      power: role.isOwner || role.isManager,
      tooltip: isPinned ? $t('取消固定到侧边栏') : $t('固定到侧边栏'),
      quick: true,
      command: ({ item }: any) => {
        operationHandler(item, data)
      }
    },
    {
      name: 'invite',
      label: $t('邀请'),
      icon: 'base/rx_ic_user_add',
      power: role.isOwner || role.isManager || role.isEditor,
      tooltip: $t('邀请'),
      quick: true,
      command: ({ item }: any) => {
        operationHandler(item, data)
      }
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
      disabled: !!data.projectDefault || !!data.isTransfer,// 1 默认项目 0 非默认项目
      command: ({ item }: any) => {
        operationHandler(item, data)
      }
    },
  ]
}

function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':

      const { freeProjectCount, useProjectCount, subLevel } = userPayInfo.value

      if ([SubLevelEnum.Free, SubLevelEnum.Expired].includes(subLevel as SubLevelEnum) && useProjectCount >= freeProjectCount) {
        handleBusinessCode(BUSINESS_CODE.PROJECT_MAX_LIMIT)
        return
      }

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
      showInviteUserFormDialog({ projectIds: [data.project_id], tableRef: tableRef as any })
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

function tableRequest(params: any) {
  getProjects()
  return API.limit.userGetProjectInfoByWorkspaceList({ ...params, default: 2 })
}

async function pinProject(data: Project) {
  const isPinned = data.pinStatus === ProjectPin.pinned
  const pinStatus = isPinned ? ProjectPin.none : ProjectPin.pinned

  const { code, msg } = await API.limit.userMdfProjectInfoCreate({ id: data.project_id as number, pinStatus: pinStatus as number })
  if (code === 0) {
    tableRef.value?.refresh()
    showToast(code, isPinned ? $t('取消固定到侧边栏') : $t('成功固定到侧边栏'))
  } else {
    onlyErrorToast(code, msg)
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
      await electronAPI.send('util:removeProject', { workspaceId: currentWorkspace?.id as number, projectId: item.project_id as number })
      const { code, msg } = await API.limit.userDelProjectInfoCreate({ projectId: item.project_id! })
      onlyErrorToast(code, msg || $t('删除失败'))
      if (code === 0) {
        tableRef.value?.refresh()
      }
    },
  })
}

function showOperationMenu({ event, operation }: { event: MouseEvent, operation: any }) {
  showPopupMenu(event, {
    model: operation,
  })
}
</script>

<template>
  <div class="flex flex-col h-full account">
    <ViewsHeader class="account-header" :title="$t('项目管理')">
      <RxButton v-if="role.isOwner || role.isManager" size="xxs" severity="info" icon="base/rx_ic_plus" :label="$t('创建项目')" @click.stop="operationHandler({ name: 'create' })" />
    </ViewsHeader>
    <div class="account-content">
      <RyTable ref="account" data-key="project_id" cache-key="project-list" v-model:columns="columns" :table-request="tableRequest" :table-operation="getOperation" :show-table-header="false"
        :show-gridlines="false" :show-actions-menu="false" :show-actions="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_stack.svg" :title="$t('暂无项目')" :desc="$t('项目功能可以帮助您将窗口或团队成员进行分配，并更高效地管理。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_stack_add" :label="$t('创建项目')" @click.stop="operationHandler({ name: 'create' })" />
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
          <Actions :operation="getOperation(data)" @quick-click="operationHandler($event, data)" @more="showOperationMenu" />
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
