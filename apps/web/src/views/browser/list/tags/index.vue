<script setup lang="ts">
import type { UserAddLabelInfoCreatePayload } from '@roxy/backend-api'
import { group } from 'node:console'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'

import { API } from '/@/api'
import relatedProfiles from '/@/views/agent/list/components/related-profiles.vue'
import editPopup from '/@/views/browser/manage/tags/edit.vue'

const dialog = useDialog()
const toast = useToast()
const tableRef = useTemplateRef('tagTable')
const totalNum = ref(0)

const columns = ref([
  {
    title: 'Tag',
    key: 'name',
    slot: 'tag',
  },
  {
    title: 'Related Profiles',
    key: 'relatedProfiles',
    slot: 'related',
  },
])

const operation = ref([
  {
    label: 'Edit',
    name: 'edit',
    icon: 'base/rx_ic_edit',
    quick: true,
  },
  {
    label: 'Delete',
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
  dialog.open(editPopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: data,
      onConfirm: async (params: UserAddLabelInfoCreatePayload) => {
        const { code, msg } = data?.id
          ? await API.window.userMdfLabelInfoCreate({ ...params, id: data.id })
          : await API.window.userAddLabelInfoCreate(params)

        if (code === 0) {
          tableRef.value?.refresh()
        }

        toast.add({ severity: code === 0 ? 'success' : 'error', summary: code === 0 ? 'success' : 'error', detail: msg, life: 5000 })
      },
      onCancel: () => { },
    },
  })
}

async function deleteTag(data: any) {
  const ids = data.map((item: any) => item.id)
  await API.window.userDelLabelInfoCreate({ ids })
  tableRef.value?.refresh()
  toast.add({ severity: 'success', summary: '成功', detail: '标签修改成功', life: 5000 })
}
</script>

<template>
  <div class="flex-ovh-1 flex-col h-full">
    <div class="flex justify-between items-center px-4 py-3 gap-2">
      <div class="flex-1 total-tags">
        All Tags ({{ totalNum }})
      </div>
      <ryButton size="small" severity="secondary" icon="base/rx_ic_plus" label="Add tag" @click="editTag()" />
      <ryButton size="small" severity="secondary" icon="base/rx_ic_bin_1" label="Delete" disabled />
    </div>
    <div class="flex-ovh-1">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <ryTable ref="tagTable" :columns="columns" :operation="operation" :operation-handler="operationHandler"
        :table-request="tableRequest" :paginator="false" :show-table-header="false" selection-mode="multiple">
        <template #tag="{ data }">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path :fill="data.color"
                d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" />
            </svg>
            <span>{{ data.name }}</span>
          </div>
        </template>
        <template #related="{ data }">
          <relatedProfiles :list="data.bindWindowIds" />
        </template>
        <template #actions="{ data }">
          <actions :operation="operation" :loading-operation-map="data.loadingOperationMap" :show-menu="false"
            @quick-click="(operate: any) => operationHandler(operate, data)" />
        </template>
      </ryTable>
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
