<script setup lang="ts">
import type { UnwrapRowType, UserGetMemberInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import relatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { Membership, Role, roleLabelMap } from '/@/enums'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useInviteUserFormDialog } from '/@/views/projects/hooks/useInviteUserFormDialog'

const [showInviteUserFormDialog] = useInviteUserFormDialog()
const confirm = useConfirm()
const toast = useToast()
const workspaceStore = useWorkspaceStore()
const role = useRoleStore()

const tableRef = useTemplateRef('team')

type TableRow = UnwrapRowType<UserGetMemberInfoByWorkspaceListData>

const columns = ref([
  {
    title: 'Member info',
    key: 'member',
    slot: 'member',
  },
  {
    title: 'Status',
    key: 'status',
    getText: (row: TableRow) => row.status === Membership.joinIn ? 'Active' : 'Pending',
  },
  {
    title: 'Membership',
    key: 'source',
    getText: (row: TableRow) => roleLabelMap[row.role as Role],
  },
  {
    title: 'Related Projects',
    key: 'lateUpdateTime',
    slot: 'related',
  },
])

const filters = reactive({
  value: null,
  options: [
    {
      name: 'All',
      value: null,
    },
    {
      name: 'Manager',
      value: Role.MANAGER,
    },
    {
      name: 'Editor',
      value: Role.EDITOR,
    },
    {
      name: 'Viewer',
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
    label: '排序规则',
    placeholder: '请选择排序规则',
    name: 'orderName',
    value: 'createTime',
    options: [
      { label: '创建时间', value: 'createTime' },
      { label: '更新时间', value: 'lateUpdateTime' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
  {
    label: '排序类型',
    placeholder: '请选择排序类型',
    name: 'orderType',
    value: 'desc',
    options: [
      { label: '降序', value: 'desc' },
      { label: '升序', value: 'asc' },
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
      label: 'Edit',
      icon: 'base/rx_ic_edit',
      disabled,
      disabledTips: 'Insufficient permissions',
      power: !role.isViewer,
      quick: true,
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: 'Delete',
      icon: 'base/rx_ic_bin_1',
      disabled,
      disabledTips: 'Insufficient permissions',
      power: !role.isViewer,
      quick: true,
    },
  ]
}

async function operationHandler(operate: any, data: TableRow) {
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
    header: '警告',
    message: '确认移除此成员？',
    rejectProps: {
      label: '取消',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '确定',
      severity: 'danger',
    },
    accept: async () => {
      try {
        const projectIds = data.project_info.map(item => item.project_id)
        const { msg } = await API.team.userDelTeamInfoCreate({ userId: data.user_id, role: data.role, projectIds })
        toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
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
  showInviteUserFormDialog({ email, projectIds, role, user_id })
}
</script>

<template>
  <div class="header">
    <div class="flex-1">
      Teams
    </div>
    <div class="header-guide">
      <RxSvgIcon name="base/rx_ic_books" />
      <span>Access control guide</span>
    </div>
    <ryButton v-if="!role.isViewer" severity="secondary" outlined size="small" icon="base/rx_ic_user_add" label="Invite"
      @click="handleShowInviteUserFormDialog" />
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <ry-table ref="team" scrollable :table-operation="tableOperation" :operation-handler="operationHandler"
    :table-request="tableRequest" :columns="columns" :sorts="sorts" :show-gridlines="false" :paginator="false"
    :show-actions-menu="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <SelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value"
          data-key="value" @change="filters.onChange" />
      </div>
    </template>
    <template #member="{ data }">
      <div class="member">
        <img class="member-image" :src="data.avatar">
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
      <relatedInfo :list="data.project_info" :show-max="2" icon="base/rx_ic_stack" field="projectName" />
    </template>
  </ry-table>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
  gap: 10px;
  height: 48px;
  color: #000;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);
  border-bottom: none;

  &-guide {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-brand, #12a3fc);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
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
