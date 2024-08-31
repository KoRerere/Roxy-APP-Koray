<script setup lang="ts">
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'
import actions from '/@/components/actions.vue'

import notes from './components/notes.vue'
import { useDialog } from 'primevue/usedialog'

const dialog = useDialog()

const columns = ref([
  {
    title: 'Platform & Password',
    key: 'status',
    slot: 'account',
  },
  {
    title: 'Alias',
    key: 'link',
    getText: (row: any) => row.link || '--',
  },
  {
    title: 'Related Profiles',
    slot: 'related',

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
    label: '重启',
    icon: 'mdi mdi-delete-empty-outline',
    quick: true,
    multiple: true,
  },
])
const dataList = ref(Array.from({ length: 20 }, (_, index) => ({ id: index, status: '正常', link: 'https://www.baidu.com' })))

function operationHandler(operate: any, data: any) {
  console.log('🚀 ~ operationHandler ~ operate:', operate)
  switch (operate.name) {
    case 'edit':
      console.log('edit', data)
      break
    case 'note':
      console.log('note', data)
      break
    case 'delete':
      console.log('delete', data)
      break
  }
}

function testDialog() {
  dialog.open(notes, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      msg: 'man!',
    },
    onClose: (options: any) => {
      console.log('🚀 ~ testDialog ~ options:', options.data)
    },
    emits: {
      onSave: (xxx: any) => {
        console.log('🚀 ~ scvr ~ xxx:', xxx)
      },
    },
  })
}
</script>

<template>
  <Button label="show" @click="testDialog" />
  <div class="h-full">
    <ry-table selection-mode="multiple" :columns="columns" :data-list="dataList" :operation="operation"
      :operation-handler="operationHandler" :show-gridlines="false">
      <template #account="{ data }">
        <div class="account">
          <img class="account-img" :src="data.region">
          <div class="flex justify-between account-region">
            <span>111</span>
          </div>
          <div class="flex items-center account-email">
            <span>222</span>
            <img class="account-img" src="/@/assets/image/account/2fa.svg">
          </div>
        </div>
      </template>
      <template #related>
        <ryTag>123</ryTag>
      </template>
      <template #actions="{ data }">
        <actions :operation="operation" :show-menu="false" @icon-click="(operate) => operationHandler(operate, data)" />
      </template>
    </ry-table>
  </div>
  <DynamicDialog />
</template>

<style lang="scss" scoped>
.account {
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
