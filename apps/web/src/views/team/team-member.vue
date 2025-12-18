<script setup lang="tsx">
import MemberInfo from '/@/views/team/components/member-info.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import InviteUserModal from '/@/views/projects/components/invite-user-modal.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useInviteUserFormDialog } from '/@/views/projects/hooks/useInviteUserFormDialog'
import { useUserStore } from '/@/stores/user'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { BUSINESS_CODE } from '/@/constants/business-code'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import useColumns from '/@/hooks/useColumns'
import { getRoleLabelMap, Membership, Role } from '/@/enums'
import type { UnwrapRowType, UserGetMemberInfoByWorkspaceListData } from '@roxy/backend-api'

const roleLabelMap = getRoleLabelMap()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const [showModal] = useDialog()
const confirm = useConfirm()
const workspaceStore = useWorkspaceStore()
const role = useRoleStore()
const { userPayInfo } = storeToRefs(useUserStore())
const { handleBusinessCode } = useHandleBusinessCode()
const [_, onlyErrorToast] = useResponseToast()

const tableRef = useTemplateRef('team')

type TableRow = UnwrapRowType<UserGetMemberInfoByWorkspaceListData>

const { columns } = useColumns({
  key: 'team.list',
  data: [
    {
      title: $t('成员信息'),
      key: 'member',
      slot: 'member',
    },
    {
      title: $t('成员状态'),
      key: 'status',
      getText: (row: TableRow) => row.status === Membership.joinIn ? $t('已加入') : $t('等待确认'),
    },
    {
      title: $t('身份'),
      key: 'source',
      getText: (row: TableRow) => roleLabelMap[row.role as Role],
    },
    {
      title: $t('已关联项目'),
      key: 'relatedProjects',
      slot: 'related',
    },
    {
      title: $t('操作'),
      slot: 'actions',
    },
  ],
}, (role.isOwner || role.isManager) ? undefined : ['relatedProjects'])

const filters = reactive({
  value: undefined,
  options: [
    {
      name: $t('全部'),
      value: undefined,
    },
    {
      name: $t('管理者'),
      value: Role.MANAGER,
    },
    {
      name: $t('编辑者'),
      value: Role.EDITOR,
    },
    {
      name: $t('查看者'),
      value: Role.VIEWER,
    },
  ],
  onChange() {
    tableRef.value?.refresh({ role: filters.value })
  },
  resetFilters() {
    filters.value = undefined
    filters.onChange()
  },
})

const members = ref()
const allProjects = ref()
const currentRole = computed(() => workspaceStore.currentWorkspace?.role ?? -1)

async function tableRequest(params: any) {
  const data = await API.team.userGetMemberInfoByWorkspaceList(params)
  members.value = data.data.rows.filter((item: any) => item.role !== Role.OWNER)
  return data
}

function tableOperation(data: TableRow) {
  // 只能修改比自己权限低的成员
  const disabled = currentRole.value <= data.role
  return [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      disabled,
      disabledTooltip: $t('权限不足'),
      power: !role.isViewer,
      quick: true,
      tooltip: $t('编辑'),
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      disabled,
      disabledTooltip: $t('权限不足'),
      power: !role.isViewer,
      quick: true,
      tooltip: $t('删除'),
    },
  ]
}

function operationHandler(operate: any, data: TableRow) {
  switch (operate.name) {
    case 'edit':
      editMember(data)
      break
    case 'delete':
      deleteMember(data)
      break
  }
}

function editMember(data: TableRow) {
  const { email, phone, project_info, role, userId } = data || {}
  const projectIds = project_info?.map(item => item.project_id)
  showInviteUserFormDialog({
    email,
    phone,
    projectIds,
    role,
    userId,
    disableds: ['email'],
    handleOk: () => {
      filters.onChange()
    },
  })
}

async function deleteMember(data: TableRow) {
  confirm.require({
    header: $t('删除成员'),
    message: $t('您确认要删除该成员吗？'),
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
      const projectIds = data.project_info.map(item => item.project_id)
      const { code, msg } = await API.team.userDelTeamInfoCreate({ userId: data.userId!, role: data.role, projectIds })
      onlyErrorToast(code, msg)
      if (code !== 0)
        return
      filters.onChange()
    },
  })
}

async function getAllProjects() {
  if (allProjects.value)
    return allProjects.value
  const { code, data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
  if (code === 0) {
    allProjects.value = data.rows
  }
  return allProjects.value
}

async function handleShowInviteUserFormDialog(role = Role.VIEWER) {
  const { maxMemberCount, useMemberCount } = userPayInfo.value
  if (useMemberCount >= maxMemberCount) {
    handleBusinessCode(BUSINESS_CODE.MEMBER_MAX_LIMIT)
    return
  }

  const projects: any[] = await getAllProjects().then(res => res.map((item: any) => ({ ...item, label: item.projectName, value: item.project_id })))
  const projectValues = [projects.find(item => item.projectDefault && !item.isTransfer)?.value || projects[0].value]

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => (
        <InviteUserModal
          v-model:currentMembers={members.value}
          projects={projects}
          projectValues={projectValues}
          multiple={true}
          inviteRole={role}
          onClose={hideModal}
          onBeforeClose={(refresh) => {
            if (refresh) {
              filters.onChange()
            }
          }}
        />
      ),
    },
  })
}
</script>

<template>
  <RyTable ref="team" v-model:columns="columns" scrollable :table-operation="tableOperation" :operation-handler="operationHandler" :table-request="tableRequest" :show-gridlines="false"
           :paginator="false" :show-actions-menu="false" :show-actions="false"
  >
    <template #display-before>
      <RxButton v-if="!role.isViewer" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click.stop="handleShowInviteUserFormDialog()" />
    </template>
    <template #filter-after>
      <div class="flex items-center justify-between w-full">
        <RxSelectButton v-model="filters.value" :options="filters.options" size="xxs" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
      </div>
    </template>
    <template #table-empty>
      <CustomNewEmpty icon="base/rc_ic_user_referral" img="empty-teams.png" :title="$t('暂无团队成员')" :desc="$t('邀请团队成员加入空间以管理，并高效地分配窗口或项目的权限。')">
        <template #extra>
          <div class="flex gap-3">
            <RxButton v-if="currentRole > filters.value!" outlined severity="secondary" size="md" icon="base/rx_ic_user_add" :label="$t('邀请')"
                      @click.stop="handleShowInviteUserFormDialog(filters.value)"
            />
            <TutorialVideo video-type="team_management" :autoplay="false" />
          </div>
        </template>
      </CustomNewEmpty>
    </template>
    <template #member="{ data }">
      <MemberInfo :avatar="data.avatar" :user-name="data.userName" :avatar-color="data.avatarColor" :email="data.email" :phone="data.phone" />
    </template>
    <template #related="{ data }">
      <RelatedInfo :list="data.project_info" :show-max="1" icon="base/rx_ic_stack" field="projectName" />
    </template>
    <template #actions="{ data }">
      <Actions :operation="tableOperation(data)" :show-menu="false" @quick-click="operationHandler($event, data)" />
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.header {
  &-guide {
    gap: var(--spacing-sm, 4px);
    color: var(--colors-text-text-brand, #12a3fc);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
