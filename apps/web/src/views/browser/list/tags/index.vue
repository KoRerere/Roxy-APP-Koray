<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useTagsActions } from './hook'

const confirm = useConfirm()
const toast = useToast()
const tableRef = useTemplateRef('tagTable')
const totalNum = ref(0)

const [onEdit] = useTagsActions()

const columns = ref([
  {
    title: $t('标签'),
    key: 'name',
    slot: 'tag',
  },
  {
    title: $t('已关联窗口'),
    key: 'relatedProfiles',
    slot: 'related',
  },
  {
    title: $t('操作'),
    style: 'width: 7rem',
    slot: 'actions',
  },
])

const operation = ref([
  {
    label: $t('编辑'),
    name: 'edit',
    icon: 'base/rx_ic_edit',
    quick: true,
  },
  {
    label: $t('删除'),
    name: 'delete',
    icon: 'base/rx_ic_bin_1',
    quick: true,
    multiple: true,
  },
])

async function tableRequest() {
  const data = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  totalNum.value = data.data.total
  return data
}

function operationHandler(operate: any, data: any) {
  const datas = ([] as any).concat(data)
  switch (operate.name) {
    case 'edit':
      editTag(data)
      break
    case 'delete':
      deleteTag(datas)
      break
  }
}

function editTag(data?: any) {
  onEdit({
    ...(data || {}),
    confirmNext: () => {
      tableRef.value?.refresh()
    },
  })
}

async function deleteTag(data: any) {
  confirm.require({
    header: $t('删除标签'),
    message: '您确认要删除所选标签吗？删除后，关联窗口的标签将被清除。',
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
      const ids = data.map((item: any) => item.id)
      await API.window.userDelLabelInfoCreate({ ids })
      tableRef.value?.refresh()
      toast.add({ severity: 'success', summary: '成功', detail: '标签修改成功', life: 5000 })
    },
  })
}
</script>

<template>
  <div class="flex-ovh-1 flex-col h-full">
    <div class="flex justify-between items-center px-4 py-3 gap-2">
      <div class="flex-1 total-tags">
        {{ $t('新增标签') }} ({{ totalNum }})
      </div>
      <RxButton size="sm" severity="secondary" icon="base/rx_ic_plus" :label="$t('Add tag')" @click="editTag()" />
    </div>
    <div class="flex-ovh-1">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="tagTable" :columns="columns" :operation="operation" :operation-handler="operationHandler" :table-request="tableRequest" :paginator="false" :show-table-header="false"
        selection-mode="multiple" :show-actions="false">
        <template #tag="{ data }">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path :fill="data.color" d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" />
            </svg>
            <span>{{ data.name }}</span>
          </div>
        </template>
        <template #related="{ data }">
          <relatedInfo :list="data.bindWindowIds" />
        </template>
        <template #actions="{ data }">
          <Actions :operation="operation" :loading-operation-map="data.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, data)" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.total-tags {
  color: #000;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xl, 24px);
  /* 184.615% */
}
</style>
