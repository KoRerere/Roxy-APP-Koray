<script setup lang="tsx">
import RelatedInfo from '/@/components/related-info.vue'
import { API } from '/@/api'

import { useConfirm } from 'primevue/useconfirm'
import { usePermission } from '/@/hooks/usePermission'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useTagsActions } from './hook'

const emit = defineEmits(['close'])

const confirm = useConfirm()
const { check } = usePermission()
const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()
const tableRef = useTemplateRef('tagTable')
const totalNum = ref(0)

const [onEdit] = useTagsActions()
const [_, onlyErrorToast] = useResponseToast()

const columns = ref([
  {
    title: $t('标签'),
    key: 'name',
    slot: 'tag',
  },
  {
    title: $t('已关联窗口'),
    key: 'relatedProfiles',
    render: ({ data }: any) => {
      const list = data.bindWindowIds.map((id: number) => `${workspaceName}-${id}`)
      return <RelatedInfo list={list}></RelatedInfo>
    },
  },
  {
    title: $t('操作'),
    style: 'width: 7rem',
    slot: 'actions',
  },
])

const operation = computed(() => [
  {
    label: $t('编辑'),
    name: 'edit',
    icon: 'base/rx_ic_edit',
    power: check('Profiles_Label_edit'),
    quick: true,
  },
  {
    label: $t('删除'),
    name: 'delete',
    icon: 'base/rx_ic_bin_1',
    power: check('Profiles_Label_delete'),
    quick: true,
    multiple: true,
    multipleProps: {
      name: 'G1',
    },
  },
])

async function tableRequest() {
  const data = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  if (data.code !== 0) {
    onlyErrorToast(data.code, data.msg)
    emit('close')
    return
  }
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
    message: $t('您确认要删除所选标签吗？删除后，关联窗口的标签将被清除。'),
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
      const { code, msg } = await API.window.userDelLabelInfoCreate({ ids })
      onlyErrorToast(code, msg)
      if (code === 0) {
        tableRef.value?.refresh()
      }
    },
  })
}
</script>

<template>
  <div class="w-180 h-50vh flex flex-col pa-6 pt-4">
    <div class="h-9 flex justify-between items-center">
      <div class="header">
        {{ $t('标签管理') }}
      </div>
      <RxButton class="!rounded-full" text size="md" severity="secondary" icon="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="flex justify-between items-center py-3 gap-2">
      <div class="flex-1 total-tags">
        {{ $t('新增标签') }} ({{ totalNum }})
      </div>
      <RxButton v-if="check('Profiles_Label_add')" size="xxs" outlined severity="secondary" icon="base/rx_ic_plus" :label="$t('新增标签')" @click.stop="editTag()" />
    </div>
    <div class="flex-ovh-1">
      <RyTable ref="tagTable" :columns="columns" :operation="operation" :operation-handler="operationHandler" :table-request="tableRequest" :paginator="false" :show-table-header="false"
               selection-mode="multiple" :show-actions="false"
      >
        <template #table-empty>
          <CustomEmpty :title="$t('暂无标签')" />
        </template>
        <template #tag="{ data }">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path :fill="data.color" d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" />
            </svg>
            <span>{{ data.name }}</span>
          </div>
        </template>
        <template #actions="{ data }">
          <Actions :operation="operation" :loading-operation-map="data.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, data)" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.total-tags {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xl, 24px);
  /* 184.615% */
}
</style>
