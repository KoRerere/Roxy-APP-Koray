<script lang="ts" setup>
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { RxInputNumber } from '/@/components/rx-input-number'

import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { concurrentControl, setOperationLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy } from '/@/views/agent/hooks'
import type { ProxyCheckStatus } from '/@/enums'
import { ProxyType } from '/@/enums'
import { getRawColumns } from './columns'
import { getAdvancedSearch, getCustomFilters, tableOperation, tableRequest } from './operation'
import type { ProxyItem } from './operation'

interface Props {
  data?: any
  isBatch?: boolean
  createCount?: number
}

const { data: outerData, isBatch = false, createCount = 1 } = defineProps<Props>()

const emit = defineEmits(['confirm'])

const { testProxy, batchTestShowToast } = useCheckProxy()
const [_, onlyErrorToast] = useResponseToast()

const tableRef = useTemplateRef('agent')

const filtersMenu = ref()
const dataList = ref()
const selection = ref(toRaw(outerData))
const operation = ref(tableOperation().filter(item => item.name === 'test'))
const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})
const advancedSearchOptions = getAdvancedSearch()

const columns = getRawColumns({
  inserts: isBatch ? [[5, { title: $t('关联窗口数量'), slot: 'bounded' }]] : [],
  filters: ['ipChecker'],
})

const tableProps = {
  columns,
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

const sumProxyCount = computed(() => {
  if (!isBatch)
    return 0
  return (selection.value || []).reduce((sum: number, item: any) => sum += item._proxyCount, 0)
})

onBeforeMount(async () => {
  filtersMenu.value = await getCustomFilters()
})

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  tableRef.value!.refresh(params, force)
}

async function getTableList(params: any) {
  const { code, msg, data: { rows, ...rest } } = await tableRequest(params)

  const _rows = rows.map((item) => {
    if (!isBatch)
      return item
    const target = selection.value?.find((it: any) => item.id === it.id)
    return { ...item, _proxyCount: target?._proxyCount ?? 1, _disabled: !target }
  })

  dataList.value = _rows
  return { code, msg, data: { rows: _rows, ...rest } }
}

function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)
  switch (operate.name) {
    case 'test':
      onCheckProxyStatus(datas, operate.name)
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

async function onCheckAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理 IP'))
    return
  }
  await onCheckProxyStatus(dataList.value, 'test')
}

async function onCheckProxyStatus(datas: ProxyItem[], operateName: string) {
  const tasks = datas.map((item) => {
    setOperationLoading(item, operateName, true)
    return async () => {
      const checkResult = await testProxy(toRaw(item))
      setOperationLoading(item, operateName, false)
      Object.assign(item, checkResult)
      checkedMessage.value[item.id] = checkResult.checkStatus
      return { ...checkResult, id: item.id }
    }
  })

  const results = await concurrentControl(tasks, 5)
  batchTestShowToast(results)
  API.proxy.userMdfProxyModuleCreate(results)
}

function saveSelected() {
  const selectProxy = !isBatch
    ? selection.value
    : selection.value?.map(({ loadingOperationMap: _, _disabled, ...item }: any) => ({
        ...item,
        _type: ProxyType.resource,
      }))
  emit('confirm', selectProxy)
}

const message = $t('当前选择绑定的代理数量已超过创建窗口数。')
</script>

<template>
  <div class="flex flex-col h-full px-4 pt-4 pb-0 proxy-content">
    <div class="flex justify-between proxy-header">
      <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
      <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
      <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="onCheckAllProxy" />
    </div>
    <RxAlert :visible="isBatch" class="w-full proxy-alert" :type="sumProxyCount > createCount ? 'warn' : 'info'"
             :title="$t('{count} 个窗口将会绑定代理。您创建的窗口数为：{max}。{message}', { count: sumProxyCount, max: createCount, message: sumProxyCount > createCount ? message : '' })" :closable="false"
    />
    <div class="flex-ovh-1">
      <RyTable ref="agent" v-model:selection="selection" cache-key="proxy-quick-list" :table-request="getTableList" :selection-mode="isBatch ? 'multiple' : 'single'" v-bind="tableProps"
               :show-actions="false" :show-table-header="false"
      >
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_star.svg" :title="$t('暂无代理 IP')" />
        </template>
        <template #outbound="{ data: row }">
          <OutboundIp class="select-none" :country="row.lastCountry" :city="row.lastCity" :last-ip="row.lastIp" :time="row.checkTime" :status="checkedMessage[row.id]"
                      :is-loading="row.loadingOperationMap?.test"
          />
        </template>
        <template #remark="{ data: row }">
          <RxSvgIcon v-tooltip.top="{ value: row.remark, showDelay: 500 }" :name="row.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ 'color-[#12A3FC]': row.remark }" />
        </template>
        <template #bounded="{ data: row }">
          <div class="bounded" @click.stop>
            <RxInputNumber v-model="row._proxyCount" :disabled="row._disabled" :min="1" :step="1" />
          </div>
        </template>
        <template #actions="{ data: row }">
          <Actions :operation="operation" :loading-operation-map="row.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, row)" />
        </template>
      </RyTable>
    </div>
    <div class="w-full flex justify-end gap-3 button-group">
      <RxButton :label="$t('保存')" @click.stop="saveSelected" />
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
