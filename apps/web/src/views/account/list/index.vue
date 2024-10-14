<script setup lang="ts">
import type { UserMdfPlatformInfoCreatePayload } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import remarkIcon from '/@/components/remark-icon'
import { RxSvgIcon } from '/@/components/rx-icon/'
import ryButton from '/@/components/ry-button'
import ryTable from '/@/components/ry-table'
import popup from '/@/components/simplePopup'
import useColumns from '/@/hooks/useColumns'
import { useRoleStore } from '/@/stores/role'
import accountCreate from '/@/views/account/create'
import columnsRow from './columns'

const tableRef = useTemplateRef('accountTable')

const toast = useToast()
const confirm = useConfirm()

const [columns] = useColumns(columnsRow)
const role = useRoleStore()
const dialog = useDialog()

const operation = ref([
  {
    name: 'edit',
    label: '编辑',
    icon: 'base/rx_ic_edit',
    power: !role.isViewer,
    quick: true,
  },
  {
    name: 'remark',
    label: '备注',
    icon: 'base/rx_ic_doc_add',
    power: !role.isViewer,
  },
  {
    name: 'delete',
    label: '删除',
    icon: 'base/rx_ic_bin_1',
    power: !role.isViewer,
    quick: true,
    multiple: true,
  },
])

const drawer = reactive({
  visible: false,
  data: {},
  title: '创建账号',
  confirm: async (formData: UserMdfPlatformInfoCreatePayload) => {
    const _data = formData.id
      ? await editAccount(formData)
      : await createAccount(formData)
    tableRef.value?.refresh()
  },
})

function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':
      drawer.data = {}
      drawer.title = '创建账号'
      drawer.visible = true
      break
    case 'edit':
      drawer.data = data
      drawer.title = '编辑账号'
      drawer.visible = true
      break
    case 'remark':
      onRemark(data)
      break
    case 'delete':
      deletePopup(data)
      break
  }
}

function tableRequest(params: any) {
  return API.platform.userGetPlatformInfoV2List(params)
}

function createAccount(formData: UserMdfPlatformInfoCreatePayload) {
  return API.platform.userAddPlatformInfoCreate(formData)
}

function editAccount(formData: UserMdfPlatformInfoCreatePayload) {
  return API.platform.userMdfPlatformInfoCreate(formData)
}

function onRemark(data: any) {
  dialog.open(popup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: 'Add notes to profile',
        content: 'Please add notes down below.',
        inputs: [
          {
            type: 'textarea',
            name: 'platformRemarks',
            placeholder: 'Your notes here...',
            value: data.platformRemarks,
          },
        ],
      },
      onConfirm: async (formData: any) => {
        addRemark(formData.platformRemarks, data)
      },
    },
  })
}

async function addRemark(platformRemarks: string, data: any) {
  const { msg } = await editAccount({ ...data, platformRemarks })
  toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
  tableRef.value?.refresh()
}

function deletePopup(data: any) {
  const datas = [].concat(data)
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
    accept: async () => {
      const ids = datas.map((item: any) => item.id)
      const { msg } = await API.platform.userDelPlatformInfoCreate({ ids })
      toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-full account">
    <div class="flex justify-between account-header">
      <div>Accounts</div>
      <ryButton v-if="!role.isViewer" size="small" severity="info" icon="base/rx_ic_plus" label="Create account"
        @click="operationHandler({ name: 'create' })" />
    </div>
    <div class="account-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <ry-table ref="accountTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest"
        :operation="operation" :operation-handler="operationHandler" :show-gridlines="false">
        <template #platform="{ data }">
          <div class="platform">
            <img class="platform-img" :src="data.platformIcon">
            <div class="flex justify-between platform-region">
              <span>{{ data.platformUrl }}</span>
            </div>
            <div class="flex items-center platform-email">
              <span>{{ data.platformUserName }}</span>
              <RxSvgIcon v-if="data.platformEfa" class="text-blue platform-img" name="base/rx_ic_2fa" :size="16" />
            </div>
          </div>
        </template>
        <template #related="{ data }">
          <relatedInfo :list="data.window_info" />
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2">
            <remarkIcon :value="data.platformRemarks" :on-confirm="(params: any) => addRemark(params, data)" />
            <actions :operation="operation" :show-menu="false"
              @quick-click="(operate: any) => operationHandler(operate, data)" />
          </div>
        </template>
      </ry-table>
    </div>
  </div>
  <Drawer v-model:visible="drawer.visible" position="right" class="!w-[500px]">
    <template #container="{ closeCallback }">
      <accountCreate :data="drawer.data" :title="drawer.title" @close="closeCallback" @confirm="drawer.confirm" />
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
