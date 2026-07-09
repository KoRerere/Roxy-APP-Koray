<script setup lang="tsx">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import WarnTipsModal from '/@/views/team/components/warn-tips-modal.vue'
import MemberInfo from '/@/views/team/components/member-info.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import RolesDetail from '/@/views/team/components/roles-detail.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { usePermission } from '/@/hooks/usePermission'
import { useInviteUserFormDialog } from '/@/views/projects/hooks/useInviteUserFormDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useTeamStore } from '/@/stores/team'
import { useDialog } from '/@/hooks/useDialog'
import { useColumns } from '/@/hooks/useColumns'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useTeam } from '/@/views/team/hook'
import { getRoleLabelMap, Membership, Role } from '/@/enums'
import { useEmitterEvent } from '/@/utils/eventBus'

import type { UnwrapRowType, UserGetMemberInfoByWorkspaceListData } from '@roxy/backend-api'
import { compare } from 'compare-versions'
import { useUserStore } from '/@/stores/user'

const confirm = useConfirm()
const roleLabelMap = getRoleLabelMap()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { isOwner, isManager, isViewer } = storeToRefs(useRoleStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { check } = usePermission()
const { getTeamMembers } = useTeamStore()
const { inviteMembers } = useTeam()
const { onboardingTaskStatus, updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const userStore = useUserStore()
const tableRef = useTemplateRef('team')

type TableRow = UnwrapRowType<UserGetMemberInfoByWorkspaceListData> & { _oldNickname: string, _oldWorkspaceNickname: string }

const { columns } = useColumns({
  key: 'team.list',
  data: [
    {
      title: $t('成员信息'),
      key: 'member',
      slot: 'member',
      style: {
        width: '10%',
        minWidth: '240px',
      },
    },
    {
      title: $t('成员昵称'),
      key: 'workspaceNickname',
      slot: 'workspaceNickname',
      headerSlot: 'workspaceNicknameHeader',
      style: {
        minWidth: '120px',
      },
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
      title: $t('邀请人'),
      key: 'inviteMember',
      slot: 'inviteMember',
      style: {
        width: '10%',
        minWidth: '240px',
      },
    },
    {
      title: $t('操作'),
      slot: 'actions',
    },
  ],
}, (isOwner.value || isManager.value) ? undefined : ['relatedProjects'])

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
    onRefreshTable()
  },
  resetFilters() {
    filters.value = undefined
    filters.onChange()
  },
})

const members = ref()

useEmitterEvent('updateTeamMemberList', () => {
  filters.onChange()
})

onMounted(() => {
  if (compare(userStore.appVersion, '3.8.7', '>=')) {
    showWarnTipsModal()
  }
})

function showWarnTipsModal() {
  if (!isOwner.value || onboardingTaskStatus.value?.newSpaceCreateTeamStatus !== false)
    return

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <WarnTipsModal onClose={hideModal} />,
    },
    handleCancel: () => updateOnboardingTaskStatus({ newSpaceCreateTeamStatus: true }),
  })
}

async function tableRequest(params: any) {
  const data = await getTeamMembers(params)
  members.value = data.data.rows.filter((item: any) => item.role !== Role.OWNER)
  return data
}

function tableOperation(data: TableRow) {
  // 只能修改比自己权限低的成员
  const disabled = currentWorkspace.value!.role <= data.role
  const notJoined = data.status === Membership.notJoined

  return [
    {
      name: 'permission',
      label: $t('修改权限'),
      icon: 'base/rx_ic_permission',
      disabled: disabled || notJoined,
      disabledTooltip: notJoined ? '' : $t('权限不足'),
      power: check('Team_Member_Permission'),
      quick: true,
      tooltip: $t('修改权限'),
    },
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      disabled,
      disabledTooltip: $t('权限不足'),
      power: check('Team_Member_edit'),
      quick: true,
      tooltip: $t('编辑'),
    },
    {
      power: check('Team_Member_edit'),
      separator: true,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      disabled,
      disabledTooltip: $t('权限不足'),
      power: check('Team_Member_delete'),
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
    case 'permission':
      editPermission(data)
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
      const { code, msg } = await API.team.userDelTeamInfoCreate({
        email: data.email || data.phone || '',
        userId: data.userId!,
        role: data.role,
        projectIds,
      })
      onlyErrorToast(code, msg)
      if (code !== 0)
        return
      filters.onChange()
    },
  })
}

async function editPermission(row: TableRow) {
  console.log('row', row)
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <RolesDetail userId={row.userId} onClose={hideModal} title={$t('{name} ({role}) - 权限详情', { name: row.nickname || row.workspaceNickname || row.userName, role: roleLabelMap[row.role as Role] })} />
      ),
    },
  })
}

async function handleShowInviteUserFormDialog(role = Role.VIEWER) {
  inviteMembers({
    inviteRole: role,
    onBeforeClose: (refresh) => {
      if (refresh) {
        filters.onChange()
      }
    },
  })
}

async function saveWorkspaceNickname(data: TableRow, close: () => void) {
  const { email, phone, userId, workspaceNickname, _oldWorkspaceNickname } = data
  if (!workspaceNickname?.trim() && !_oldWorkspaceNickname?.trim()) {
    data.workspaceNickname = ''
    data._oldWorkspaceNickname = ''
    close()
    return
  }
  const { code, msg } = await API.team.userAddTeamWorkspaceNicknameCreate({
    workspaceNickname: workspaceNickname || '',
    emailOrPhone: email || phone || '',
    targetUserId: userId!,
  })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    data.workspaceNickname = _oldWorkspaceNickname
  }
  close()
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'name'), queryValue: value })
}

function onRefreshTable(params = {}) {
  tableRef.value?.refresh({ role: filters.value, ...params })
}
</script>

<template>
  <RyTable ref="team" v-model:columns="columns" scrollable :table-operation="tableOperation" :operation-handler="operationHandler" :table-request="tableRequest" :show-gridlines="false"
           :paginator="false" :show-actions-menu="false" :show-actions="false"
  >
    <template #display-before>
      <RxButton v-if="check('Team_Member_invite')" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click.stop="handleShowInviteUserFormDialog()" />
    </template>
    <template #filter-after>
      <div class="flex items-center w-full gap-3">
        <AdvancedSearch :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        <RxSelectButton v-model="filters.value" :options="filters.options" size="xxs" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
      </div>
    </template>
    <template #table-empty>
      <CustomNewEmpty icon="base/rc_ic_user_referral" img="empty-teams.png" :title="$t('暂无团队成员')" :desc="$t('邀请团队成员加入团队以管理，并高效地分配窗口或项目的权限。')">
        <template #extra>
          <div class="flex gap-3">
            <RxButton v-if="check('Team_Member_invite')" outlined severity="secondary" size="md" icon="base/rx_ic_user_add" :label="$t('邀请')"
                      @click.stop="handleShowInviteUserFormDialog(filters.value)"
            />
            <TutorialVideo video-type="team_management" :autoplay="false" />
          </div>
        </template>
      </CustomNewEmpty>
    </template>
    <template #member="{ data }">
      <MemberInfo :avatar="data.avatar" :user-name="data.workspaceNickname || data._userName" :nick-name="data.workspaceNickname" :avatar-color="data.avatarColor" :email="data.email" :phone="data.phone" />
    </template>
    <template #inviteMember="{ data }">
      <MemberInfo v-if="data.inviterInfo?.inviterId" :avatar="data.inviterInfo.avatar" :user-name="data.inviterInfo.inviterName" :avatar-color="data.inviterInfo.avatarColor" :email="data.inviterInfo.email" :phone="data.inviterInfo.phone" />
      <div v-else>
        --
      </div>
    </template>
    <template #workspaceNicknameHeader="{ column: { title } }">
      <div class="flex items-center gap-0.5 text-3 font-[Inter] font-600 leading-16px">
        <span>{{ title }}</span>
        <SvgIcon v-tooltip.top="{ value: $t('团队内展示名称，全员可见') }" class="inline-flex shrink-0 cursor-pointer" name="base/rx_ic_info" size="12" color="var(--colors-icon-icon-note)" />
      </div>
    </template>
    <template #workspaceNickname="{ data }">
      <div v-if="isViewer" class="w-40 rounded-1 text-ellipsis overflow-hidden nickname">
        {{ data.workspaceNickname }}
      </div>
      <Inplace v-else v-focustrap :disabled="!check('Team_Member_Edit_Team_Name')" :pt="{ display: '!border-none !pa-0' }">
        <template #display>
          <div class="w-40 rounded-1 text-ellipsis overflow-hidden nickname">
            {{ data.workspaceNickname }}
          </div>
        </template>
        <template #content="{ closeCallback }">
          <TsFormInputText v-model="data.workspaceNickname" class="!w-40" autofocus size="xxs" @focus="data._oldWorkspaceNickname = data.workspaceNickname"
                           @blur="saveWorkspaceNickname(data, closeCallback)" @keydown.enter="saveWorkspaceNickname(data, closeCallback)"
          />
        </template>
      </Inplace>
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

.nickname {
  min-height: 25px;
  font-size: 12px;
  line-height: 16px;
  padding: 4px;
  border: 1px solid transparent;

  &:hover {
    border: 1px solid var(--pattern-profiles-input-border);
    background: var(--pattern-profiles-input-bg);
  }
}
</style>
