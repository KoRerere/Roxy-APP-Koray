<script setup lang="ts">
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'
import ryButton from '/@/components/ry-button'
import actions from '/@/components/actions.vue'
import accountCreate from '/@/views/account/create'
import notes from '/@/views/account/list/components/notes.vue'
import { useToast } from 'primevue/usetoast'
import { useDialog } from 'primevue/usedialog'
import { useConfirm } from 'primevue/useconfirm'

// const toast = useToast()
const dialog = useDialog()
const confirm = useConfirm()

const columns = ref([
  {
    title: 'Platform & Password',
    key: 'status',
    slot: 'platform',
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
    label: '删除',
    icon: 'mdi mdi-delete-empty-outline',
    quick: true,
    multiple: true,
  },
])

const dataList = ref(Array.from({ length: 20 }, (_, index) => ({ id: index, status: '正常', link: 'https://www.baidu.com' })))

const drawer = reactive({
  visible: false,
  data: {},
  title: '创建账号',
  confirm: (data: any) => {
    console.log('🚀 ~ drawer.confirm ~ data:', data)
    drawer.visible = false
  },
})

function operationHandler(operate: any, data: any) {
  switch (operate.name) {
    case 'edit':
      drawer.data = data
      drawer.title = '编辑账号'
      drawer.visible = true
      break
    case 'note':
      addNote(data)
      break
    case 'delete':
      deletePopup(data)
      break
  }
}

function createAccount() {

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

function deletePopup(data: any) {
  confirm.require({
    header: '警告',
    message: '您确定要删除此账号吗?',
    rejectProps: {
      label: '取消',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '确定',
      severity: 'danger',
    },
    accept: () => {
      console.log('🚀 ~ deletePopup ~ data:', data)
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-full account">
    <div class="flex justify-between account-header">
      <div>Accounts</div>
      <ryButton size="small" severity="info" icon="mdi mdi-plus" label="Create account"
        @click="drawer.visible = true" />
    </div>
    <div class="account-content">
      <ry-table selection-mode="multiple" :columns="columns" :data-list="dataList" :operation="operation"
        :operation-handler="operationHandler" :show-gridlines="false">
        <template #platform="{ data }">
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
  <Drawer v-model:visible="drawer.visible" position="right" class="!w-[400px]">
    <template #container="{ closeCallback }">
      <accountCreate :data="drawer.data" :title="drawer.title" @close="() => closeCallback()"
        @confirm="drawer.confirm" />
    </template>
  </Drawer>
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
