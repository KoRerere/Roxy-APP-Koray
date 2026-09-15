<script setup lang="tsx">
import { h } from 'vue'
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
// import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import ExpireDate from '/@/views/agent/shop/components/expire-date.vue'
import BandwidthCell from '/@/views/agent/shop/components/bandwidth-cell.vue'
import HelpModal from '/@/views/agent/shop/components/help-modal.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import ProviderSimpleList from '/@/views/agent/shop/components/provider-simple-list.vue'
import ProfileSelect from '/@/views/account/list/components/profile-select.vue'
import { parseWindowInfo } from '/@/views/account/list/utils'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import RemarkCell from '/@/views/agent/shop/components/remark-cell.vue'
import ProxyFilter from '/@/views/agent/shop/components/proxy-filter/index.vue'
import { useProxyFilter } from '/@/views/agent/shop/components/proxy-filter/useProxyFilter'
import currency from 'currency.js'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useDrawer } from '/@/hooks/useDrawer'
import { genPollingChecker, isEmptyValue, setOperationLoading, setRowsLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { useProxyFormDrawer } from '/@/views/agent/hooks/useProxyFormDrawer'
import { useProxyModuleCreate } from '/@/views/agent/hooks/useProxyModuleCreate'
import { getRelatedProfileLabels, useColumns } from './columns'
import { useProviderJump } from './hooks/useProviderJump'
import { usePendingOpenRoxyIpBuy } from './hooks/useProxyDetectFailGuide'
import { getAdvancedSearch, getCustomFilters, getSorts, tableOperation, tableRequest } from './operation'
import { canShowProxyQrcode, fetchWorkspaceKycUnlockedCached, isBuyProxy } from './utils/proxy-download-kyc-gate'
import { isProxySpeedTestable } from './utils/proxy-speed-testable'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { BuyProxyListType, ProxyAutoRenewalStatus, ProxyCheckStatus, ProxyExpireStatus, ProxyOrderStatus, ProxyReqType, ProxyType } from '/@/enums'
import { usePermission } from '/@/hooks/usePermission'
import { useEmitterEvent } from '/@/utils/eventBus'
import { useConfirmAutoRenew } from '/@/views/pay/wallet/components/useConfirmAutoRenew'
import type { ProxyItem } from './operation'
import type { ConcurrentProxyTestResults, ConcurrentProxyTestRun, ConcurrentProxyValidResult } from '/@/views/agent/hooks'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const drawerInstance = useDrawer()
const { showProxyFormDrawer } = useProxyFormDrawer(drawerInstance)
const { updateProxyModules } = useProxyModuleCreate()
const [showModal] = useDialog()
const { confirmEnableAutoRenew } = useConfirmAutoRenew()
const [showToast, onlyErrorToast] = useResponseToast()
const { userConfig } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { getOfficialWebsite } = useSimpleLocale()
const { columns } = useColumns()
const { testProxy: checkProxy, batchTestShowToast, concurrentProxyTest } = useCheckProxy()
const { showSimpleDialog } = useSimpleDialog()
const { buyProxy, downloadProxy, renewProxy, upgradeProxy, showProxyDownloadKycBlockModal } = useProxy()
const { isProviderJump, jumpToProvider } = useProviderJump()
usePendingOpenRoxyIpBuy(() => {
  void buyProxy()
})
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
  value: BuyProxyListType.List,
  // value: localStorage.getItem('ProxyShopHideType') || BuyProxyListType.Available,
  trueValue: BuyProxyListType.Available,
  falseValue: BuyProxyListType.List,
})

const proxyFilter = useProxyFilter({
  multiple: true,
  onApply: () => onRefreshTable(),
  initialValues: route.query.expireStatus
    ? { proxyExpireStatus: Number(route.query.expireStatus) }
    : undefined,
})

const scheduledCheckerProxyStatus = genPollingChecker({
  intervalMs: 5 * 60 * 1000,
  checkOnce: async () => {
    if (!userConfig.value.autoDetectProxy) {
      return true
    }
    await testAllProxy(true)
    return false
  },
})

watch(
  () => route.query._t,
  () => {
    if (route.query.expireStatus) {
      const expireStatus = Number(route.query.expireStatus)
      if (proxyFilter.applied.value.proxyExpireStatus !== expireStatus) {
        proxyFilter.setApplied({ proxyExpireStatus: expireStatus })
        onRefreshTable()
      }
    }
  },
)

onBeforeMount(async () => {
  scheduledCheckerProxyStatus.check()
  filtersMenu.value = await getCustomFilters()
  setNewOrderNo(route.query.orderNo as string)
})

onMounted(() => {
  void fetchWorkspaceKycUnlockedCached()
})

useEmitterEvent('updateShopList', (orderNo) => {
  onRefreshTable()
  setNewOrderNo(orderNo)
})

onBeforeUnmount(() => {
  scheduledCheckerProxyStatus.stop()
  clearTimeout(newOrderTimer.value)
})

async function getTableList(params: any) {
  const data = await tableRequest({ ...proxyFilter.getApiParams(), type: hideTypeConfig.value, ...params })
  dataList.value = (data.data?.rows || []).filter(item => isProxySpeedTestable(item as ProxyItem))
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
    case 'qrcode':
      if (canShowProxyQrcode(data)) {
        break
      }
      if (!isBuyProxy(data)) {
        break
      }
      if (!(await fetchWorkspaceKycUnlockedCached())) {
        showProxyDownloadKycBlockModal()
      }
      break
    case 'renew':
      onRenewProxy(datas)
      break
    case 'upgrade':
      onUpgradeProxy(datas)
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
  showProxyFormDrawer({
    title: $t('编辑代理 IP'),
    data,
    showRemark: true,
    mode: 'proxy',
    onConfirm: async (formData) => {
      const isOK = await updateProxyModules({
        proxyList: [formData],
      })
      if (!isOK) {
        return false
      }
      onRefreshTable()
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
        if (code !== 0) {
          return
        }
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

function onBuyProxy(props?: UserGetProxyVendorListListData['data'][number]) {
  if (props && isProviderJump(props)) {
    void jumpToProvider(props)
    return
  }

  buyProxy(toRaw(props)).then((orderInfo) => {
    onRefreshTable()
    setNewOrderNo(orderInfo?.orderNo)
  })
}

function setNewOrderNo(value?: string) {
  if (!value) {
    return
  }
  newOrderNo.value = value
  newOrderTimer.value = setTimeout(() => {
    newOrderNo.value = ''
    const { orderNo: _, ...query } = route.query
    router.replace({ name: 'agent-list', query })
  }, 3000)
}

async function testAllProxy(silent = false) {
  if (!check('Proxy_List_speed_test')) {
    return
  }

  if (!dataList.value?.length) {
    !silent && onlyErrorToast(-1, $t('暂无代理 IP'))
    return
  }
  if (checkerLoading.value) {
    return
  }
  checkerLoading.value = true
  try {
    await concurrentProxyTest(buildShopProxySpeedTestRun(dataList.value, { operateName: 'test', silent }))
    // 全部测速后把失败项置顶，仅本地重排，不触发列表接口
    moveFailedProxiesToFront()
  }
  finally {
    checkerLoading.value = false
  }
}

/** 将测速失败的代理排到当前列表最前，并同步表格展示数据 */
function moveFailedProxiesToFront() {
  // 必须以表格完整行为准重排：dataList 是测速用的过滤子集，直接拿它 updateDataList 会丢掉未纳入测速的行
  const tableRows = tableRef.value?.getDataList()
  const source = tableRows?.length ? tableRows : (dataList.value as ProxyItem[] | undefined)
  if (!source?.length) {
    return
  }

  const isFailed = (item: ProxyItem) =>
    isProxySpeedTestable(item)
    && (checkedMessage.value[item.id!] ?? item.checkStatus) === ProxyCheckStatus.failure

  const failed: ProxyItem[] = []
  const others: ProxyItem[] = []
  for (const item of source) {
    if (isFailed(item)) {
      failed.push(item)
    }
    else {
      others.push(item)
    }
  }
  if (!failed.length) {
    return
  }

  const reordered = [...failed, ...others]
  tableRef.value?.updateDataList(reordered)

  // dataList 保持为同一批对象，仅按新顺序同步，避免与表格脱节
  if (dataList.value?.length) {
    const order = new Map(reordered.map((item, index) => [item.id, index]))
    dataList.value = [...dataList.value].sort(
      (a, b) => (order.get(a.id!) ?? 0) - (order.get(b.id!) ?? 0),
    )
  }
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
      if (res === undefined) {
        setOperationLoading(datas[i]!, operateName, false)
      }
    })
    const validResults = results.filter(Boolean) as ConcurrentProxyValidResult[]
    if (!cancelled && !silent) {
      batchTestShowToast(validResults, { reCheck: () => concurrentProxyTest(buildShopProxySpeedTestRun(datas, { operateName, silent })) })
    }
    const proxyList = validResults.filter((item: any) => item?.proxyType === ProxyType.resource)
    if (!proxyList.length) {
      return
    }

    if (silent) {
      API.proxy.userBatchMdfProxyModuleCheckCreate({ proxyList })// 自动检测无日志
    }
    else {
      updateProxyModules({ proxyList, requestType: ProxyReqType.SpeedTest })
    }
  }

  return { tasks, tasksCompleted }
}

function onRenewProxy(datas: ProxyItem[]) {
  renewProxy(datas, () => {
    onRefreshTable()
  })
}

function onUpgradeProxy(datas: ProxyItem[]) {
  upgradeProxy(datas, () => {
    onRefreshTable()
  })
}

function download(datas: ProxyItem[]) {
  const { promise, resolve, reject } = Promise.withResolvers<void>()

  downloadProxy({
    items: datas,
    cancel: reject,
    confirm: resolve,
  })

  return promise
}

async function openHelp(data: ProxyItem) {
  const { code, data: refundInfo, msg } = await API.proxy.userGetProxyRefundInfoList({ proxyBuyId: data.id! })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }

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
  if (!check('Proxy_List_notes')) {
    return
  }

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
      if (code !== 0) {
        return
      }
      onRefreshTable()
    },
  })
}

function tableBeforeRefresh() {
  checkedMessage.value = {}
}

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...proxyFilter.getApiParams(),
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

  if (data.autoRenew !== ProxyAutoRenewalStatus.Enabled) {
    const confirmed = await confirmEnableAutoRenew()
    if (!confirmed) {
      return false
    }
  }

  return toggleAutoRenew(data)
}

async function toggleAutoRenew(data: ProxyItem) {
  const status = data.autoRenew === ProxyAutoRenewalStatus.Enabled ? ProxyAutoRenewalStatus.Disabled : ProxyAutoRenewalStatus.Enabled
  const { code, msg } = await API.proxy.userSetProxyAutoRenewalCreate({ proxyId: data.id, status })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return false
  }
  return true
}

function rowClass(data: ProxyItem) {
  return {
    'row-success': data.orderNo === newOrderNo.value,
    // 'row-disabled': data.proxyExpireStatus === ProxyExpireStatus.expired || [ProxyOrderStatus.pending, ProxyOrderStatus.refunded].includes(data.orderStatus!),
  }
}

function jumpToWhois(ip: string) {
  if (!ip) {
    return
  }
  window.open(getOfficialWebsite(`/whoer?ip=${ip}`), '_blank')
}

function bindProfiles(data: ProxyItem) {
  drawerInstance.showDrawer({
    title: $t('选择窗口'),
    slots: {
      container: () => h(ProfileSelect, {
        linkedWindowSortNums: parseWindowInfo(data.bindList),
        cacheKey: 'agent-profile-select',
        onClose: () => drawerInstance.hideDrawer(),
        onConfirm: async (profiles: any[]) => {
          if (!data.id) {
            return
          }
          const { code, msg } = await API.proxy.userMdfProxyBindWindowCreate({
            proxyId: data.id,
            windowIds: profiles.map(item => item.id),
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            onRefreshTable()
          }
        },
      }),
    },
  })
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ProviderSimpleList :on-buy-proxy="onBuyProxy" />
    <div class="flex flex-1 overflow-hidden">
      <RyTable ref="shoptable" v-model:columns="columns" lazy cache-key="agent-shop" selection-mode="multiple" class="agent-shop-table" :table-request="getTableList" :table-operation="tableOperation"
               removable-sort :table-sort="getSorts" :row-class="rowClass" :operation-handler="operationHandler" :before-refresh="tableBeforeRefresh" :virtual-scroller-options="{ itemSize: 60 }"
      >
        <template #filter-after>
          <div class="w-full flex gap-1.5 items-start justify-between">
            <div class="flex items-center gap-2">
              <div class="relative">
                <RxButton size="xxs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy()" />
                <div class="new-dot" />
              </div>
              <RxButton v-if="check('Proxy_List_add')" size="xxs" icon="base/rx_ic_plus" variant="outlined" :label="$t('添加')" @click.stop="createProxy" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
              <ProxyFilter :filter="proxyFilter" />
            </div>

            <div class="flex items-center gap-2">
              <!-- <div class="flex items-center gap-1.5">
                <RxCheckbox v-model="hideTypeConfig.value" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap" binary :true-value="hideTypeConfig.trueValue"
                            :false-value="hideTypeConfig.falseValue" @change="filters.onChange"
                />
                <label for="wrap" class="text-3 select-none cursor-pointer text-[var(--colors-text-text-secondary)]">{{
                  $t('隐藏不可用代理 IP') }}</label>
              </div> -->
              <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
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
            <OutboundIp v-tooltip.top="{ value: data.lastIp && $t('点击查看 IP 地址详情') }" :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime"
                        :status="checkedMessage[data.id]" :badge-desc="data.badgeTypeDesc" :is-loading="data.loadingOperationMap?.test" @click.stop="jumpToWhois(data.lastIp)"
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
        <template #expireDate="{ data }">
          <ExpireDate :data="data" :show-renew="check('Cost_Center_all')" @renew="() => onRenewProxy([data])" />
        </template>
        <template #bandwidth="{ data }">
          <BandwidthCell :data="data" :show-upgrade="check('Cost_Center_all')" @upgrade="() => onUpgradeProxy([data])" />
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
        <template #remark="{ data, column: { _cache } }">
          <RemarkCell :remark="data.remark" :extend="_cache.extend" @click.stop="operationHandler({ name: 'remark' }, data)" />
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
        <template #bindList="{ data }">
          <RelatedProfilesCell :list="getRelatedProfileLabels(data)" :show-add="check('Profiles_select_proxy')" @add="bindProfiles(data)" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.agent-shop-table) {
  tr:not([data-p-selected='true']):hover .row-hover-action,
  tr:not([data-p-selected='true']):focus-within .row-hover-action {
    opacity: 1;
  }

  tr:not([data-p-selected='true']):hover .row-hover-empty,
  tr:not([data-p-selected='true']):focus-within .row-hover-empty {
    display: none;
  }
}

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
