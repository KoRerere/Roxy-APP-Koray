<script setup lang="tsx">
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
// import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import EditProxy from '/@/views/agent/create/quick.vue'
import AutoRenewModal from '/@/views/agent/shop/components/auto-renew-modal.vue'
import HelpModal from '/@/views/agent/shop/components/help-modal.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import ProviderSimpleList from '/@/views/agent/shop/components/provider-simple-list.vue'
import currency from 'currency.js'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useDrawer } from '/@/hooks/useDrawer'
import { genPollingChecker, isEmptyValue, setOperationLoading, setRowsLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import type { ConcurrentProxyTestResults, ConcurrentProxyTestRun, ConcurrentProxyValidResult } from '/@/views/agent/hooks'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { useColumns } from './columns'
import { getAdvancedSearch, getCustomFilters, getSorts, tableOperation, tableRequest } from './operation'
import { useUserStore } from '/@/stores/user'
import { BuyProxyListType, ProxyAutoRenewalStatus, ProxyCheckStatus, ProxyExpireStatus, ProxyOrderStatus, ProxyReqType, ProxyType } from '/@/enums'
import { usePermission } from '/@/hooks/usePermission'
import type { ProxyItem } from './operation'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const drawerInstance = useDrawer()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const { userConfig } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { columns, updateRemarkDisplayStatus } = useColumns()
const { testProxy: checkProxy, batchTestShowToast, concurrentProxyTest } = useCheckProxy()
const { showSimpleDialog } = useSimpleDialog()
const { buyProxy, downloadProxy, renewProxy } = useProxy()
const { check } = usePermission()
const advancedSearchOptions = getAdvancedSearch()
const tableRef = useTemplateRef('shoptable')
const filtersMenu = ref()
const hasFiltered = ref(false)
const dataList = ref()
const newOrderNo = ref()
const newOrderTimer = ref()
const checkerLoading = ref(false)

const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})

const hideTypeConfig = reactive({
  value: localStorage.getItem('ProxyShopHideType') || BuyProxyListType.Available,
  trueValue: BuyProxyListType.Available,
  falseValue: BuyProxyListType.List,
})

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
          name: $t('已添加'),
          value: ProxyType.resource.toString(),
        },
        {
          name: $t('已购买'),
          value: ProxyType.buy.toString(),
        },
      ],
    },
  ],
  getValues() {
    return Object.fromEntries(filters.list.filter(item => item.value).map(item => [item.name, item.value]))
  },
  onChange() {
    localStorage.setItem('ProxyShopHideType', hideTypeConfig.value)
    onRefreshTable()
  },
})

// const scheduledCheckerProxyStatus = genPollingChecker({
//   intervalMs: 5 * 60 * 1000,
//   checkOnce: async () => {
//     await testAllProxy(true)
//     return false
//   },
// })

onBeforeMount(async () => {
  // scheduledCheckerProxyStatus.check()
  filtersMenu.value = await getCustomFilters()
  setNewOrderNo(route.query.orderNo as string)
})

onBeforeUnmount(() => {
  // scheduledCheckerProxyStatus.stop()
  clearTimeout(newOrderTimer.value)
})

async function getTableList(params: any) {
  const data = await tableRequest({ ...filters.getValues(), type: hideTypeConfig.value, ...params })
  dataList.value = (data.data?.rows || []).filter(item => item.proxyType === ProxyType.resource || (item.proxyExpireStatus !== ProxyExpireStatus.expired && [ProxyOrderStatus.done, ProxyOrderStatus.refunding, ProxyOrderStatus.changing].includes(item.orderStatus!)))
  return data
}

async function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)

  switch (operate.name) {
    case 'edit':
      editProxy(data)
      break
    case 'refresh':
      refreshUrl(data)
      break
    case 'delete':
      await deleteProxy(datas)
      break
    case 'test':
      concurrentProxyTest(buildShopProxySpeedTestRun(datas, { operateName: operate.name }))
      break
    case 'download':
      await download(datas)
      break
    case 'renew':
      onRenewProxy(datas)
      break
    case 'remark':
      onRemark(data)
      break
  }
}

function createProxy() {
  mixpanelTrack('proxy_create_click')
  router.push({ name: 'agent-create' })
}

function editProxy(data: ProxyItem) {
  drawerInstance.showDrawer({
    title: $t('编辑代理 IP'),
    slots: {
      container: () => h(EditProxy, {
        data,
        showRemark: true,
        onConfirm: async (formData: any) => {
          const isOK = await updateResourceProxy({
            proxyList: [formData],
          })
          if (!isOK)
            return
          onRefreshTable()
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

async function deleteProxy(datas: ProxyItem[]) {
  return new Promise((resolve) => {
    confirm.require({
      header: $t('删除代理 IP'),
      message: $t('您确认要删除所选代理 IP 吗？'),
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
        const { code, msg } = await API.proxy.userDelProxyModuleV2Create({ ids: datas.map(item => item.id!) })
        onlyErrorToast(code, msg)
        if (code !== 0)
          return
        onRefreshTable()
        resolve(true)
      },
      reject: () => resolve(false),
      onHide: () => resolve(false),
    })
  })
}

async function refreshUrl(data: ProxyItem) {
  const _data = toRaw(data)
  const bindList = _data.bindList ?? []
  if (!bindList.length) {
    const isOK = await setRowsLoading(_data, 'refresh', () => globalThis.electronAPI.send('proxy:refreshUrl', _data.refreshUrl!))
    showToast(isOK ? 0 : -1, _data.refreshUrl as string)
    return
  }

  confirm.require({
    header: $t('刷新代理 IP'),
    message: $t('此代理 IP 已关联 {count} 个窗口，您确认要刷新代理 IP 吗？', { count: bindList.length }),
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
      const isOK = await setRowsLoading(_data, 'refresh', () => globalThis.electronAPI.send('proxy:refreshUrl', _data.refreshUrl!))
      showToast(isOK ? 0 : -1, _data.refreshUrl as string)
    },
  })
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'fuzzy'), queryValue: value }, true)
}

function onBuyProxy(props?: Record<string, any>) {
  buyProxy(toRaw(props)).then((orderInfo) => {
    onRefreshTable()
    setNewOrderNo(orderInfo?.orderNo || '')
  })
}

function setNewOrderNo(value: string) {
  if (!value)
    return
  newOrderNo.value = value
  newOrderTimer.value = setTimeout(() => {
    newOrderNo.value = ''
    const { orderNo: _, ...query } = route.query
    router.replace({ name: 'agent-list', query })
  }, 3000)
}

async function testAllProxy(silent = false) {
  if (!dataList.value?.length) {
    !silent && onlyErrorToast(-1, $t('暂无代理 IP'))
    return
  }
  if (checkerLoading.value)
    return
  checkerLoading.value = true
  await concurrentProxyTest(buildShopProxySpeedTestRun(dataList.value, { operateName: 'test', silent }))
  checkerLoading.value = false
}

function buildShopProxySpeedTestRun(datas: ProxyItem[], { operateName, silent }: { operateName: string, silent?: boolean }): ConcurrentProxyTestRun {
  const tasks = datas.map((item) => {
    setOperationLoading(item, operateName, true)
    return async () => {
      try {
        const checkResult = await checkProxy({
          ...toRaw(item),
          apiCheck: item.proxyType === ProxyType.buy,
          id: item.id,
        })
        Object.assign(item, checkResult)
        checkedMessage.value[item.id!] = checkResult.checkStatus
        return { ...checkResult, id: item.id, proxyType: item.proxyType }
      }
      finally {
        setOperationLoading(item, operateName, false)
      }
    }
  })

  function tasksCompleted(results: ConcurrentProxyTestResults, cancelled: boolean) {
    results.forEach((res, i) => {
      if (res === undefined)
        setOperationLoading(datas[i]!, operateName, false)
    })
    const validResults = results.filter(Boolean) as ConcurrentProxyValidResult[]
    if (!cancelled && !silent) {
      batchTestShowToast(validResults)
    }
    const proxyList = validResults.filter((item: any) => item?.proxyType === ProxyType.resource)
    if (!proxyList.length)
      return
    updateResourceProxy({ proxyList, requestType: ProxyReqType.SpeedTest })
  }

  return { tasks, tasksCompleted }
}

async function updateResourceProxy(params: { proxyList: any[], requestType?: ProxyReqType }) {
  const { code, msg } = await API.proxy.userMdfProxyModuleCreate(params)
  onlyErrorToast(code, msg)
  return code === 0
}

function onRenewProxy(datas: ProxyItem[]) {
  renewProxy(datas, () => {
    onRefreshTable()
  })
}

function download(datas: ProxyItem[]) {
  const { promise, resolve, reject } = Promise.withResolvers<void>()

  const data = datas.map(({ host, port, proxyUserName, proxyPassword }) => ({ host, port, username: proxyUserName, password: proxyPassword }))

  downloadProxy({
    data,
    cancel: reject,
    confirm: resolve,
  })

  return promise
}

async function openHelp(data: ProxyItem) {
  const { code, data: refundInfo, msg } = await API.proxy.userGetProxyRefundInfoList({ proxyBuyId: data.id! })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <HelpModal data={data} info={refundInfo} onReplace={onRefreshTable} onClose={hideModal} />,
    },
  })
}

function onRemark(data: any) {
  if (!check('Proxy_List_notes'))
    return

  showSimpleDialog({
    title: $t('为所选代理 IP 添加备注'),
    inputs: [
      {
        type: 'textarea',
        name: 'remark',
        value: data.remark,
        props: {
          placeholder: $t('请输入备注'),
          rows: 6,
        },
      },
    ],
    onConfirm: async ({ remark }: Record<string, any>) => {
      const { code, msg } = await API.proxy.userMdfUserBuyProxyRemarkCreate({ id: data.id!, proxyRemark: remark })
      onlyErrorToast(code, msg)
      if (code !== 0)
        return
      onRefreshTable()
    },
  })
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

function tableBeforeRefresh() {
  checkedMessage.value = {}
}

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  hasFiltered.value = !isEmptyValue(params)
  tableRef.value?.refresh(params, force)
}

async function autoRenewChange(data: ProxyItem) {
  const expireDate = new Date(data.expireDate!).getTime()
  const isLimit = expireDate > Date.now() && (expireDate - Date.now()) < 1000 * 60 * 60

  if (isLimit && data.autoRenew === ProxyAutoRenewalStatus.Enabled) {
    onlyErrorToast(-1, $t('到期前 {hour} 小时无法修改自动续费开关。', { hour: 1 }), {
      severity: 'warn',
      summary: $t('操作失败'),
      life: 5000,
    })
    return false
  }

  const notShowAgain = localStorage.getItem('autoRenewModalNotShowAgain')

  if (!!notShowAgain || data.autoRenew === ProxyAutoRenewalStatus.Enabled) {
    return toggleAutoRenew(data)
  }

  const { promise, resolve } = Promise.withResolvers<boolean>()
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <AutoRenewModal
          onClose={
            () => {
              hideModal()
              resolve(false)
            }
          }
          onConfirm={
            async () => {
              const isOK = await toggleAutoRenew(data)
              resolve(isOK)
              hideModal()
            }
          }
        />
      ),
    },
  })
  return promise
}

async function toggleAutoRenew(data: ProxyItem) {
  const status = data.autoRenew === ProxyAutoRenewalStatus.Enabled ? ProxyAutoRenewalStatus.Disabled : ProxyAutoRenewalStatus.Enabled
  const { code, msg } = await API.proxy.userSetProxyAutoRenewalCreate({ proxyId: data.id, status })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return false
  return true
}

function rowClass(data: ProxyItem) {
  return {
    'row-success': data.orderNo === newOrderNo.value,
    // 'row-disabled': data.proxyExpireStatus === ProxyExpireStatus.expired || [ProxyOrderStatus.pending, ProxyOrderStatus.refunded].includes(data.orderStatus!),
  }
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ProviderSimpleList :on-buy-proxy="onBuyProxy" />
    <div class="flex flex-1 overflow-hidden">
      <RyTable ref="shoptable" v-model:columns="columns" cache-key="agent-shop" selection-mode="multiple" :table-request="getTableList" :table-operation="tableOperation" removable-sort
               :table-sort="getSorts" :row-class="rowClass" :operation-handler="operationHandler" :before-refresh="tableBeforeRefresh"
      >
        <template #filter-after>
          <div class="w-full flex gap-1.5 items-start justify-between">
            <div class="flex items-center gap-1.5">
              <div class="relative">
                <RxButton size="xxs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy()" />
                <div class="new-dot" />
              </div>
              <RxButton v-if="check('Proxy_List_add')" size="xxs" icon="base/rx_ic_plus" variant="outlined" :label="$t('添加')" @click.stop="createProxy" />
            </div>

            <div class="flex items-center gap-1.5">
              <!-- <div class="flex items-center gap-1.5">
                <RxCheckbox v-model="hideTypeConfig.value" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap" binary :true-value="hideTypeConfig.trueValue"
                            :false-value="hideTypeConfig.falseValue" @change="filters.onChange"
                />
                <label for="wrap" class="text-3 select-none cursor-pointer text-[var(--colors-text-text-secondary)]">{{
                  $t('隐藏不可用代理 IP') }}</label>
              </div> -->
              <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
              <RxSelectButton v-for="item in filters.list" :key="item.value" v-model="item.value" :options="item.options" size="xxs" option-label="name" option-value="value" data-key="value"
                              @change="filters.onChange"
              />
              <RxButton v-if="check('Proxy_List_speed_test')" size="xxs" variant="outlined" severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部代理 IP')" :loading="checkerLoading"
                        @click.stop="testAllProxy()"
              />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
            </div>
          </div>
        </template>
        <template #table-empty>
          <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
          <CustomNewEmpty v-else icon="base/rx_ic_internet" img="empty-proxies.png" :title="$t('暂无代理 IP')" :desc="$t('在此购买代理 IP，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy()" />
                <RxButton v-if="check('Proxy_List_add')" outlined severity="secondary" size="xs" icon="base/rx_ic_plus" :label="$t('添加')" @click.stop="createProxy" />
              </div>
            </template>
          </CustomNewEmpty>
        </template>
        <template #outbound="{ data }">
          <div class="flex items-center gap-2.5">
            <OutboundIp :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime" :status="checkedMessage[data.id]"
                        :is-loading="data.loadingOperationMap?.test"
            />
            <div
              v-if="data.proxyType === ProxyType.buy && data.checkStatus === ProxyCheckStatus.failure && data.orderStatus === ProxyOrderStatus.done && data.proxyExpireStatus !== ProxyExpireStatus.expired"
              class="flex items-center gap-1.5"
            >
              <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-error)" />
              <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_fix" :label="$t('帮助')" @click.stop="openHelp(data)" />
            </div>
          </div>
        </template>
        <template #price="{ data }">
          <div v-if="data.proxyType === ProxyType.buy && data.canRenew">
            <span>{{ currency(data.proxyProviderDiscountPrice).format() }}</span>
            <span class="days"> / {{ $t('{day} 天', { day: 30 }) }}</span>
          </div>
          <div v-else>
            --
          </div>
        </template>
        <template #renew="{ data }">
          <div v-if="data.proxyType === ProxyType.buy && data.canRenew" class="scale-80" @click.stop>
            <RxToggleSwitch v-model="data.autoRenew" :disabled="data.orderStatus !== ProxyOrderStatus.done || data.proxyExpireStatus === ProxyExpireStatus.expired" :true-value="1" :false-value="0"
                            :before-change="() => autoRenewChange(data)"
            />
          </div>
          <div v-else>
            --
          </div>
        </template>
        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header">
            <span>{{ title }}</span>
            <SvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]" :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'"
                     @click.stop="toggleRemarkDisplayStatus(_cache)"
            />
          </div>
        </template>
        <template #remark="{ data, column: { _cache } }">
          <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.remark, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.remark }" text severity="secondary" size="xxs"
                      :icon="data.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            />
            <div v-if="_cache.extend" :title="data.remark" class="min-w-50 whitespace-pre-wrap note-content">
              {{
                data.remark }}
            </div>
          </div>
        </template>
        <template #providerType="{ data }">
          <div v-if="data.proxyType === ProxyType.buy" class="flex items-center gap-2">
            <div class="tag">
              {{ data.providerType }}
            </div>
          </div>
          <div v-else>
            --
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.row-success) {
  border-color: var(--component-table-border-updated);
  background: var(--colors-background-bg-success);

  & > td {
    border-color: var(--component-table-border-updated);
  }

  .p-datatable-frozen-column {
    background: var(--colors-background-bg-success);
  }
}

.new-dot {
  position: absolute;
  right: 0;
  top: 0;
  transform: translate(40%, -40%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--colors-background-bg-error);
}

.days {
  color: var(--colors-text-text-inactive);
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

.tag {
  padding: 5px 6px;
  border-radius: 2px;
  border: 1px solid var(--component-tag-border);
  background: var(--component-tag-bg);
  color: var(--colors-text-text-secondary);
  font-family: 'JetBrains Mono';
  font-size: 10px;
  font-weight: 800;
  line-height: 8px;
}
</style>
