<script setup lang="ts">
import type { UnwrapRowType, UserGetMemberInfoByWorkspaceListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
// import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import relatedInfo from '/@/components/related-info.vue'

// import { RxSvgIcon } from '/@/components/rx-icon/'
import { useInviteUserFormDialog } from '/@/views/projects/hooks/useInviteUserFormDialog'
// import { useSimpleDialog } from '/@/components/simplePopup'
import { Membership, Role, roleLabelMap } from '/@/enums'

const [showInviteUserFormDialog] = useInviteUserFormDialog()
const confirm = useConfirm()
// const dialog = useDialog()
const toast = useToast()
// const [dialogOpen] = useSimpleDialog()

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
  return API.limit.userGetMemberInfoByWorkspaceList(params)
}

function tableOperation() {
  return [
    {
      name: 'edit',
      label: 'check update',
      icon: 'base/rx_ic_edit',
      quick: true,
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: 'Delete',
      icon: 'base/rx_ic_bin_1',
      quick: true,
      multiple: true,
    },
  ]
}

async function operationHandler(operate: any, data: any) {
  const datas = [].concat(toRaw(data))

  switch (operate.name) {
    case 'edit':
      handleShowInviteUserFormDialog(data)
      break
    case 'delete':
      deleteMember(datas)
      break
  }
}

async function deleteMember(datas: any) {
  confirm.require({
    header: '警告',
    message: '确认删除此插件？',
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
        const ids = datas.map((item: any) => item.id)
        const { msg } = await API.plugins.userBatchDelPluginInfoCreate({ ids })

        toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
        filters.resetFilters()
      }
      catch (error) {
        console.log('🚀 ~ accept: ~ error:', error)
      }
    },
  })
}

function handleShowInviteUserFormDialog(data?: TableRow) {
  const { email, project_info, role } = data || {}
  const projectIds = project_info?.map(item => item.project_id)
  showInviteUserFormDialog({ email, projectIds, role })
}
</script>

<template>
  <div class="header">
    Teams
    <ryButton severity="secondary" outlined size="small" icon="base/rx_ic_user_add" label="Invite"
      @click="handleShowInviteUserFormDialog" />
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <ry-table ref="team" scrollable selection-mode="multiple" :table-operation="tableOperation"
    :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns" :sorts="sorts"
    :show-gridlines="false" :paginator="false" :show-actions-menu="false">
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
