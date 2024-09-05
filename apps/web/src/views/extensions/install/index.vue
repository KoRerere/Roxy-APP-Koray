<script setup lang="ts">
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'

import actions from '/@/components/actions.vue'
import upload from './components/upload.vue'


import notes from '/@/views/account/list/components/notes.vue'
import { useToast } from 'primevue/usetoast'
import { useDialog } from 'primevue/usedialog'
import { useConfirm } from 'primevue/useconfirm'

// const toast = useToast()
const dialog = useDialog()
const confirm = useConfirm()

const columns = ref([
  {
    title: 'Extension',
    key: 'extension',
    slot: 'extension',
  },
  {
    title: 'Toggle',
    key: 'toggle',
    slot: 'toggle',
  },

  {
    title: 'Source',
    key: 'source',
    slot: 'source',
  },

  {
    title: 'Last Update',
    key: 'lastupdate',
    slot: 'lastupdate',
  },

  {
    title: 'Update Info',
    key: 'updateinfo',
    getText: (row: any) => row.link || '--',
  },
  {
    title: 'Actions',
    slot: 'actions',
  },
])

const operation = ref([
  {
    name: 'edit',
    label: '编辑',
    icon: 'mdi mdi-pencil-outline',
    quick: true,
  },
  {
    name: 'note',
    label: '笔记',
    icon: 'mdi mdi mdi-cube-scan',
    quick: true,
    multiple: true,
  },
  {
    name: 'delete',
    label: '删除',
    icon: 'mdi mdi-delete-empty-outline',
    quick: true,
    multiple: true,
  },
])

const dataList = ref(Array.from({ length: 20 }, (_, index) => ({ id: index, status: '正常', link: 'https://www.baidu.com' })))



</script>

<template>
  <div class="flex flex-col h-full account">
    <div class="account-content">
      <ry-table selection-mode="multiple" :columns="columns" :data-list="dataList" :show-gridlines="false">

        <template #header-extra>
          <div>
            <upload />
          </div>
        </template>

        <template #extension="{ data }">
          <div class="platform">
            <img class="platform-img" :src="data.region">
            <div class="flex justify-between platform-region">
              <span>111</span>
            </div>
            <div class="flex items-center platform-email">
              <span>222</span>
              <img class="platform-img" src="/@/assets/image/account/2fa.svg">
            </div>
          </div>
        </template>
        <template #related>
          <ryTag>123</ryTag>
        </template>
        <template #actions="{ data }">
          <actions :operation="operation" :show-menu="false"
            @icon-click="(operate) => operationHandler(operate, data)" />
        </template>
      </ry-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account {
  &-header {
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    gap: 10px;
    height: 48px;
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-content {
    height: calc(100% - 48px);
    overflow-y: auto;
  }
}

.platform {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
