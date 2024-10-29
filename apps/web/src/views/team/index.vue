<script setup lang="ts">
import type { UnwrapRowType, UserGetMemberInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import relatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { getRoleLabelMap, Membership, Role } from '/@/enums'
import useColumns from '/@/hooks/useColumns'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useInviteUserFormDialog } from '/@/views/projects/hooks/useInviteUserFormDialog'

const roleLabelMap = getRoleLabelMap()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const confirm = useConfirm()
const toast = useToast()
const workspaceStore = useWorkspaceStore()
const role = useRoleStore()

const tableRef = useTemplateRef('team')

type TableRow = UnwrapRowType<UserGetMemberInfoByWorkspaceListData>

const [columns] = useColumns({
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
      getText: (row: TableRow) => row.status === Membership.joinIn ? '已加入' : '等待确认',
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
  value: null,
  options: [
    {
      name: $t('全部'),
      value: null,
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
    filters.value = null
    filters.onChange()
  },
})

const sorts = ref([
  {
    label: $t('排序标准'),
    name: 'orderName',
    value: 'createTime',
    options: [
      { label: $t('邀请时间'), value: 'createTime' },
      { label: $t('修改时间'), value: 'lateUpdateTime' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
  {
    label: $t('排序方式'),
    name: 'orderType',
    value: 'desc',
    options: [
      { label: $t('倒序'), value: 'desc' },
      { label: $t('正序'), value: 'asc' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
])

async function tableRequest(params: any) {
  return API.team.userGetMemberInfoByWorkspaceList(params)
}

console.log(toRaw(workspaceStore.currentWorkspace))

function tableOperation(data: TableRow) {
  // 只能修改比自己权限低的成员
  const disabled = (workspaceStore.currentWorkspace?.role ?? -1) <= data.role
  return [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      disabled,
      disabledTips: $t('Insufficient permissions'),
      power: !role.isViewer,
      quick: true,
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      disabled,
      disabledTips: $t('Insufficient permissions'),
      power: !role.isViewer,
      quick: true,
    },
  ]
}

function operationHandler(operate: any, data: TableRow) {
  switch (operate.name) {
    case 'edit':
      handleShowInviteUserFormDialog(data)
      break
    case 'delete':
      deleteMember(data)
      break
  }
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
      try {
        const projectIds = data.project_info.map(item => item.project_id)
        const { msg } = await API.team.userDelTeamInfoCreate({ userId: data.user_id, role: data.role, projectIds })
        toast.add({ severity: 'success', summary: $t('Success'), detail: msg, life: 2500 })
        filters.onChange()
      }
      catch (error) {
        console.log('🚀 ~ accept: ~ error:', error)
      }
    },
  })
}

function handleShowInviteUserFormDialog(data?: TableRow) {
  const { email, project_info, role, user_id } = data || {}
  const projectIds = project_info?.map(item => item.project_id)
  const disableds = email ? ['email'] : []
  showInviteUserFormDialog({ tableRef, email, projectIds, role, user_id, disableds })
}
</script>

<template>
  <div class="header">
    <ViewsHeader :title="($route.meta.title as string)">
      <div class="flex items-center header-guide">
        <RxSvgIcon name="base/rx_ic_books" />
        <span>{{ $t('团队指南') }}</span>
      </div>
      <RxButton v-if="!role.isViewer" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click="handleShowInviteUserFormDialog" />
    </ViewsHeader>
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="team" v-model:columns="columns" scrollable :table-operation="tableOperation" :operation-handler="operationHandler" :table-request="tableRequest" :sorts="sorts" :show-gridlines="false"
    :paginator="false" :show-actions-menu="false" :show-actions="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <RxSelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
      </div>
    </template>
    <template #table-empty>
      <CustomEmpty icon="empty/rx_illustration_user.svg" :title="$t('暂无团队成员')" :desc="$t('邀请团队成员加入空间以管理，并高效地分配窗口或项目的权限。')">
        <template #extra>
          <div class="flex items-center gap-3">
            <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click="handleShowInviteUserFormDialog" />
            <RxButton text severity="secondary" size="xs" :label="$t('邀请文档')" />
          </div>
        </template>
      </CustomEmpty>
    </template>
    <template #member="{ data }">
      <div class="member">
        <template v-if="data.avatar">
          <img class="member-image rounded-full" :src="data.avatar">
        </template>
        <template v-else>
          <Avatar :label="data.email.slice(0, 2)" shape="circle" />
        </template>
        <div class="member-info">
          <div class="member-info-email w-full ellipsis-1">
            {{ data.email }}
          </div>
          <div class="member-info-name">
            {{ data.userName }}
          </div>
        </div>
      </div>
    </template>
    <template #related="{ data }">
      <relatedInfo :list="data.project_info" :show-max="1" icon="base/rx_ic_stack" field="projectName" />
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
    color: var(--Colors-Text-text-brand, #12a3fc);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.member {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);

  &-image {
    width: 32px;
    aspect-ratio: 1;
  }

  &-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: var(--spacing-sm, 4px);
    font-style: normal;
    line-height: var(--Line-Height-text-xs, 16px);
    font-weight: 500;
    width: 240px;

    &-email {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 13px;
    }

    &-name {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: 'JetBrains Mono';
      font-size: 12px;
    }
  }
}
</style>
