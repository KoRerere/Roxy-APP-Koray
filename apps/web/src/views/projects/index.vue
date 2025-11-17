<script setup lang="tsx">
import RxAvatar from '/@/components/rx-avatar'
import InviteUserModal from '/@/views/projects/components/invite-user-modal.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProjectPin } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useUserStore } from '/@/stores/user'
import { BUSINESS_CODE } from '/@/constants/business-code'
import { SubLevelEnum } from '/@/enums/pay'
import { usePopupMenu } from '/@/hooks/usePopupMenu';
import { useDialog } from '/@/hooks/useDialog'
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'

type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>

const tableRef = useTemplateRef('project')
const confirm = useConfirm()
const [_, onlyErrorToast] = useResponseToast()
const [projectModfiyDialog] = useProjectActions({ toast: false })
const [showModal] = useDialog()
const { getProjects } = useProjectStore()
const { currentWorkspace } = useWorkspaceStore()
const { handleBusinessCode } = useHandleBusinessCode()
const { userPayInfo, userInfo } = storeToRefs(useUserStore())
const { showMenu: showPopupMenu } = usePopupMenu()

const columns = [
  {
    title: $t('项目信息'),
    key: 'projectName',
    slot: 'projectName',
  },
  {
    title: $t('操作'),
    key: 'action',
    slot: 'action',
  },
  {
    title: $t('窗口数量'),
    render: ({ data }: any) => data.windowCount ? data.windowCount : '--'
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

async function tableRequest(params: any) {
  getProjects()
  return API.limit.userGetProjectInfoByWorkspaceList({ ...params, default: 2 })
}

function getOperation(data: Project) {
  const pinStatus = data.user_info!.find(item => item.userId === userInfo.value.id)?.pinStatus
  const isPinned = pinStatus === ProjectPin.pinned

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
      inviteUserInProject(data)
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

async function onRowReorder({ value }: any) {
  const params = tableRef.value?.getParams()

  const { projectIds, projectSortNumList } = value.reduce((acc: any, item: any, index: number) => {
    acc.projectIds.push(item.project_id)
    acc.projectSortNumList.push(index + 1)
    return acc
  }, { projectIds: [], projectSortNumList: [] } as Record<string, any[]>)

  const { code, msg } = await API.limit.userMdfProjectSortCreate({
    projectIds,
    projectSortNumList,
    page_index: params?.page_index ?? 1,
    page_size: params?.page_size ?? 10,
  })

  onlyErrorToast(code, msg)
  if (code !== 0) return
  tableRef.value?.updateDataList(value)
  getProjects()
}

async function pinProject(data: Project) {
  const oldPinStatus = data.user_info!.find(item => item.userId === userInfo.value.id)?.pinStatus
  const pinStatus = oldPinStatus === ProjectPin.pinned ? ProjectPin.none : ProjectPin.pinned

  const { code, msg } = await API.limit.userMdfProjectInfoCreate({ id: data.project_id!, pinStatus })
  if (code === 0) {
    tableRef.value?.refresh()
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

async function inviteUserInProject(project: Project) {
  const { user_info, projectName, project_id } = project
  const { data: { rows: allMembers } } = await API.team.userGetMemberInfoByWorkspaceList({})

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => <InviteUserModal
        v-model:currentMembers={user_info}
        allMembers={allMembers}
        project={{ projectName, projectId: project_id }}
        onClose={hideModal}
      />
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <ViewsHeader :divider="false" :title="$t('项目管理')">
      <RxButton v-if="role.isOwner || role.isManager" size="xxs" icon="base/rx_ic_plus" :label="$t('创建项目')" @click.stop="operationHandler({ name: 'create' })" />
    </ViewsHeader>
    <div class="flex-1 flex overflow-hidden">
      <RyTable ref="project" data-key="project_id" cache-key="project-list" v-model:columns="columns" :table-request="tableRequest" :table-operation="getOperation" :show-table-header="false"
        :show-gridlines="false" :show-actions-menu="false" :show-actions="false" @rowReorder="onRowReorder">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_stack.svg" :title="$t('暂无项目')" :desc="$t('项目功能可以帮助您将窗口或团队成员进行分配，并更高效地管理。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_stack_add" :label="$t('创建项目')" @click.stop="operationHandler({ name: 'create' })" />
              </div>
            </template>
          </CustomEmpty>
        </template>
        <template #column-before>
          <Column headerStyle="width:44px" rowReorder>
            <template #rowreordericon>
              <SvgIcon class="cursor-grab drag-mark" data-pc-section="reorderablerowhandle" name="base/rx_ic_dots_drag"></SvgIcon>
            </template>
          </Column>
        </template>
        <template #projectName="{ data }">
          <RouterLink class="flex items-center gap-2 name text-[var(--colors-text-text-primary)]" :to="{ name: 'project-item', params: { id: data.project_id }, query: { title: data.projectName } }"
            @click.stop.prevent>
            <RxSvgIcon name="base/rx_ic_stack" />
            <span>{{ data.projectName }}</span>
          </RouterLink>
        </template>
        <template #action="{ data }">
          <RouterLink class="flex items-center gap-2 name" :to="{ name: 'project-item', params: { id: data.project_id }, query: { title: data.projectName } }" @click.stop.prevent>
            <RxButton :label="$t('查看详情')" outlined severity="secondary" size="xs" />
          </RouterLink>
        </template>
        <template #actions="{ data }">
          <Actions :operation="getOperation(data)" @quick-click="operationHandler($event, data)" @more="showOperationMenu" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.name {
  font-size: 13px;
  -webkit-user-drag: none
}
</style>
