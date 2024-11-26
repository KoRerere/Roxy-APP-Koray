<script lang="ts" setup>
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { concurrentControl, setOperationLoading, strConcat } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy } from '/@/views/agent/hooks'
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import { getRawColumns } from './columns'
import { getCustomFilters, type ProxyItem, tableOperation, tableRequest } from './operation'

interface Boundeds {
  [id: number]: {
    value: number
    disabled: boolean
  }
}

const props = defineProps({
  data: {
    type: [Object, Array] as PropType<any>,
    default: undefined,
  },
  isBatch: {
    type: Boolean,
    default: false,
  },
  createCount: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['confirm'])

const [checkProxy] = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()

const tableRef = useTemplateRef('agent')

const columns = getRawColumns({
  inserts: props.isBatch ? [[5, { title: $t('关联窗口数量'), slot: 'bounded' }]] : [],
  filters: ['ipChecker'],
})

const operation = ref(tableOperation().filter(item => item.name === 'test'))
const selection = ref(props.data)
const filtersMenu = ref()
const dataList = ref()
const boundeds = ref<Boundeds>({})
const tableProps = {
  columns,
  showDisplay: false,
  showGridlines: false,
  contextMenu: false,
  multipleOperation: false,
  ...(!props.isBatch
    ? {}
    : {
      onRowSelect({ data }: any) {
        boundeds.value[data.id].disabled = false
      },
      onRowSelectAll({ data }: any) {
        data.forEach((item: any) => {
          boundeds.value[item.id].disabled = false
        })
      },
      onRowUnselect({ data }: any) {
        boundeds.value[data.id].disabled = true
      },
      onRowUnselectAll() {
        boundeds.value = Object.fromEntries(Object.entries(boundeds.value).map(([id, item]) => [id, { ...item, disabled: true }]))
      },
    }),
}
const sumProxyCount = computed(() => Object.values(boundeds.value).reduce((sum: number, item: any) => sum += (!item.disabled ? item.value : 0), 0))

onBeforeMount(async () => {
  filtersMenu.value = await getCustomFilters()
})

function onRefreshTable() {
  const params = filterFieldByValue(getFormData(filtersMenu.value))
  tableRef.value!.refresh(params)
}

async function getTableList(params: any) {
  const data = await tableRequest(params)
  dataList.value = data.data.rows
  if (props.isBatch) {
    boundeds.value = Object.fromEntries(
      data.data.rows.map((item) => {
        const _data = props.data.find((it: any) => item.id === it.id)
        return [item.id, {
          value: _data?._proxyCount ?? 1,
          disabled: !_data,
        }]
      },
      ),
    )
  }
  return data
}

function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)
  switch (operate.name) {
    case 'refresh':
      refreshUrl(datas)
      break
    case 'test':
      testProxy(datas, operate.name)
      break
  }
}

function refreshUrl(datas: ProxyItem[]) {
  datas.forEach(async (item) => {
    const isOK = await window.electronAPI.send('proxy:refreshUrl', item.refreshUrl!)
    showToast(isOK ? 0 : -1, item.refreshUrl as string)
  })
}

async function testProxy(datas: ProxyItem[], operateName: string) {
  const tasks = datas.map((item) => {
    setOperationLoading(item, operateName, true)
    return async () => {
      const checkResult = await checkProxy(toRaw(item))
      const _checkResult = toRaw(checkResult)
      setOperationLoading(item, operateName, false)
      Object.assign(item, _checkResult)
      return { ..._checkResult, id: item.id }
    }
  })

  const results = await concurrentControl(tasks, 5)
  API.proxy.userMdfProxyModuleCreate(results)
}

async function testAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理'))
    return
  }
  await testProxy(dataList.value, 'test')
}

function saveSelected() {
  const _selection = !props.isBatch
    ? selection.value
    : selection.value.map((item: any) => ({ ...item, _proxyCount: boundeds.value[item.id].value }))

  emit('confirm', _selection)
}
</script>

<template>
  <div class="flex flex-col h-full proxy-content">
    <div class="flex justify-between proxy-header">
      <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
      <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click="testAllProxy" />
    </div>
    <RxAlert v-if="isBatch" class="w-full proxy-alert" :type="sumProxyCount > createCount ? 'warn' : 'info'"
      :title="$t('{count} 个窗口将会绑定代理。最多只能绑定 {max} 个窗口。', { count: sumProxyCount, max: createCount })" :closable="false" />
    <div class="flex-ovh-1">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="agent" v-model:selection="selection" :table-request="getTableList" :selection-mode="isBatch ? 'multiple' : 'single'" v-bind="tableProps" :show-actions="false"
        :show-table-header="false">
        <template #table-empty>
          <CustomEmpty icon="empty/rx_illustration_star.svg" :title="$t('暂无代理')" />
        </template>
        <template #proxy="{ data: row }">
          <div class="flex flex-col gap-1">
            <div class="proxy-host">
              <span>{{ strConcat(row.protocol?.toLocaleLowerCase(), '://') }}</span>
              <span>{{ row.host }}</span>
              <span>{{ strConcat(':', row.port) }}</span>
            </div>
            <div class="flex items-center gap-1.5 ip-type">
              <span>{{ row.ipType }}</span>
              <Divider class="!ma-0" layout="vertical" />
              <span>{{ row.proxyUserName }}</span>
            </div>
          </div>
        </template>
        <template #remark="{ data: row }">
          <RxSvgIcon v-tooltip.top="{ value: row.remark, showDelay: 500 }" :name="row.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ 'color-[#12A3FC]': row.remark }" />
        </template>
        <template #bounded="{ data: row }">
          <div class="bounded">
            <InputNumber v-model="boundeds[row.id].value" :disabled="boundeds[row.id].disabled" :min="1" show-buttons button-layout="horizontal" :step="1" fluid>
              <template #incrementicon>
                <RxSvgIcon name="base/rx_ic_plus" />
              </template>
              <template #decrementicon>
                <RxSvgIcon name="base/rx_ic_minus" />
              </template>
            </InputNumber>
          </div>
        </template>
        <template #actions="{ data: row }">
          <Actions :operation="operation" :loading-operation-map="row.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, row)" />
        </template>
      </RyTable>
    </div>
    <div class="w-full flex justify-end gap-3 button-group">
      <RxButton :label="$t('保存')" @click="saveSelected" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxy-content {
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  width: var(--width-xl, 768px);
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
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.ip-type {
  color: var(--Colors-Text-text-inactive, #a3a9ad);
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
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

    .p-inputnumber-input {
      padding: 0;
      border: none;
      text-align: center;
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);

      &:not([disabled]) {
        color: var(--Component-Colors-TextInput-text-text, #171c1f);
      }
    }

    .p-inputnumber-button {
      padding: var(--spacing-md, 6px);
      width: auto;
      border: none;
      background: var(--Component-Colors-TextInput-bg-bg, #fff);

      &[disabled] {
        background: var(--p-inputtext-disabled-background);
      }
    }

    .p-disabled {
      opacity: 1;
    }
  }
}
</style>
