<script setup lang="ts">
import type { ToastMessageOptions } from 'primevue/toast'
import { useConfirm } from 'primevue/useconfirm'
// import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import relatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'

// import { useSimpleDialog } from '/@/components/simplePopup'
import { Role } from '/@/enums'

const confirm = useConfirm()
// const dialog = useDialog()
const toast = useToast()
// const [dialogOpen] = useSimpleDialog()

const tableRef = useTemplateRef('extable')

const columns = ref([
  {
    title: 'Member info',
    key: 'member',
    slot: 'member',
  },
  {
    title: 'Status',
    key: 'useStatus',
  },
  {
    title: 'Membership',
    key: 'source',
    getText: (row: any) => row.uploader || row.source || '未知',
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
    tableRef.value?.refresh({ status: filters.value })
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
  return API.plugins.userGetPluginListList({ ...params, page_index: 1, page_size: 999 })// 不分页
}

function tableOperation() {
  return [
    {
      name: 'checkUpdate',
      label: 'check update',
      icon: 'base/rx_ic_clock_rotate',
    },
    {
      name: 'setting',
      label: 'Setting',
      icon: 'base/rx_ic_gear',
      multiple: true,
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: 'Delete',
      icon: 'base/rx_ic_bin_1',
      multiple: true,
    },
  ]
}

async function operationHandler(operate: any, data: any) {
  const datas = [].concat(toRaw(data))

  switch (operate.name) {
    case 'updateLocal':
      break
    case 'setting':
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
</script>

<template>
  <div class="header">
    Teams
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <ry-table ref="extable" scrollable selection-mode="multiple" :table-operation="tableOperation"
    :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns" :sorts="sorts"
    :show-config="false" :show-gridlines="false" :paginator="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <SelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value"
          data-key="value" @change="filters.onChange" />
      </div>
    </template>
    <template #member="{ data }">
      <div class="member">
        <img class="member-image" :src="data.pluginIcon">
        <div class="member-info">
          <div class="member-info-email w-full ellipsis-1">
            {{ data.pluginName }}
          </div>
          <div class="member-info-name">
            {{ data.pluginVersion }}
          </div>
        </div>
      </div>
    </template>
    <template #related="{ data }">
      <!-- {{ data.relatedProjects }} -->
      <relatedInfo />
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
