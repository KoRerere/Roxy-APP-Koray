<script setup lang="ts">
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'
import ryButton from '/@/components/ry-button'
import actions from '/@/components/actions.vue'
import notes from '/@/views/account/list/components/notes.vue'
// import { useToast } from 'primevue/usetoast'
import { useDialog } from 'primevue/usedialog'
// const confirm = useConfirm()

import { API } from '/@/api'
// import { useConfirm } from 'primevue/useconfirm'
// const toast = useToast()
const dialog = useDialog()

const columns = ref([
  {
    title: '配置文件信息',
    key: 'profile',
    slot: 'profile',
  },
  {
    title: '打开/预览',
    key: 'open',
    slot: 'open',
  },
  {
    title: '组/标签',
    key: 'group',
    slot: 'group',
  },
])

const operation = ref([
  {
    name: 'refresh',
    label: '刷新',
    icon: 'mdi mdi-refresh',
    quick: true,
    multiple: true,
  },
  {
    name: 'test',
    label: '测速',
    icon: 'mdi mdi-wifi',
    quick: true,
    multiple: true,
  },
  {
    name: 'note',
    label: '笔记',
    icon: 'mdi mdi mdi-cube-scan',
    quick: true,
    multiple: true,
  },
])

function operationHandler(operate: any, data: any) {
  switch (operate.name) {
    case 'refresh':
      console.log('🚀 ~ operationHandler ~ data:', data)
      break
    case 'note':
      addNote(data)
      break
    case 'test':
      console.log('🚀 ~ operationHandler ~ data:', data)
      break
  }
}

function addNote(data: any) {
  dialog.open(notes, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    emits: {
      onSave: ([value, close]: [string, () => void]) => {
        console.log('🚀 ~ addNote ~ data:', data)
        console.log('🚀 ~ scvr ~ xxx:', value)
        close()
      },
    },
  })
}

async function tableRequest() {
  return {}
}
</script>

<template>
  <div class="flex flex-col flex-1 proxies">
    <div class="proxies-header">
      回收站
    </div>
    <div class="proxies-content">
      <ry-table selection-mode="multiple" :columns="columns" :table-request="tableRequest" :operation="operation"
        :operation-handler="operationHandler" :show-gridlines="false">
        <template #profile="{ data }">
          <!-- <profile-info :data="data" @profile-operate="(key: string) => profileOperate(key, data)" /> -->
        </template>
        <template #group>
          <ryTag>123</ryTag>
        </template>
        <template #actions="{ data }">
          <!-- <actions :operation="operation" @more="(event: Event) => showOperationMenu(event, data)" /> -->
        </template>
        <template #multiple-operation="{ selection, clearSelection }">
          <!-- <multipleOperation :selection="selection" :operation="operation" :clear-selection="clearSelection"
            @more="([event, cmpOperation]) => showOperationMenu(event, selection, { cmpOperation, clearSelection })"
            @open-browser="() => openBrowser(selection)" @quick-click="(e) => operationHandler(e, selection)" /> -->
        </template>
      </ry-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies {
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
  }
}

.outbound {
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
