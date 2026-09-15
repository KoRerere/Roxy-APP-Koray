<script lang="ts" setup>
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxInputNumber } from '/@/components/rx-input-number'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { concurrentControl, setOperationLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { BuyEntryType, BuyProxyListType, ProxyReqType, ProxyType } from '/@/enums'
import RemarkCell from '/@/views/agent/shop/components/remark-cell.vue'
import { getRelatedProfileLabels, useColumns } from '/@/views/agent/shop/columns.tsx'
import { getAdvancedSearch, getCustomFilters, tableOperation, tableRequest } from '/@/views/agent/shop/operation.ts'
import type { ProxyCheckStatus } from '/@/enums'
import type { ProxyItem } from '/@/views/agent/shop/operation.ts'
import { API } from '/@/api'

interface Props {
  data?: any
  isBatch?: boolean
  createCount?: number
  onConfirm: (data: any) => void | Promise<void>
}

const { data: outerData, isBatch = false, onConfirm } = defineProps<Props>()

const totalMark = defineModel<number>('total')

const router = useRouter()
const { buyProxy } = useProxy()
const { testProxy, batchTestShowToast } = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()

const advancedSearchOptions = getAdvancedSearch()
const tableRef = useTemplateRef('agent')

const filters = reactive({
  list: [
    {
      name: 'proxyType',
      value: undefined,
      options: [
        {
          name: $t('全部'),
          value: undefined,
        },
        {
          name: $t('导入'),
          value: ProxyType.resource.toString(),
        },
        {
          name: $t('我购买的'),
          value: ProxyType.buy.toString(),
        },
      ],
    },
  ],
  getValues() {
    return Object.fromEntries(filters.list.filter(item => item.value).map(item => [item.name, item.value]))
  },
  onChange() {
    onRefreshTable()
  },
})

const filtersMenu = ref()
const dataList = ref()
// 有有效代理 id 时才回显；无代理时传空对象会让保存按钮误亮
const selection = ref(resolveInitialSelection(outerData, isBatch))
const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})
const checking = ref(false)

/**
 * 解析表格初始选中项：批量直接沿用；单选仅在存在有效代理 id 时回显
 */
function resolveInitialSelection(data: any, batch: boolean) {
  const raw = toRaw(data)
  if (batch) {
    return raw
  }
  if (raw?.id != null && raw.id !== 0) {
    return raw
  }
  return undefined
}

const { columns } = useColumns({
  inserts: isBatch ? [[5, { title: $t('关联窗口数量'), slot: 'bounded' }]] : [],
  filters: ['proxy', 'ipChecker', 'proxyProviderPrice', 'autoRenew'],
  storageKey: 'proxy_quick_display_v1',
})

const tableProps = {
  showDisplay: false,
  showGridlines: false,
  contextMenu: false,
  multipleOperation: false,
  ...(!isBatch
    ? {}
    : {
        onRowSelect({ data }: any) {
          Reflect.set(data, '_disabled', false)
        },
        onRowUnselect({ data }: any) {
          Reflect.set(data, '_disabled', true)
        },
        onRowSelectAll() {
          dataList.value.forEach((item: any) => {
            Reflect.set(item, '_disabled', false)
          })
        },
        onRowUnselectAll() {
          dataList.value.forEach((item: any) => {
            Reflect.set(item, '_disabled', true)
          })
        },
      }),
}

// const sumProxyCount = computed(() => {
//   if (!isBatch)
//     return 0

//   return [].concat(selection.value || []).reduce((sum: number, item: any) => sum += item._proxyCount, 0)
// })

const proxyAlertMessage = computed(() => {
  return $t('已选择 {count} 条代理 IP', { count: selection.value?.length })
  // const message = sumProxyCount.value > createCount ? $t('已超过创建窗口数，请取消选择代理 IP 或减少 {count} 个窗口关联数量。', { count: sumProxyCount.value - createCount }) : ''
  // return $t('已选择 {count} 条代理 IP，将会关联 {sumCount} 个窗口。{message}', { count: selection.value?.length, sumCount: sumProxyCount.value, message })
})

onBeforeMount(async () => {
  filtersMenu.value = await getCustomFilters()
})

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  tableRef.value?.refresh(params, force)
}

async function getTableList(params: any) {
  const result = await tableRequest({ ...filters.getValues(), ...params, type: BuyProxyListType.Use })

  if (result.code === 0) {
    const _rows = result.data.rows.map((item) => {
      if (!isBatch) {
        return item
      }
      const target = selection.value?.find((it: any) => item.id === it.id)
      return { ...item, _proxyCount: target?._proxyCount ?? 1, _disabled: !target }
    })
    dataList.value = _rows
    totalMark.value = result.data.total
    Reflect.set(result.data, 'rows', _rows)

    // 用当前页同源行替换选中对象，保证 dataKey 回显稳定
    if (!isBatch && selection.value?.id != null) {
      const matched = _rows.find((item: any) => item.id === selection.value.id)
      if (matched) {
        selection.value = matched
      }
    }
  }

  return result
}

function testOnlyOperations(row: ProxyItem) {
  return tableOperation(row).filter(item => item.name === 'test')
}

function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)
  switch (operate.name) {
    case 'test':
      onCheckProxyStatus(datas, { key: operate.name })
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'fuzzy'), queryValue: value }, true)
}

async function onCheckAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理 IP'))
    return
  }
  await onCheckProxyStatus(dataList.value, { key: 'test' })
}

async function onCheckProxyStatus(datas: ProxyItem[], options: { key: string, apiCheck?: boolean, enableReCheck?: boolean }) {
  const { key, apiCheck = true, enableReCheck = true } = options

  const tasks = datas.map((item) => {
    setOperationLoading(item, key, true)
    return async () => {
      const checkResult = await testProxy({
        ...toRaw(item),
        apiCheck: apiCheck && item.proxyType === ProxyType.buy,
      })
      setOperationLoading(item, key, false)
      Object.assign(item, { ...checkResult, _checkRes: toRaw(checkResult) })
      checkedMessage.value[item.id!] = checkResult.checkStatus
      return { ...checkResult, id: item.id, proxyType: item.proxyType }
    }
  })

  const results = await concurrentControl(tasks, 5)
  batchTestShowToast(results, {
    reCheck: enableReCheck ? () => onCheckProxyStatus(datas, options) : undefined,
  })

  const proxyList = results.filter((item: any) => item.proxyType === ProxyType.resource)
  if (proxyList.length) {
    API.proxy.userMdfProxyModuleCreate({ proxyList: results, requestType: ProxyReqType.SpeedTest })
  }

  return results
}

/**
 * 购买并关联：走 Immediate 入口，成功后通过 onConfirm 回传给外层（含 quick.vue 包装层）
 * 各调用方自行处理绑定/关抽屉，避免在多处入口重复购买逻辑
 */
async function onBuyProxy() {
  try {
    const orderInfo = await buyProxy({ entryType: BuyEntryType.Immediate })

    showToast(0, $t('代理 IP 已购买成功，正在为您配置中，请稍后。若长时间未加载代理 IP，请刷新页面或联系技术支持。'))

    // 非即时订单（如线下支付）落到代理列表页，由用户稍后手动选择
    if (!orderInfo?.immediate) {
      router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
      return
    }

    const { code, data } = await API.proxy.userGetUserBuyProxyListList({ orderNo: orderInfo?.orderNo, type: BuyProxyListType.Use } as any)
    if (code !== 0 || !data.rows?.[0]) {
      return
    }

    // 批量创建窗口时保留关联数量字段，与列表勾选确认的数据结构一致
    const rows = data.rows.map((item: any) => ({ ...toRaw(item), _proxyCount: 1 }))
    await onConfirm(isBatch ? rows : rows[0])
  }
  catch {
    // 用户关闭购买弹窗时 buyProxy reject，忽略即可
  }
}

async function saveSelected() {
  const selectProxy = [].concat(selection.value)
  // 用户打算使用代理，关闭 apiCheck 让所有购买的代理走本地检测
  checking.value = true
  await onCheckProxyStatus(selectProxy, { key: 'test', apiCheck: false, enableReCheck: false })
  checking.value = false
  const proxyData = selectProxy.map(({ loadingOperationMap: _, _disabled, ...item }: any) => toRaw(item))
  await onConfirm(isBatch ? proxyData : proxyData[0])
}
</script>

<template>
  <div class="flex flex-col h-full px-4 pt-4 pb-0 proxy-content">
    <div class="flex flex-wrap gap-1.5 items-center justify-between proxy-header">
      <div class="flex items-center gap-1.5 flex-wrap">
        <RxButton size="xxs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy()" />
        <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        <RxSelectButton v-for="item in filters.list" :key="item.name" v-model="item.value" :options="item.options" size="xxs" option-label="name" option-value="value" data-key="value"
                        @change="filters.onChange"
        />
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
        <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="onCheckAllProxy" />
      </div>
    </div>
    <RxAlert :visible="isBatch" class="w-full proxy-alert" type="info" :title="proxyAlertMessage" :closable="false" />
    <div class="flex-ovh-1">
      <!-- 关闭请求后清空选中，否则更换代理时已选代理无法在列表回显 -->
      <RyTable ref="agent" v-model:selection="selection" v-model:columns="columns" cache-key="proxy-quick-list" :table-request="getTableList" :selection-mode="isBatch ? 'multiple' : 'single'"
               :clear-selection-on-request="false" v-bind="tableProps" :virtual-scroller-options="{ itemSize: 60 }" :show-table-header="false"
      >
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_star.svg" :title="$t('暂无代理 IP')" />
        </template>
        <template #outbound="{ data: row }">
          <OutboundIp class="select-none" :country="row.lastCountry" :city="row.lastCity" :last-ip="row.lastIp" :time="row.checkTime" :status="checkedMessage[row.id]" :badge-desc="row.badgeTypeDesc"
                      :is-loading="row.loadingOperationMap?.test"
          />
        </template>
        <template #remark="{ data: row, column: { _cache } }">
          <RemarkCell :remark="row.remark" :extend="_cache.extend" />
        </template>
        <template #bounded="{ data: row }">
          <div class="bounded" @click.stop>
            <RxInputNumber v-model="row._proxyCount" :disabled="row._disabled" :min="1" :step="1" />
          </div>
        </template>
        <template #bindList="{ data: row }">
          <RelatedProfilesCell :list="getRelatedProfileLabels(row)" />
        </template>
        <template #actions="{ data: row }">
          <Actions :operation="testOnlyOperations(row)" :loading-operation-map="row.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, row)" />
        </template>
      </RyTable>
    </div>
    <div class="w-full flex justify-end gap-3 button-group">
      <RxButton :label="checking ? $t('检测中...') : $t('保存')" :disabled="!selection" @click.stop="saveSelected" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxy-content {
  min-width: var(--width-xl, 768px);
}

.proxy-header,
.proxy-alert {
  margin-bottom: var(--spacing-xl, 12px);
}

:deep(.rx-header) {
  padding-top: 0;
  padding-left: 0;
  padding-right: 0;
}

.proxy-host {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.ip-type {
  color: var(--colors-text-text-tertiary, #a3a9ad);
  font-family: Inter;
  font-size: 12px;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}

.bounded {
  width: 100px;

  :deep(.p-inputnumber) {
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--colors-border-border-base, #c7cdd1);

    .p-inputnumber-input {
      padding: 0;
      border: none;
      text-align: center;
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);

      &:not([disabled]) {
        color: var(--colors-text-text-primary, #111213);
      }
    }

    .p-inputnumber-button {
      padding: var(--spacing-md, 6px);
      width: auto;
      border: none;
      background: var(--colors-background-bg-action, #fff);

      &[disabled] {
        background: var(--inputtext-disabled-background);
      }
    }

    .p-disabled {
      opacity: 1;
    }
  }
}
</style>
