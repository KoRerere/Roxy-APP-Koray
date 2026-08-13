<script lang="ts" setup>
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import DeviceOutboundCell from './components/device-outbound-cell.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useDrawer } from '/@/hooks/useDrawer'
import { usePermission } from '/@/hooks/usePermission'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { concurrentControl, setOperationLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { useProxyFormDrawer } from '/@/views/agent/hooks/useProxyFormDrawer'
import { useProxyModuleCreate } from '/@/views/agent/hooks/useProxyModuleCreate'
import { createProxyCreateLabels } from '/@/views/agent/create/proxy-create-mode'
import { BuyEntryType, BuyProxyListType, ProxyReqType, ProxyType } from '/@/enums'
import { getDeviceSelectColumns } from './device-columns'
import {
  deviceTableRequest,
  // filterTestableDevices,
  getDeviceAdvancedSearch,
  getDeviceCustomFilters,
  getDeviceSelectOperation,
} from './device-operation'
import type { ProxyCheckStatus } from '/@/enums'
import type { DeviceItem } from './device-operation'
import { API } from '/@/api'

interface Props {
  data?: any
  warningMessage?: string
  onConfirm: (data: any) => void | Promise<void>
}

const { data: outerData, warningMessage, onConfirm } = defineProps<Props>()

const totalMark = defineModel<number>('total')

const router = useRouter()
const drawerInstance = useDrawer()
const { showProxyFormDrawer } = useProxyFormDrawer(drawerInstance)
const { check } = usePermission()
const { buyProxy } = useProxy()
const { testProxy, batchTestShowToast } = useCheckProxy()
const { saveProxyModules, updateProxyModules } = useProxyModuleCreate()
const [showToast, onlyErrorToast] = useResponseToast()
const deviceCreateLabels = createProxyCreateLabels('device')

const advancedSearchOptions = getDeviceAdvancedSearch()
const tableRef = useTemplateRef('deviceTable')

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
const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})

/** 打开抽屉时的预选 id（编辑回显 / 列表换绑），只取一次避免后续被清空 */
const presetSelectedId = Number(outerData?.id) > 0 ? Number(outerData.id) : undefined

/** 初始选中：先用外部 data 占位，列表返回后替换为同行引用以便 radio 正确勾选 */
const selection = ref<DeviceItem | Record<string, unknown> | undefined>(
  presetSelectedId
    ? { ...toRaw(outerData), id: presetSelectedId }
    : undefined,
)

/** 列表行就绪后，用当前页真实行对象对齐 selection（PrimeVue dataKey 比对更稳） */
function syncSelectionWithRows(rows: DeviceItem[]) {
  const selectedId = selection.value?.id != null ? Number(selection.value.id) : presetSelectedId
  if (!selectedId || !rows?.length) {
    return
  }

  const matched = rows.find(row => Number(row.id) === selectedId)
  if (matched) {
    selection.value = matched
  }
}

const columns = getDeviceSelectColumns()

const tableProps = {
  columns,
  showDisplay: false,
  showGridlines: false,
  contextMenu: false,
  multipleOperation: false,
}

onBeforeMount(async () => {
  filtersMenu.value = await getDeviceCustomFilters()
})

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  tableRef.value?.refresh(params, force)
}

async function getTableList(params: any) {
  const result = await deviceTableRequest({ ...filters.getValues(), ...params, type: BuyProxyListType.Use })

  if (result.code === 0) {
    dataList.value = result.data.rows
    totalMark.value = result.data.total
    syncSelectionWithRows(result.data.rows as DeviceItem[])
  }

  return result
}

function testOnlyOperations(row: DeviceItem) {
  return getDeviceSelectOperation(row)
}

function operationHandler(operate: any, data: DeviceItem) {
  const datas = ([] as DeviceItem[]).concat(data)
  switch (operate.name) {
    case 'test':
      onCheckProxyStatus(datas, { key: operate.name })
      break
  }
}

function onBuyProxy() {
  buyProxy({ entryType: BuyEntryType.Immediate, mode: 'device' }).then(async (orderInfo) => {
    showToast(0, $t('设备已购买成功，正在为您配置中，请稍后。若长时间未加载设备，请刷新页面或联系技术支持。'))

    if (!orderInfo?.immediate) {
      router.push({ name: 'ecommerce-device-list', query: { orderNo: orderInfo?.orderNo } })
      return
    }

    const { code, data } = await API.proxy.userGetUserBuyProxyListList({ orderNo: orderInfo?.orderNo, type: BuyProxyListType.Use } as any)
    if (code !== 0 || !data.rows?.[0]) {
      return
    }
    onConfirm(data.rows[0])
  })
}

/** 按 host/port 回查刚创建的设备，供选择列表直接确认绑定 */
async function fetchCreatedDevice(formData: Record<string, any>) {
  const result = await deviceTableRequest({
    queryKey: 'proxyHost',
    queryValue: formData.host,
    type: BuyProxyListType.Use,
  })
  if (result.code !== 0 || !result.data?.rows?.length) {
    return undefined
  }

  const rows = result.data.rows as DeviceItem[]
  return rows.find(
    row => String(row.host) === String(formData.host) && String(row.port ?? '') === String(formData.port ?? ''),
  ) ?? rows[0]
}

/** 抽屉新增设备：创建成功后关闭新增抽屉与选择列表，并绑定到当前账号 */
function onAddDevice() {
  if (!check('Proxy_List_add')) {
    onlyErrorToast(-1, $t('暂无权限'))
    return
  }

  showProxyFormDrawer({
    title: deviceCreateLabels.pageTitle,
    showRemark: true,
    mode: 'device',
    dismissable: false,
    onConfirm: async (formData) => {
      let saved = false
      await saveProxyModules([formData], {
        labels: deviceCreateLabels,
        onSuccess: async () => {
          saved = true
          const created = await fetchCreatedDevice(formData)
          if (!created) {
            onlyErrorToast(-1, $t('设备添加成功，但未能自动绑定，请手动选择'))
            onRefreshTable({}, true)
            return
          }
          await onConfirm(toRaw(created))
        },
      })
      if (!saved) {
        return false
      }
    },
  })
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'fuzzy'), queryValue: value }, true)
}

// async function onCheckAllProxy() {
//   const testableDevices = filterTestableDevices(dataList.value ?? [])
//   if (!testableDevices.length)
//     return
//   await onCheckProxyStatus(testableDevices, { key: 'test' })
// }

async function onCheckProxyStatus(datas: DeviceItem[], options: { key: string, apiCheck?: boolean, enableReCheck?: boolean }) {
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
    updateProxyModules({ proxyList: results, requestType: ProxyReqType.SpeedTest })
  }

  return results
}

async function saveSelected() {
  if (!selection.value) {
    onlyErrorToast(-1, $t('请选择设备'))
    return
  }

  const { loadingOperationMap: _, ...item } = selection.value as DeviceItem
  await onConfirm(toRaw(item))
}
</script>

<template>
  <div class="device-select-panel flex flex-col h-full">
    <div v-if="warningMessage" class="device-select-warning px-4 pt-4">
      <RxAlert class="min-w-full" type="warn" :closable="false" :title="warningMessage" />
    </div>
    <div class="device-select-content flex flex-col flex-1 min-h-0 px-4 pt-4 pb-0">
      <div class="device-select-header flex flex-wrap gap-1.5 items-center justify-between">
        <div class="flex items-center gap-1.5 flex-wrap">
          <RxButton size="xxs" icon="base/rx_ic_cart" :label="$t('购买设备')" @click.stop="onBuyProxy()" />
          <RxButton v-if="check('Proxy_List_add')" variant="outlined" severity="secondary" size="xxs" icon="base/rx_ic_plus" :label="$t('添加设备')" @click.stop="onAddDevice()" />
          <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
          <!-- <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="onCheckAllProxy" /> -->
        </div>
      </div>
      <div class="flex-ovh-1">
        <RyTable ref="deviceTable" v-model:selection="selection" v-bind="tableProps" cache-key="ecommerce-device-select-list" :table-request="getTableList" selection-mode="single"
                 :clear-selection-on-request="false" :virtual-scroller-options="{ itemSize: 60 }" :show-table-header="false"
        >
          <template #table-empty>
            <CustomNewEmpty class="empty" icon="base/rx_ic_internet" img="empty-device.png" :title="$t('暂无设备')" :desc="$t('在此购买设备，并更方便地与电商账号进行绑定。')">
              <template #extra>
                <div class="flex gap-3">
                  <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_cart" :label="$t('购买设备')" @click.stop="onBuyProxy()" />
                  <RxButton v-if="check('Proxy_List_add')" outlined severity="secondary" size="xs" icon="base/rx_ic_plus" :label="$t('添加设备')" @click.stop="onAddDevice()" />
                </div>
              </template>
            </CustomNewEmpty>
          </template>
          <template #outbound="{ data: row }">
            <DeviceOutboundCell class="select-none" :country="row.lastCountry" :city="row.lastCity" :last-ip="row.lastIp" :time="row.checkTime" :status="checkedMessage[row.id]"
                                :badge-desc="row.badgeTypeDesc" :is-loading="row.loadingOperationMap?.test"
            />
          </template>
          <template #remark="{ data: row }">
            <RxSvgIcon v-tooltip.top="{ value: row.remark, showDelay: 500 }" :name="row.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ 'color-[#12A3FC]': row.remark }" />
          </template>
          <template #bindList="{ data: row }">
            <RelatedProfilesCell :list="row.bindAccountList" />
          </template>
          <template #actions="{ data: row }">
            <Actions :operation="testOnlyOperations(row)" :loading-operation-map="row.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, row)" />
          </template>
        </RyTable>
      </div>
      <div class="button-group w-full flex justify-end gap-3">
        <RxButton :label="$t('确认绑定')" :disabled="!selection" @click.stop="saveSelected" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.empty {
  :deep(.content) {
    width: 700px;
  }
}

.device-select-content {
  min-width: var(--width-xl, 768px);
}

.device-select-header {
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
</style>
