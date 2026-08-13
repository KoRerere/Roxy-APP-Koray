<script lang="ts" setup>
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import AccountFieldCell from '/@/views/account/list/components/account-field-cell.vue'
import PlatformInfoCell from '/@/views/account/list/components/platform-info-cell.vue'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { getRawColumns, getRelatedProfileLabels } from './columns'
import { RxAlert } from '/@/components/rx-alert'
import { AccountBindType } from '/@/enums/account'

interface Props {
  data?: Record<string, any>
  isBatch?: boolean
  createCount?: number
  accountType?: AccountBindType
}

const { data, isBatch = false, createCount = 1, accountType = AccountBindType.Order } = defineProps<Props>()
const emit = defineEmits(['confirm', 'close'])

const columns = getRawColumns({
  filters: ['actions'],
})

const tableRef = useTemplateRef('quick')

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

/** 仅回显带有效 id 的已选账号，与代理 quick 的 resolveInitialSelection 对齐 */
const selection = ref(resolveInitialSelection(data?.windowPlatformList))
const sumProxyCount = computed(() => selection.value?.length ?? 0)

/**
 * 解析表格初始选中项
 */
function resolveInitialSelection(list?: any[]) {
  const selected = list?.filter((item: any) => item?.id != null && item.id !== 0) ?? []
  return selected.length ? selected : undefined
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  tableRef.value?.refresh({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

async function tableRequest(params: any) {
  const result = await API.platform.userGetPlatformInfoV2List(params)

  // 用当前页同源行替换选中对象，保证 dataKey 回显稳定（跨页未出现的项保留原对象）
  if (result.code === 0 && selection.value?.length) {
    const rows = result.data?.rows ?? []
    selection.value = selection.value.map((selected: any) => {
      return rows.find((row: any) => row.id === selected.id) ?? selected
    })
  }

  return result
}

function handleSave() {
  emit('confirm', selection.value ?? [])
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-3 h-full account-content">
    <RxAlert class="w-full" :visible="isBatch && accountType === AccountBindType.Order" :closable="false" :type="sumProxyCount > createCount ? 'warn' : 'info'"
             :title="$t('{count} 个窗口将会绑定账号。您创建的窗口数为：{max}。{message}', { count: sumProxyCount, max: createCount, message: sumProxyCount > createCount ? $t('当前选择绑定的账号数量已超过创建窗口数。') : '' })"
    />
    <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
    <div class="flex-ovh-1">
      <!-- clear-selection-on-request=false：保留 v-model:selection，避免列表请求把已选回显清掉 -->
      <RyTable ref="quick" v-model:selection="selection" :multiple-operation="false" selection-mode="multiple" :table-request="tableRequest" :columns="columns"
               :clear-selection-on-request="false" :virtual-scroller-options="{ itemSize: 60 }" :show-table-header="false"
               :show-display="false" :context-menu="false" :show-actions="false"
      >
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_lock.svg" :title="$t('暂无平台账号')" />
        </template>
        <template #platformInfo="{ data: row }">
          <PlatformInfoCell :data="row" />
        </template>
        <template #userName="{ data: row }">
          <AccountFieldCell :value="row.platformUserName" />
        </template>
        <template #password="{ data: row, column: { _cache } }">
          <AccountFieldCell :value="row.platformPassword" :masked="!_cache.visible[row.id]" />
        </template>
        <template #remark="{ data: row }">
          <RxSvgIcon v-tooltip.top="{ value: row.platformRemarks, showDelay: 500 }" :name="row.platformRemarks ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
                     :class="{ 'color-[#12A3FC]': row.platformRemarks }"
          />
        </template>
        <template #related="{ data: row }">
          <RelatedProfilesCell :list="getRelatedProfileLabels(row)" />
        </template>
      </RyTable>
    </div>
    <div class="w-full flex justify-end gap-3 button-group">
      <RxButton size="sm" :label="$t('保存')" @click.stop="handleSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-content {
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  min-width: var(--width-xl, 768px);
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
