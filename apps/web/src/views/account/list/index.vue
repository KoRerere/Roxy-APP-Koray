<script setup lang="ts">
import type { UserMdfPlatformInfoCreatePayload } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import RemarkIcon from '/@/components/remark-icon'
import { RxSvgIcon } from '/@/components/rx-icon/'
import popup from '/@/components/simplePopup'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import accountCreate from '/@/views/account/create'
import columnsRow from './columns'

const tableRef = useTemplateRef('accountTable')

const confirm = useConfirm()
const [showToast] = useResponseToast()
const [columns] = useColumns(columnsRow)
const role = useRoleStore()
const dialog = useDialog()

const operation = ref([
  {
    name: 'edit',
    label: $t('编辑'),
    icon: 'base/rx_ic_edit',
    power: !role.isViewer,
    quick: true,
  },
  {
    name: 'remark',
    label: $t('添加备注'),
    icon: 'base/rx_ic_doc_add',
    power: !role.isViewer,
  },
  {
    name: 'delete',
    label: $t('删除'),
    icon: 'base/rx_ic_bin_1',
    power: !role.isViewer,
    quick: true,
    multiple: true,
  },
])

const drawer = reactive({
  visible: false,
  data: {},
  title: '',
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
      drawer.title = $t('添加平台账号')
      drawer.visible = true
      break
    case 'edit':
      drawer.data = data
      drawer.title = $t('编辑平台账号')
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
        title: $t('Add notes to profile'),
        content: $t('Please add notes down below.'),
        inputs: [
          {
            type: 'textarea',
            name: 'platformRemarks',
            placeholder: $t('Your notes here...'),
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
  const { code, msg } = await editAccount({ ...data, platformRemarks })
  showToast(code, msg)
  tableRef.value?.refresh()
}

function deletePopup(data: any) {
  const datas = [].concat(data)
  confirm.require({
    header: $t('删除平台账号'),
    message: $t('您确认要删除所选平台账号吗？删除后，将会与所有绑定的窗口解绑，但已有的登陆状态不会丢失'),
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
      const ids = datas.map((item: any) => item.id)
      const { code, msg } = await API.platform.userDelPlatformInfoCreate({ ids })
      showToast(code, msg)
      if (code === 0) {
        tableRef.value?.refresh()
      }
    },
  })
}
</script>

<template>
  <div class="flex flex-col w-full h-full account">
    <div class="flex justify-between account-header">
      <div>{{ $route.meta.title }}</div>
      <RxButton v-if="!role.isViewer" size="xxs" severity="info" icon="base/rx_ic_keys" :label="$t('添加账号')" @click="operationHandler({ name: 'create' })" />
    </div>
    <div class="flex flex-1 overflow-hidden">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="accountTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler" :show-gridlines="false"
        :show-actions="false">
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
          <div class="flex gap-2 items-center">
            <RemarkIcon :value="data.platformRemarks" :on-confirm="(params: any) => addRemark(params, data)" />
            <Actions :operation="operation" :show-menu="false" @quick-click="(operate: any) => operationHandler(operate, data)" />
          </div>
        </template>
      </RyTable>
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
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
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
