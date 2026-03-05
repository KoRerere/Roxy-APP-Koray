<script setup lang="ts">
import AccountEdit from '/@/views/account/create/quick.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'

import { API } from '/@/api'
import { useConfirm } from 'primevue/useconfirm'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoleStore } from '/@/stores/role'
import { useColumns } from './columns'
import { useDrawer } from '/@/hooks/useDrawer'
import { useUserStore } from '/@/stores/user'
import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetPlatformInfoV2ListData>

const router = useRouter()
const confirm = useConfirm()
const drawerInstance = useDrawer()
const role = useRoleStore()
const { userConfig } = storeToRefs(useUserStore())
const [_, onlyErrorToast] = useResponseToast()
const { columns, updateRemarkDisplayStatus } = useColumns()
const { showSimpleDialog } = useSimpleDialog()

const tableRef = useTemplateRef('account')
const operation = ref([
  {
    name: 'edit',
    label: $t('编辑'),
    icon: 'base/rx_ic_edit',
    power: !role.isViewer && !role.isEditor,
    tooltip: $t('编辑'),
    quick: true,
  },
  {
    name: 'remark',
    label: $t('添加备注'),
    icon: 'base/rx_ic_doc_add',
    power: !role.isViewer && !role.isEditor,
    multiple: true,
    multipleProps: {
      name: 'G1',
      showLabel: true,
    },
  },
  {
    separator: true,
    power: !role.isViewer && !role.isEditor,
  },
  {
    name: 'delete',
    label: $t('删除'),
    icon: 'base/rx_ic_bin_1',
    power: !role.isViewer && !role.isEditor,
    quick: true,
    tooltip: $t('删除'),
    multiple: true,
    multipleProps: {
      name: 'G2',
      showLabel: true,
    },
  },
])

const advancedSearchOptions = [
  {
    key: 'platform',
    label: $t('平台名称'),
    icon: 'base/rx_ic_keys',
    syntax: 'platform::',
  },
  {
    key: 'account',
    label: $t('账号名称'),
    icon: 'base/rx_ic_user_key',
    syntax: 'account::',
  },
  {
    key: 'remark',
    label: $t('备注'),
    icon: 'base/rx_ic_doc_article',
    syntax: 'note::',
  },
]

async function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'edit':
      editAccount(data)
      break
    case 'remark':
      await onRemark(data)
      break
    case 'delete':
      await deletePopup(data)
      break
    case 'create':
      createAccount()
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  tableRef.value?.refresh({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

function tableRequest(params: any) {
  return API.platform.userGetPlatformInfoV2List(params)
}

function createAccount() {
  router.push({ name: 'account-create' })
}

function editAccount(data?: Data) {
  drawerInstance.showDrawer({
    title: $t('编辑平台账号'),
    slots: {
      container: () => h(AccountEdit, {
        data,
        onClose: () => {
          drawerInstance.hideDrawer()
        },
        onConfirm: async (formData: any) => {
          const { code, msg } = await API.platform.userMdfPlatformInfoCreate([formData])
          onlyErrorToast(code, msg)
          if (code === 0) {
            tableRef.value?.refresh()
          }
        },
      }),
    },
  })
}

function onRemark(data: Data) {
  if (role.isViewer || role.isEditor)
    return

  const { promise, resolve } = Promise.withResolvers<void>()

  showSimpleDialog({
    title: $t('为所选账号添加备注'),
    inputs: [
      {
        type: 'textarea',
        name: 'platformRemarks',
        value: data?.platformRemarks,
        props: {
          placeholder: $t('请输入备注'),
          rows: 6,
        },
      },
    ],
    onConfirm: async (formData: any) => {
      const datas = ([] as Data[]).concat(data).map(item => ({ ...item, platformRemarks: formData.platformRemarks }))
      const { code, msg } = await API.platform.userMdfPlatformInfoCreate(datas)
      onlyErrorToast(code, msg)
      tableRef.value?.refresh()
    },
    onHide: resolve,
  })

  return promise
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

function deletePopup(data: any) {
  const { promise, resolve } = Promise.withResolvers<void>()
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
      onlyErrorToast(code, msg)
      if (code === 0) {
        tableRef.value?.refresh()
      }
      resolve()
    },
    reject: resolve,
    onHide: resolve,
  })
  return promise
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader :title="($route.meta.title as string)">
      <RxButton v-if="!role.isViewer && !role.isEditor" size="xxs" icon="base/rx_ic_add_keys" :label="$t('添加账号')" @click.stop="createAccount" />
    </ViewsHeader>
    <div class="flex flex-1 overflow-hidden">
      <RyTable ref="account" v-model:columns="columns" cache-key="account-list" selection-mode="multiple" :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler"
               :show-gridlines="false" :show-actions="false"
      >
        <template #filter-after>
          <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        </template>
        <template #table-empty>
          <CustomNewEmpty icon="base/rx_ic_keys" img="empty-accounts.png" :title="$t('暂无平台账号')" :desc="$t('在此添加平台账号以管理，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex gap-3">
                <RxButton v-if="!role.isViewer && !role.isEditor" outlined severity="secondary" size="md" icon="base/rx_ic_add_keys" :label="$t('添加账号')"
                          @click.stop="operationHandler({ name: 'create' })"
                />
                <TutorialVideo video-type="account_management" :autoplay="false" />
              </div>
            </template>
          </CustomNewEmpty>
        </template>
        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header">
            <span>{{ title }}</span>
            <RxSvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]"
                       :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="toggleRemarkDisplayStatus(_cache)"
            />
          </div>
        </template>
        <template #remark="{ data, column: { _cache } }">
          <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.platformRemarks, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.platformRemarks }" text severity="secondary" size="xxs"
                      :icon="data.platformRemarks ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            />
            <div v-if="_cache.extend" :title="data.platformRemarks" class="min-w-50 whitespace-pre-wrap note-content">
              {{
                data.platformRemarks }}
            </div>
          </div>
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2 items-center">
            <Actions :operation="operation" :show-menu="false" @quick-click="(operate: any) => operationHandler(operate, data)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.note {
  &-header {
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
  }

  &-content {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
    line-height: 1.4;
  }

  &-light {
    :deep(svg) {
      color: var(--colors-text-text-brand, #11a3fd) !important;
    }
  }
}
</style>
