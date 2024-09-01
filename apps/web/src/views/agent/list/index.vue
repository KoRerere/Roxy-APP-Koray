<script setup lang="ts">
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'
import ryButton from '/@/components/ry-button'
import actions from '/@/components/actions.vue'
import notes from '/@/views/account/list/components/notes.vue'
// import { useToast } from 'primevue/usetoast'
import { useDialog } from 'primevue/usedialog'
// import { useConfirm } from 'primevue/useconfirm'
// const toast = useToast()
const dialog = useDialog()
// const confirm = useConfirm()

const columns = ref([
  {
    title: 'Proxy Info',
    slot: 'proxy',
  },
  {
    title: 'Outbound IP',
    slot: 'outbound',
  },
  {
    title: 'IP Checker',
    slot: 'checker',
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

const dataList = ref(Array.from({ length: 20 }, (_, index) => ({ id: index, status: '正常', link: 'https://www.baidu.com' })))

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

function ipChecker(data: any) {
  console.log('🚀 ~ ipChecker ~ data:', data)
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
</script>

<template>
  <div class="flex flex-col h-full proxies">
    <div class="flex justify-end proxies-header">
      <div class="flex-1">
        Proxies
      </div>
      <ryButton size="small" severity="info" icon="mdi mdi-web" label="Create proxy" />
      <ryButton size="small" icon="mdi mdi-wifi" label="Test all" />
    </div>
    <div class="proxies-content">
      <ry-table selection-mode="multiple" :columns="columns" :data-list="dataList" :operation="operation"
        :operation-handler="operationHandler" :show-gridlines="false">
        <template #proxy="{ data }">
          <div>{{ data.a }}</div>
          <div>{{ data.b }}</div>
        </template>
        <template #outbound="{ data }">
          <div class="outbound">
            <img class="outbound-img" :src="data.region">
            <div class="flex justify-between outbound-region">
              <span>111</span>
            </div>
            <div class="flex items-center outbound-email">
              <span>222</span>
            </div>
          </div>
        </template>
        <template #checker="{ data }">
          <ryTag @click.stop="ipChecker(data)">
            <span class="mdi mdi-web" />
            <span>666</span>
          </ryTag>
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
  <DynamicDialog />
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
