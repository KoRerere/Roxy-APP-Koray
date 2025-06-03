<script setup lang="ts">
import PlatformIcon from './platform-icon.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import AccountCreate from '/@/views/account/create'
import { useColumns } from './columns'
import { useDrawer } from '/@/hooks/useDrawer'
import { useUserStore } from '/@/stores/user'
import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetPlatformInfoV2ListData>

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
    power: !role.isViewer,
    tooltip: $t('编辑'),
    quick: true,
  },
  {
    name: 'remark',
    label: $t('添加备注'),
    icon: 'base/rx_ic_doc_add',
    power: !role.isViewer,
    multiple: true,
    multipleProps: {
      name: 'G1',
    },
  },
  {
    separator: true,
  },
  {
    name: 'delete',
    label: $t('删除'),
    icon: 'base/rx_ic_bin_1',
    power: !role.isViewer,
    quick: true,
    tooltip: $t('删除'),
    multiple: true,
    multipleProps: {
      name: 'G1',
    },
  },
])

function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':
    case 'edit':
      createAccount(data)
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

function createAccount(data?: Data) {
  drawerInstance.showDrawer({
    title: data?.id ? $t('编辑平台账号') : $t('添加平台账号'),
    slots: {
      container: () => h(AccountCreate, {
        data,
        onClose: () => {
          drawerInstance.hideDrawer()
        },
        onConfirm: async (formData: any) => {
          const { code, msg } = data?.id
            ? await API.platform.userMdfPlatformInfoCreate([formData])
            : await API.platform.userAddPlatformInfoCreate(formData)
          onlyErrorToast(code, msg)
          if (code === 0) {
            tableRef.value?.refresh()
          }
        }
      })
    }
  })
}

function onRemark(data: Data) {
  showSimpleDialog({
    title: $t('为所选账号添加备注'),
    inputs: [
      {
        type: 'textarea',
        name: 'platformRemarks',
        value: data?.platformRemarks,
        props: {
          placeholder: $t('请输入备注'),
        }
      },
    ],
    onConfirm: async (formData: any) => {
      const datas = ([] as Data[]).concat(data).map(item => ({ ...item, platformRemarks: formData.platformRemarks }))
      const { code, msg } = await API.platform.userMdfPlatformInfoCreate(datas)
      onlyErrorToast(code, msg)
      tableRef.value?.refresh()
    },
  })
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
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
      onlyErrorToast(code, msg)
      if (code === 0) {
        tableRef.value?.refresh()
      }
    },
  })
}
</script>

<template>
  <div class="flex flex-col w-full h-full account">
    <ViewsHeader :title="($route.meta.title as string)">
      <RxButton v-if="!role.isViewer && !role.isEditor" size="xxs" icon="base/rx_ic_keys" :label="$t('添加账号')" @click.stop="operationHandler({ name: 'create' })" />
    </ViewsHeader>
    <div class="flex flex-1 overflow-hidden">
      <RyTable ref="account" cacheKey="account-list" v-model:columns="columns" selection-mode="multiple" :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler"
        :show-gridlines="false" :show-actions="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_lock.svg" :title="$t('暂无平台账号')" :desc="$t('在此添加平台账号以管理，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton v-if="!role.isViewer && !role.isEditor" outlined severity="secondary" size="xs" icon="base/rx_ic_keys" :label="$t('添加账号')"
                  @click.stop="operationHandler({ name: 'create' })" />
                <!-- <RxButton text severity="secondary" size="xs" :label="$t('账号文档')" /> -->
              </div>
            </template>
          </CustomEmpty>
        </template>
        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header">
            <span>{{ title }}</span>
            <RxSvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]"
              :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="toggleRemarkDisplayStatus(_cache)" />
          </div>
        </template>
        <template #remark="{ data, column: { _cache } }">
          <div class="flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.platformRemarks, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.platformRemarks }" text severity="secondary" size="xxs"
              :icon="data.platformRemarks ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :label="data.platformRemarks || !_cache.extend ? '' : $t('添加备注')"></RxButton>
            <div v-if="_cache.extend" :title="data.platformRemarks" class="min-w-50 whitespace-pre-wrap note-content">{{ data.platformRemarks }}</div>
          </div>
        </template>
        <template #platform="{ data }">
          <div class="flex gap-2 account">
            <div>
              <PlatformIcon v-if="data.platformIcon" :platform-icon-dark="data.platformIconDark" :platform-icon="data.platformIcon" class="w-4 h-4" />
              <RxSvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary, #7C8387)" />
            </div>
            <div class="flex flex-col flex-1 gap-1">
              <div class="flex items-center account-title">
                {{ data.platformUrl }}
              </div>
              <div class="flex items-center gap-1.5 account-subtitle">
                <span>{{ data.platformUserName }}</span>
                <RxSvgIcon v-if="data.platformEfa" class="text-blue" name="base/rx_ic_2fa" :size="16" />
              </div>
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
.account {
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);

  &-title {
    color: var(--colors-text-text-primary);
    font-weight: 500;
  }

  &-subtitle {
    color: var(--colors-text-text-tertiary);
  }
}

.note {
  &-header {
    color: var(--colors-text-text-primary, #FAFAFA);
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
      color: var(--colors-text-text-brand, #11A3FD) !important;
    }
  }
}
</style>
