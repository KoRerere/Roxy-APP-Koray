<script setup lang="ts">
import type { UnwrapRowType, UserGetMemberInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import relatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { getRoleLabelMap, Membership, Role } from '/@/enums'
import { setColumns } from '/@/hooks/useColumns'
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

const columns = ref(setColumns([
  {
    title: $t('Member info'),
    key: 'member',
    slot: 'member',
  },
  {
    title: $t('Status'),
    key: 'status',
    getText: (row: TableRow) => row.status === Membership.joinIn ? 'Active' : 'Pending',
  },
  {
    title: $t('Membership'),
    key: 'source',
    getText: (row: TableRow) => roleLabelMap[row.role as Role],
  },
  {
    title: $t('Related Projects'),
    key: 'relatedProjects',
    slot: 'related',
  },
], {
  filters: (role.isOwner || role.isManager) ? [] : ['relatedProjects'],
}))

const filters = reactive({
  value: null,
  options: [
    {
      name: $t('All'),
      value: null,
    },
    {
      name: $t('Manager'),
      value: Role.MANAGER,
    },
    {
      name: $t('Editor'),
      value: Role.EDITOR,
    },
    {
      name: $t('Viewer'),
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
    label: $t('Sorting rules'),
    placeholder: $t('Please select a sorting rule'),
    name: 'orderName',
    value: 'createTime',
    options: [
      { label: $t('Create time'), value: 'createTime' },
      { label: $t('Update time'), value: 'lateUpdateTime' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
  {
    label: $t('Sort type'),
    placeholder: $t('Please select sort type'),
    name: 'orderType',
    value: 'desc',
    options: [
      { label: $t('descending order'), value: 'desc' },
      { label: $t('ascending order'), value: 'asc' },
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
      label: $t('Edit'),
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
      label: $t('Delete'),
      icon: 'base/rx_ic_bin_1',
      disabled,
      disabledTips: $t('Insufficient permissions'),
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
    header: $t('Warning'),
    message: $t('Confirm to remove this member?'),
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
      try {
        const projectIds = data.project_info.map(item => item.project_id)
        const { msg } = await API.team.userDelTeamInfoCreate({ userId: data.user_id, role: data.role, projectIds })
        toast.add({ severity: 'success', summary: $t('Success'), detail: msg, life: 5000 })
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
    <div class="flex-1">
      {{ $t('Teams') }}
    </div>
    <div class="header-guide">
      <RxSvgIcon name="base/rx_ic_books" />
      <span>{{ $t('Access control guide') }}</span>
    </div>
    <ryButton v-if="!role.isViewer" severity="secondary" outlined size="small" icon="base/rx_ic_user_add" label="Invite"
              @click="handleShowInviteUserFormDialog"
    />
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <ry-table ref="team" scrollable :table-operation="tableOperation" :operation-handler="operationHandler"
            :table-request="tableRequest" :columns="columns" :sorts="sorts" :show-gridlines="false" :paginator="false"
            :show-actions-menu="false"
  >
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <SelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value"
                      data-key="value" @change="filters.onChange"
        />
      </div>
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
