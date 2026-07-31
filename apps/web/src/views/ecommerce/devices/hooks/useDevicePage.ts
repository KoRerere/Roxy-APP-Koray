import { h } from 'vue'
import EditProxy from '/@/views/agent/create/quick.vue'
import AutoRenewModal from '/@/views/agent/shop/components/auto-renew-modal.vue'
import HelpModal from '/@/views/agent/shop/components/help-modal.vue'
import DeviceDetail from '/@/views/ecommerce/devices/device-detail.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useDrawer } from '/@/hooks/useDrawer'
import { isEmptyValue, setOperationLoading, setRowsLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { useProviderJump } from '/@/views/agent/shop/hooks/useProviderJump'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'
import { useDeviceColumns } from '../device-columns'
import {
  deviceTableRequest,
  filterTestableDevices,
  getDeviceAdvancedSearch,
  getDeviceCustomFilters,
  getDeviceFilterGroups,
  getDeviceListFilterFromRoute,
  getDeviceOperation,
  getDeviceSorts,
  hasAnyDeviceBoundAccounts,
} from '../device-operation'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useProxyFilter } from '/@/views/agent/shop/components/proxy-filter/useProxyFilter'
import { usePermission } from '/@/hooks/usePermission'
import { useEmitterEvent } from '/@/utils/eventBus'
import { useEcommerceAccountNavigation } from '/@/views/ecommerce/accounts/hooks/useEcommerceAccountNavigation'
import type { DeviceItem } from '../device-operation'
import type { ConcurrentProxyTestResults, ConcurrentProxyTestRun, ConcurrentProxyValidResult } from '/@/views/agent/hooks'
import type { ProxyCheckStatus } from '/@/enums'
import { BuyProxyListType, ProxyAutoRenewalStatus, ProxyExpireStatus, ProxyOrderStatus, ProxyReplaceType, ProxyReqType, ProxyType } from '/@/enums'

export function useDevicePage() {
  const route = useRoute()
  const router = useRouter()
  const confirm = useConfirm()
  const drawerInstance = useDrawer()
  const [showModal] = useDialog()
  const [showToast, onlyErrorToast] = useResponseToast()
  const { userConfig } = storeToRefs(useUserStore())
  const { mixpanelTrack } = useUserStore()
  const { getOfficialWebsite } = useSimpleLocale()
  const { columns, updateRemarkDisplayStatus } = useDeviceColumns()
  const { testProxy: checkProxy, batchTestShowToast, concurrentProxyTest } = useCheckProxy()
  const { showSimpleDialog } = useSimpleDialog()
  const { buyProxy, renewProxy } = useProxy()
  const { refreshEcommerceAccountListAfterDeviceChange } = useEcommerceAccountNavigation()
  const { isProviderJump, jumpToProvider } = useProviderJump()
  const { check } = usePermission()
  const advancedSearchOptions = getDeviceAdvancedSearch()
  const tableRef = useTemplateRef<any>('tableRef')
  const filtersMenu = ref()
  const hasFiltered = ref(false)
  const dataList = ref<DeviceItem[]>()
  const newOrderNo = ref<string>()
  const newOrderTimer = ref<ReturnType<typeof setTimeout>>()
  const checkerLoading = ref(false)
  const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})

  const hideTypeConfig = reactive({
    value: BuyProxyListType.List,
    trueValue: BuyProxyListType.Available,
    falseValue: BuyProxyListType.List,
  })

  const proxyFilter = useProxyFilter({
    multiple: true,
    filterGroups: getDeviceFilterGroups(),
    onApply: () => onRefreshTable(),
    initialValues: (() => {
      const routeFilters = getDeviceListFilterFromRoute(route.query)
      return Object.keys(routeFilters).length ? routeFilters : undefined
    })(),
  })

  // const scheduledChecker = genPollingChecker({
  //   intervalMs: 5 * 60 * 1000,
  //   checkOnce: async () => {
  //     if (!userConfig.value.autoDetectProxy)
  //       return true
  //     await testAllDevices(true)
  //     return false
  //   },
  // })

  function syncRouteProxyFilters() {
    const routeFilters = getDeviceListFilterFromRoute(route.query)
    if (!Object.keys(routeFilters).length)
      return

    const needsUpdate = Object.entries(routeFilters).some(
      ([key, value]) => proxyFilter.applied.value[key as keyof typeof routeFilters] !== value,
    )
    if (needsUpdate) {
      proxyFilter.setApplied(routeFilters)
      onRefreshTable()
    }
  }

  watch(() => route.query._t, () => {
    syncRouteProxyFilters()
    void tryAutoOpenRenewFromRoute()
  })

  onBeforeMount(async () => {
    // scheduledChecker.check()
    filtersMenu.value = await getDeviceCustomFilters()
    setNewOrderNo(route.query.orderNo as string)
    void tryAutoOpenRenewFromRoute()
  })

  useEmitterEvent('updateShopList', (orderNo) => {
    onRefreshTable()
    setNewOrderNo(orderNo)
  })

  /** 仅已绑定账号的设备变更会影响账号列表展示 */
  function refreshAccountListIfBoundDevices(devices: DeviceItem | DeviceItem[]) {
    if (!hasAnyDeviceBoundAccounts(devices))
      return
    refreshEcommerceAccountListAfterDeviceChange()
  }

  onBeforeUnmount(() => {
    // scheduledChecker.stop()
    if (newOrderTimer.value)
      clearTimeout(newOrderTimer.value)
  })

  async function fetchDeviceTable(params: Record<string, unknown>) {
    return deviceTableRequest(params)
  }

  async function getTableList(params: any) {
    const filterParams = proxyFilter.getApiParams()
    const data = await fetchDeviceTable({
      ...filterParams,
      type: hideTypeConfig.value,
      ...params,
    })
    const showingExpired = filterParams.proxyExpireStatus === ProxyExpireStatus.expired
    dataList.value = (data.data?.rows || []).filter((item) => {
      if (item.proxyType === ProxyType.resource)
        return true
      if (showingExpired)
        return item.proxyExpireStatus === ProxyExpireStatus.expired
      return item.proxyExpireStatus !== ProxyExpireStatus.expired
        && [ProxyOrderStatus.done, ProxyOrderStatus.refunding, ProxyOrderStatus.changing].includes(item.orderStatus!)
    }) as DeviceItem[]
    return data
  }

  async function operationHandler(operate: any, data: DeviceItem) {
    const datas = ([] as DeviceItem[]).concat(data)

    switch (operate.name) {
      case 'edit':
        editDevice(data)
        break
      case 'refresh':
        refreshDeviceUrl(data)
        break
      case 'delete':
        await deleteDevices(datas)
        break
      case 'detail':
        showDeviceDetail(data)
        break
      case 'test':
        concurrentProxyTest(buildDeviceSpeedTestRun(datas, { operateName: operate.name }))
        break
      case 'renew':
        onRenewDevices(datas)
        break
      case 'remark':
        onRemark(data)
        break
    }
  }

  function createDevice() {
    mixpanelTrack('proxy_create_click')
    router.push({ name: 'ecommerce-device-create' })
  }

  function editDevice(data: DeviceItem) {
    drawerInstance.showDrawer({
      title: $t('编辑设备'),
      slots: {
        container: () => h(EditProxy, {
          data,
          showRemark: true,
          onConfirm: async (formData: any) => {
            const isOK = await updateResourceDevice({
              proxyList: [formData],
            })
            if (!isOK)
              return
            onRefreshTable()
            refreshAccountListIfBoundDevices(data)
            drawerInstance.hideDrawer()
          },
        }),
      },
    })
  }

  async function deleteDevices(datas: DeviceItem[]) {
    return new Promise((resolve) => {
      confirm.require({
        header: $t('删除设备'),
        message: $t('您确认要删除所选设备吗？'),
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
          refreshAccountListIfBoundDevices(datas)
          resolve(true)
        },
        reject: () => resolve(false),
        onHide: () => resolve(false),
      })
    })
  }

  async function showDeviceDetail(data: DeviceItem) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(DeviceDetail, { data, onClose: hideModal }),
      },
    })
  }

  async function refreshDeviceUrl(data: DeviceItem) {
    const _data = toRaw(data)
    const bindList = _data.bindList ?? []
    if (!bindList.length) {
      const isOK = await setRowsLoading(_data, 'refresh', () => globalThis.electronAPI.send('proxy:refreshUrl', _data.refreshUrl!))
      showToast(isOK ? 0 : -1, _data.refreshUrl as string)
      return
    }

    confirm.require({
      header: $t('刷新设备'),
      message: $t('此设备已关联 {count} 个账号，您确认要刷新设备吗？', { count: bindList.length }),
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

  function onBuyDevice(payload?: UserGetProxyVendorListListData['data'][number] | Record<string, any>) {
    const vendor = payload as UserGetProxyVendorListListData['data'][number] | undefined
    if (vendor && isProviderJump(vendor)) {
      void jumpToProvider(vendor)
      return
    }

    buyProxy({ ...(payload ? toRaw(payload) : {}), mode: 'device' }).then((orderInfo) => {
      onRefreshTable()
      setNewOrderNo(orderInfo?.orderNo)
    })
  }

  function setNewOrderNo(value?: string) {
    if (!value)
      return
    newOrderNo.value = value
    newOrderTimer.value = setTimeout(() => {
      newOrderNo.value = ''
      const { orderNo: _, ...query } = route.query
      router.replace({ name: 'ecommerce-device-list', query })
    }, 3000)
  }

  async function testAllDevices(silent = false) {
    if (!check('Proxy_List_speed_test'))
      return

    const testableDevices = filterTestableDevices(dataList.value ?? [])
    if (!testableDevices.length)
      return
    if (checkerLoading.value)
      return
    checkerLoading.value = true
    await concurrentProxyTest(buildDeviceSpeedTestRun(testableDevices, { operateName: 'test', silent }))
    checkerLoading.value = false
  }

  function buildDeviceSpeedTestRun(datas: DeviceItem[], { operateName, silent }: { operateName: string, silent?: boolean }): ConcurrentProxyTestRun {
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
        batchTestShowToast(validResults, { reCheck: () => concurrentProxyTest(buildDeviceSpeedTestRun(datas, { operateName, silent })) })
      }
      const proxyList = validResults.filter((item: any) => item?.proxyType === ProxyType.resource)
      if (!proxyList.length)
        return

      if (silent) {
        API.proxy.userBatchMdfProxyModuleCheckCreate({ proxyList })
      }
      else {
        updateResourceDevice({ proxyList, requestType: ProxyReqType.SpeedTest })
      }
    }

    return { tasks, tasksCompleted }
  }

  async function updateResourceDevice(params: { proxyList: any[], requestType?: ProxyReqType }) {
    const { code, msg } = await API.proxy.userMdfProxyModuleCreate(params)
    onlyErrorToast(code, msg)
    return code === 0
  }

  function onRenewDevices(datas: DeviceItem[]) {
    renewProxy(datas, () => {
      onRefreshTable()
      refreshAccountListIfBoundDevices(datas)
    })
  }

  /** 清除路由中的自动续费标记，保留筛选条件，避免重复弹窗 */
  function clearRenewActionQuery() {
    const { action: _action, deviceId: _deviceId, ...query } = route.query
    router.replace({ name: 'ecommerce-device-list', query })
  }

  /**
   * 账号页「续费」跳转落地：按 deviceId 拉详情后自动打开续费弹窗
   * 与公告栏 action=buy 模式一致，先清 query 再弹窗，防止重复触发
   */
  async function tryAutoOpenRenewFromRoute() {
    if (route.query.action !== 'renew')
      return
    if (!check('Cost_Center_all')) {
      clearRenewActionQuery()
      return
    }

    const deviceId = route.query.deviceId
    if (deviceId == null || deviceId === '') {
      clearRenewActionQuery()
      return
    }

    clearRenewActionQuery()

    const { code, data, msg } = await API.proxy.userGetProxyDeviceDetailList({ id: String(deviceId) })
    onlyErrorToast(code, msg)
    if (code !== 0 || !data)
      return

    onRenewDevices([data as unknown as DeviceItem])
  }

  async function openHelp(data: DeviceItem) {
    const { code, data: refundInfo, msg } = await API.proxy.userGetProxyRefundInfoList({ proxyBuyId: data.id! })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(HelpModal, {
          data,
          info: refundInfo,
          onReplace: (replaceType: ProxyReplaceType) => {
            onRefreshTable()
            if (replaceType === ProxyReplaceType.Refund)
              refreshAccountListIfBoundDevices(data)
          },
          onClose: hideModal,
        }),
      },
    })
  }

  function onRemark(data: DeviceItem) {
    if (!check('Proxy_List_notes'))
      return

    showSimpleDialog({
      title: $t('为所选设备添加备注'),
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
    if (userConfig.value.remarkDisplayStatus !== cache.extend)
      updateRemarkDisplayStatus(cache.extend)
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

  async function autoRenewChange(data: DeviceItem) {
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

    if (!!notShowAgain || data.autoRenew === ProxyAutoRenewalStatus.Enabled)
      return toggleAutoRenew(data)

    const { promise, resolve } = Promise.withResolvers<boolean>()
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(AutoRenewModal, {
          onClose: () => {
            hideModal()
            resolve(false)
          },
          onConfirm: async () => {
            const isOK = await toggleAutoRenew(data)
            resolve(isOK)
            hideModal()
          },
        }),
      },
    })
    return promise
  }

  async function toggleAutoRenew(data: DeviceItem) {
    const status = data.autoRenew === ProxyAutoRenewalStatus.Enabled ? ProxyAutoRenewalStatus.Disabled : ProxyAutoRenewalStatus.Enabled
    const { code, msg } = await API.proxy.userSetProxyAutoRenewalCreate({ proxyId: data.id, status })
    onlyErrorToast(code, msg)
    return code === 0
  }

  function rowClass(data: DeviceItem) {
    return {
      'row-success': data.orderNo === newOrderNo.value,
    }
  }

  function jumpToWhois(ip: string) {
    if (!ip)
      return
    window.open(getOfficialWebsite(`/whoer?ip=${ip}`), '_blank')
  }

  return {
    tableRef,
    columns,
    filtersMenu,
    hasFiltered,
    checkedMessage,
    proxyFilter,
    advancedSearchOptions,
    checkerLoading,
    getTableList,
    getDeviceOperation,
    getDeviceSorts,
    operationHandler,
    createDevice,
    onBuyDevice,
    onAdvancedSearch,
    testAllDevices,
    onRefreshTable,
    tableBeforeRefresh,
    rowClass,
    jumpToWhois,
    openHelp,
    onRenewDevices,
    autoRenewChange,
    toggleRemarkDisplayStatus,
    check,
  }
}
