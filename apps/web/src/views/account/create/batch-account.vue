<script setup lang="tsx">
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import ParseTextarea from '/@/views/agent/create/components/parse-textarea.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleDialog } from '/@/components/simplePopup'

import { resolveAccountLoginLabels } from '/@/views/account/create/account-login-labels'
import { toPlatformAbbrOptions } from '/@/views/browser/create/window-name'
import type { PlatformAbbrOption } from '/@/views/browser/create/window-name'
import { API } from '/@/api'
import { LIST_CACHE_NAMESPACE, useListCacheActions } from '/@/stores/listCache'
import { useThemeStore } from '/@/stores/theme'
import { useConfirm } from 'primevue/useconfirm'
import { parseIntelligent } from '/@/views/account/create/utils'

const router = useRouter()
const confirm = useConfirm()
const themeStore = useThemeStore()
const [showToast, onlyErrorToast] = useResponseToast()
const { showSimpleDialog } = useSimpleDialog()
const { invalidateCache: invalidateAccountListCache } = useListCacheActions()

const proxiesText = ref('')
const dataList = ref<any[]>([])
/** 顶部所选平台的缩写表，表头账号/密码文案按它变化 */
const platformAbbrCatalog = ref<PlatformAbbrOption[]>([])
const input = ref<Record<string, any>>({
  type: 'select',
  name: 'platformUrl',
  props: {
    placeholder: $t('请输入或选择平台网址'),
    optionValue: 'value',
    editable: true,
    size: 'xxs',
    getOptions: async () => {
      const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
      input.value._rows = rows
      platformAbbrCatalog.value = toPlatformAbbrOptions(rows)
      return formatPlatformOptions(rows)
    },
  },
  // resolver: (zod: any) => zod.string().url($t('请输入正确的平台网址'))
})

watch(() => themeStore.realTheme, () => {
  input.value.props.options = formatPlatformOptions(input.value._rows)
})

/** 批量添加共用顶部平台，表头跟着所选网址的缩写变 */
const columns = computed(() => {
  const labels = resolveAccountLoginLabels({
    platformUrl: String(input.value.value ?? ''),
  }, platformAbbrCatalog.value)
  return [
    {
      key: 'platformUrl',
      title: $t('平台'),
      getText: (data: any) => data.platformUrl || '--',
    },
    {
      key: 'platformUserName',
      title: labels.account,
      getText: (data: any) => data.platformUserName || '--',
    },
    {
      key: 'platformPassword',
      title: labels.password,
      getText: (data: any) => data.platformPassword || '--',
    },
    {
      key: 'platformEfa',
      title: '2FA',
      getText: (data: any) => data.platformEfa || '--',
    },
    {
      key: 'platformRemarks',
      title: $t('备注'),
      slot: 'remark',
    },
    {
      title: $t('操作'),
      slot: 'actions',
    },
  ]
})

function formatPlatformOptions(dataList: any[]) {
  return dataList.map(item => ({
    image: themeStore.realTheme === 'dark' ? item.platformIconDark : item.platformIcon,
    platformIconDark: item.platformIconDark,
    platformIcon: item.platformIcon,
    label: item.platformUrl,
    value: item.platformUrl,
  }))
}

function tableOperation() {
  return [
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      quick: true,
    },
  ]
}

function operationHandler(operate: any, data: any) {
  switch (operate.name) {
    case 'delete':
      dataList.value = dataList.value.filter(item => item.id !== data.id)
      break
    case 'remark':
      onRemark(data)
      break
  }
}

function parseValue() {
  if (!input.value.value) {
    onlyErrorToast(-1, $t('请输入或选择平台网址'))
    return
  }

  const list = proxiesText.value.split('\n').map(n => n.replace(/\s/g, '').replace(/：/g, ':')).filter(Boolean)

  if (!list.length) {
    onlyErrorToast(-1, $t('请先输入账号'))
    return
  }
  const { platformIcon = '', platformIconDark = '' } = input.value._rows.find((item: any) => item.platformUrl === input.value.value) || {}

  dataList.value = [...new Set(list)].map((str, index) => {
    const { platform, username, password, twoFactor, linkedEmail, remark } = parseIntelligent(str)
    return {
      id: index,
      platformUrl: platform || input.value.value,
      // platformName: input.value.value.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      platformIcon,
      platformIconDark,
      platformUserName: username ?? '',
      platformPassword: password ?? '',
      platformEfa: twoFactor ?? '',
      // platformEmail: linkedEmail ?? '',
      platformRemarks: remark ?? '',
    }
  })
  const filterCount = list.length - dataList.value.length
  if (filterCount > 0) {
    showToast(0, $t('{count} 重复账号已过滤。', { count: filterCount }))
  }
}

// function onPlatformName(data: any) {
//   showSimpleDialog({
//     title: $t('修改平台名'),
//     inputs: [
//       {
//         type: 'text',
//         name: 'platformName',
//         value: data.platformName,
//         props: {
//           placeholder: $t('请输入平台名'),
//         },
//       },
//     ],
//     onConfirm: (formData) => {
//       data.platformName = formData.platformName
//     },
//   })
// }

function onRemark(data: any) {
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
      data.platformRemarks = formData.platformRemarks
    },
  })
}

function clearAccount() {
  confirm.require({
    header: $t('清空账号'),
    message: $t('您确认清空所有账号吗?'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: () => {
      dataList.value = []
    },
  })
}

async function onSave(needMore: boolean) {
  const { code, msg } = await API.platform.userAddPlatformInfoBatchCreate(toRaw(dataList.value))
  onlyErrorToast(code, msg)
  if (code === 0) {
    invalidateAccountListCache(LIST_CACHE_NAMESPACE.ACCOUNT_LIST)
    if (!needMore) {
      router.replace({ name: 'account-list' })
    }
    else {
      showToast(0, msg)
      proxiesText.value = ''
      input.value.value = ''
      dataList.value = []
    }
  }
}
</script>

<template>
  <div class="flex-1 overflow-auto flex-col content">
    <div class="grid grid-cols-10 gap-3 w-full mb-[1px]">
      <div class="col-span-6 flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <div class="subtitle">
            {{ $t('账号信息') }}
          </div>
          <TsFormSelect v-model="input.value" class="!w-80" v-bind="input.props" />
        </div>
        <div class="information">
          <ParseTextarea v-model="proxiesText" :placeholder="$t('请在此处输入账号信息')" />
          <div class="flex justify-end information-actions">
            <RxButton outlined severity="secondary" size="xxs" :label="$t('解析')" icon="base/rx_ic_play" @click.stop="parseValue" />
          </div>
        </div>
      </div>
      <div class="col-span-4 flex flex-col gap-1 relative z-10">
        <div class="subtitle">
          {{ $t('导入规则') }}
        </div>
        <div class="relative overflow-hidden flex-1">
          <div class="rules relative z-10">
            <div class="rules-example">
              USERNAME1:PASSWORD1
            </div>
            <div class="rules-example">
              USERNAME2:PASSWORD2<span class="text-green">:2FA</span><span class="text-blue break-all">{{ `\{${$t('备注')}\}` }}</span>
            </div>
            <!-- <div class="rules-example">
              USERNAME3:PASSWORD3<span class="text-green">:2FA</span><span class="text-orange break-all">[{{ $t('关联邮箱') }}]</span>
            </div>
            <div class="rules-example">
              USERNAME4:PASSWORD4<span class="text-green">:2FA</span><span class="text-orange break-all">[{{ $t('关联邮箱') }}]</span><span class="text-blue break-all">{{ `\{${$t('备注')}\}` }}</span>
            </div> -->
            <br>
            <div class="rules-help">
              {{ $t('1.支持已有平台和其他平台；对于其他平台，需要手动输入URL。') }}
            </div>
            <div class="rules-help">
              {{ $t('2.每行一个账号，一次最多添加{count}个账号。', { count: 500 }) }}
            </div>
          </div>
          <ShadowDotGrid class="z-9" />
        </div>
      </div>
    </div>
    <div class="flex flex-col flex-1">
      <div class="flex items-center justify-between pt-6 pb-3 table-toolbar ">
        <div class="subtitle">
          {{ $t('已解析账号') }}
        </div>
        <div class="flex gap-2">
          <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_bin_1" :label="$t('清空账号')" :disabled="!dataList?.length" @click.stop="clearAccount" />
        </div>
      </div>
      <RyTable :columns="columns" :data-list="dataList" :table-operation="tableOperation" :paginator="false" :show-table-header="false" :show-actions="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_lock.svg" :title="$t('暂未添加账号')" class="min-h-262px" />
        </template>

        <!-- <template #name="{ data }">
          <div class="flex items-center gap-2">
            <span>{{ data.platformName }}</span>
            <SvgIcon class="cursor-pointer" name="base/rx_ic_edit" color="var(--colors-icon-icon-secondary)" @click="onPlatformName(data)" />
          </div>
        </template> -->
        <template #remark="{ data }">
          <div class="flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.platformRemarks, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.platformRemarks }" text severity="secondary" size="xxs"
                      :icon="data.platformRemarks ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            />
            <div :title="data.platformRemarks" class="min-w-50 whitespace-pre-wrap note-content">
              {{ data.platformRemarks }}
            </div>
          </div>
        </template>
        <template #actions="{ data }">
          <Actions :operation="tableOperation()" :show-menu="false" @quick-click="operationHandler($event, data)" />
        </template>
      </RyTable>
    </div>
    <div class="flex justify-end gap-3 footer">
      <RxButton :label="$t('保存 & 继续添加')" :disabled="!dataList?.length" severity="secondary" outlined @click.stop="onSave(true)" />
      <RxButton :label="$t('保存')" :disabled="!dataList?.length" @click.stop="onSave(false)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  padding: 20px 24px 0;

  .table-toolbar {
    position: sticky;
    top: -30px;
    z-index: 100;
    background-color: var(--colors-background-bg-page);
  }

  :deep(.table-wrapper) {
    overflow: initial;

    .p-datatable-table-container {
      overflow: initial !important;
    }

    .p-datatable-thead {
      position: sticky;
      top: calc(-30px + 58px);
      z-index: 100;
      background-color: white;
    }
  }
}

.information {
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  border: 1px solid var(--colors-border-border-action);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  overflow: hidden;

  &-actions {
    padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
    border-top: 0.5px solid var(--colors-border-border-overlay, #34393d);
    background: var(--colors-background-bg-overlay, #2c2e30);
  }
}

.rules {
  padding: var(--spacing-lg, 8px) var(--spacing-lg, 8px) var(--spacing-lg, 8px) 10px;
  gap: var(--spacing-md, 6px);
  height: 100%;
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &-example {
    color: var(--colors-text-text-primary);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }

  &-help {
    color: var(--colors-text-text-inactive, #7d8387);
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.note {
  &-header {
    color: var(--colors-text-text-primary);
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
      color: var(--colors-text-text-brand) !important;
    }
  }
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 26px;
}

.footer {
  position: sticky;
  bottom: 0;
  right: 0;
  background-color: var(--colors-background-bg-page);
  width: 100%;
  padding: 12px 0;
  z-index: 10;
}
</style>
