import { useConfirm } from 'primevue/useconfirm'
import type { InjectionKey } from 'vue'
import { API } from '/@/api'
import { createDefaultObject, isEmptyValue, setOperationLoading } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { BuyEntryType, BuyProxyListType, ProfileModifyType, ProfileReqType, ProxyCheckStatus, ProxyType } from '/@/enums'
import { usePermission } from '/@/hooks/usePermission'
import { useProxyStore } from '/@/stores/proxy'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import type { CheckResult } from '/@/views/agent/hooks'
import type { UserGetWindowInfoListListData, UserMdfWindowDataBatchCreatePayload } from '@roxy/backend-api'

import { clearProxyKeys, silentUpdateProxy } from '../components/util'

/** 窗口批量接口 proxyList 单项 */
type WindowProxyListItem = NonNullable<UserMdfWindowDataBatchCreatePayload['proxyList']>[number]

/**
 * 合约共有连接字段。moduleId / proxyMethod 由调用方按「入库选择 / 内联自定义」填，避免两套映射漂移。
 */
function toWindowProxyListFields(item: Record<string, any>): Omit<WindowProxyListItem, 'moduleId' | 'proxyMethod'> {
  return {
    checkStatus: item.checkStatus,
    lastIp: item.lastIp,
    lastCity: item.lastCity,
    lastCountry: item.lastCountry,
    timezone: item.timezone,
    checkTime: item.checkTime,
    host: item.host,
    // 合约 port 为 string；列表/解析结果可能是数字
    port: item.port == null ? undefined : String(item.port),
    proxyUserName: item.proxyUserName,
    proxyPassword: item.proxyPassword,
    proxyRules: item.proxyRules,
    ipType: item.ipType,
    proxyCategory: item.proxyCategory || item.protocol,
    refreshUrl: item.refreshUrl,
    checkChannel: item.checkChannel,
    protocol: item.protocol,
  }
}

/**
 * 把批量解析结果收成窗口内联绑定 payload。
 * moduleId 固定 0：只绑到窗口，不写入用户代理库。
 */
export function toInlineWindowProxyList(proxies: Record<string, any>[]): WindowProxyListItem[] {
  return proxies.map(item => ({
    ...toWindowProxyListFields(item),
    moduleId: 0,
    proxyMethod: 'custom',
  }))
}

/**
 * 按 _proxyCount 展开勾选行。非法数量按 1 处理，避免展开成空数组导致后续窗口漏绑。
 * 去掉 bindList：那是表格关联窗口展示字段，不能进绑定 payload。
 */
export function expandChosenProxyRows(proxies: Record<string, any>[]): Record<string, any>[] {
  return proxies.flatMap(({ _proxyCount, bindList: _bindList, ...item }) => {
    const count = Math.max(1, Number(_proxyCount) || 1)
    return Array.from({ length: count }, () => item)
  })
}

/**
 * 把已有代理库勾选结果收成窗口绑定 payload。
 * moduleId 用代理库 id；proxyMethod=choose，表示关联已有模块而非内联新建。
 */
export function toChosenWindowProxyList(proxies: Record<string, any>[]): WindowProxyListItem[] {
  return expandChosenProxyRows(proxies).map(item => ({
    ...toWindowProxyListFields(item),
    moduleId: item.id ?? 0,
    proxyMethod: 'choose',
  }))
}

interface ProfileLike {
  id?: number
  dirId?: string | number
  moduleId?: number
  openTime?: string | number | null
  [key: string]: any
}

type ProfileRow = UserGetWindowInfoListListData['data']['rows'][number]

/** 双开抽屉打开时的回调：购买成功回传可绑定代理行，添加成功回传表单 */
export interface ProxyBuyAddDrawerHandlers {
  onBuySuccess?: (proxy: any) => void | Promise<void>
  onAddConfirm?: (formData: Record<string, any>) => void | Promise<void>
}

/** 资源型代理模块测速结果同步（同一 moduleId 可绑定多窗口，批量测速时应对 moduleId 去重后只调一次） */
export function notifyProxyModuleSpeedTest(proxyList: any[]) {
  if (isEmptyValue(proxyList))
    return
  API.proxy.userMdfProxyModuleCreate({ proxyList, requestType: ProfileReqType.SpeedTest })
}

/** 仅写当前窗口行 + silentUpdate；代理模块请用 notifyProxyModuleSpeedTest（批量场景按 moduleId 去重） */
export async function persistProfileRowAfterProxySpeedTest(
  list: { item: ProfileLike, checkRes: CheckResult }[],
  options: { onlyErrorToast?: (code: number, msg: string) => void },
): Promise<void> {
  const validList = list.filter(data => data.checkRes.checkStatus === ProxyCheckStatus.success)
  if (validList.length === 0)
    return

  const proxyList = validList.map(data => ({
    id: data.item.id!,
    dirId: data.item.dirId,
    ...data.checkRes,
  }))

  const { code, msg } = await API.window.userMdfWindowProxyCheckBatchCreate({ proxyList, requestType: ProfileReqType.SpeedTest } as any)
  options.onlyErrorToast?.(code, msg)
}

/** 即时订单成功后解析可绑定代理行；非即时则跳转代理列表 */
async function resolvePurchasedProxyFromOrder(
  orderInfo: any,
  options: {
    router: ReturnType<typeof useRouter>
    showToast: (code: number, msg: string) => void
  },
) {
  options.showToast(0, $t('代理 IP 已购买成功，正在为您配置中，请稍后。若长时间未加载代理 IP，请刷新页面或联系技术支持。'))

  if (!orderInfo?.immediate) {
    options.router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
    return
  }

  const { code, data } = await API.proxy.userGetUserBuyProxyListList({
    orderNo: orderInfo?.orderNo,
    type: BuyProxyListType.Use,
  } as any)
  if (code !== 0 || !data.rows?.[0])
    return

  return data.rows[0]
}

export function useProfileProxy() {
  const confirm = useConfirm()
  const [, onlyErrorToast] = useResponseToast()

  function buildProxyData(profile: ProfileLike) {
    return {
      id: profile.moduleId,
      ...Object.fromEntries(
        ['host', 'ipType', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl', 'checkChannel']
          .map(key => [key, profile[key]]),
      ),
    }
  }

  function buildDeleteProxyParams(origin: ProfileLike) {
    const params: Record<string, any> = {
      moduleId: 0, // 为 0 表示解除关联
      proxyCategory: 'noproxy',
      proxyMethod: 'custom',
      buyProxyType: ProxyType.resource,
      checkStatus: ProxyCheckStatus.none,
      ...createDefaultObject(clearProxyKeys, ''),
    }

    if (!origin.openTime) {
      Reflect.set(params, 'lastIp', '')
    }
    else {
      Reflect.deleteProperty(params, 'lastIp')
    }

    return params
  }

  function confirmDeleteProxy(targets: ProfileLike | ProfileLike[]) {
    const datas = ([] as ProfileLike[]).concat(targets)
    const ids = datas.map(item => item.id!)
    const { promise, resolve, reject } = Promise.withResolvers<void>()

    confirm.require({
      header: $t('删除代理 IP'),
      message: $t('您确认要删除代理 IP 吗？'),
      rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
      acceptProps: { label: $t('确认'), severity: 'danger' },
      accept: async () => {
        const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ ids, type: ProfileModifyType.ProxyDelete, requestType: ProfileReqType.DeleteProxy })
        onlyErrorToast(code, msg)
        resolve()
        if (code !== 0)
          return

        datas.forEach((item) => {
          const params = buildDeleteProxyParams(item)
          silentUpdateProxy(item as any, params)
        })
      },
      reject,
      onHide: reject,
    })

    return promise
  }

  return {
    buildProxyData,
    confirmDeleteProxy,
  }
}

/**
 * 购买官方即时代理 IP。
 * 成功返回可绑定的代理行；用户取消、非即时订单跳转、或拉取失败时返回 undefined。
 */
export function usePurchaseOfficialProxy() {
  const router = useRouter()
  const [showToast] = useResponseToast()
  const { buyProxy } = useProxy()
  const { getProxyVendors } = useProxyStore()
  const proxyProvider = ref<any>()

  async function purchaseImmediateOfficialProxy() {
    if (!proxyProvider.value) {
      const vendors = await getProxyVendors()
      if (!vendors)
        return
      proxyProvider.value = vendors.find((item: any) => item.isOfficial)
    }

    if (!proxyProvider.value)
      return

    const provider = {
      proxyProviderId: proxyProvider.value.id,
      proxyProviderWebsite: proxyProvider.value.vendorWebsite,
      proxyProviderIcon: proxyProvider.value.vendorIcon,
      proxyProviderName: proxyProvider.value.vendorName,
    }

    try {
      const orderInfo = await buyProxy({ provider, entryType: BuyEntryType.Immediate })
      return await resolvePurchasedProxyFromOrder(orderInfo, { router, showToast })
    }
    catch {
      // 用户关闭购买弹窗时 buyProxy reject，忽略即可
    }
  }

  return { purchaseImmediateOfficialProxy }
}

/**
 * 窗口列表「添加代理 IP」双开抽屉（购买 + 手动添加）。
 * 需在页面级挂载 ProxyBuyAddDrawer，并通过 provide 下发给 ProfileInfo。
 */
export function useProxyBuyAddDrawer() {
  const router = useRouter()
  const [showToast] = useResponseToast()
  const { check } = usePermission()
  const { getProxyVendors } = useProxyStore()

  const visible = ref(false)
  const proxyProvider = ref<any>()
  const handlers = shallowRef<ProxyBuyAddDrawerHandlers>({})

  const showBuy = computed(() => check('Cost_Center_all'))
  const showAdd = computed(() => check('Profiles_add_proxy_outside'))

  const provider = computed(() => {
    if (!proxyProvider.value)
      return undefined

    return {
      proxyProviderId: proxyProvider.value.id,
      proxyProviderWebsite: proxyProvider.value.vendorWebsite,
      proxyProviderIcon: proxyProvider.value.vendorIcon,
      proxyProviderName: proxyProvider.value.vendorName,
    }
  })

  async function openProxyBuyAddDrawer(nextHandlers: ProxyBuyAddDrawerHandlers = {}) {
    if (showBuy.value && !proxyProvider.value) {
      const vendors = await getProxyVendors()
      if (!vendors)
        return
      proxyProvider.value = vendors.find((item: any) => item.isOfficial)
    }

    // 无可展示面板时不打开
    if (!showBuy.value && !showAdd.value)
      return

    handlers.value = nextHandlers
    visible.value = true
  }

  function closeProxyBuyAddDrawer() {
    visible.value = false
  }

  async function onProxyBuyAddBuySuccess(orderInfo: any) {
    try {
      const proxy = await resolvePurchasedProxyFromOrder(orderInfo, { router, showToast })
      if (proxy)
        await handlers.value.onBuySuccess?.(proxy)
    }
    finally {
      closeProxyBuyAddDrawer()
    }
  }

  async function onProxyBuyAddAddConfirm(formData: Record<string, any>) {
    try {
      await handlers.value.onAddConfirm?.(formData)
    }
    finally {
      closeProxyBuyAddDrawer()
    }
  }

  return {
    visible,
    showBuy,
    showAdd,
    provider,
    openProxyBuyAddDrawer,
    closeProxyBuyAddDrawer,
    onProxyBuyAddBuySuccess,
    onProxyBuyAddAddConfirm,
  }
}

export type ProxyBuyAddDrawerApi = ReturnType<typeof useProxyBuyAddDrawer>

export const PROXY_BUY_ADD_DRAWER_KEY: InjectionKey<ProxyBuyAddDrawerApi> = Symbol('proxyBuyAddDrawer')

/**
 * 窗口列表测速：并发检测、按行写窗口、按 moduleId 去重写代理模块（与 ProfileInfo 单行菜单共用 persist/notify）
 */
export function useProfileProxySpeedTest() {
  const { testProxy, batchTestShowToast, concurrentProxyTest } = useCheckProxy()
  const [, onlyErrorToast] = useResponseToast()

  async function runProxySpeedTestForRows(targets: ProfileRow[], options?: Record<string, unknown>) {
    if (!targets.length)
      return
    if (!globalThis.isElectron) {
      return globalThis.electronAPI.send('proxy:detect', {} as any)
    }

    const { operationName, showConcurrentTaskTopBar, silent } = { operationName: 'checkProxy', showConcurrentTaskTopBar: false, silent: false, ...options }

    const tasks = targets.map((item) => {
      setOperationLoading(item, operationName, true)
      return async () => {
        try {
          Reflect.deleteProperty(item, '_checkRes')
          const checkRes = await testProxy(toRaw(item))
          silentUpdateProxy(item, checkRes, { replaceProxy: false })
          Reflect.set(item, '_checkRes', toRaw(checkRes))
          return { item, checkRes }
        }
        finally {
          setOperationLoading(item, operationName, false)
        }
      }
    })

    await concurrentProxyTest({
      tasks,
      showConcurrentTaskTopBar,
      tasksCompleted: async (results: any[], cancelled: boolean) => {
        results.forEach((res, i) => {
          if (res === undefined)
            setOperationLoading(targets[i]!, operationName, false)
        })

        const validResults = results.filter(Boolean)

        if (!cancelled && !silent) {
          batchTestShowToast(
            validResults.map(p => ({ ...p.checkRes, proxyType: p.item.buyProxyType })),
            { reCheck: () => runProxySpeedTestForRows(targets, options) },
          )
        }

        const moduleDone = new Map<number, any>()
        for (const { item, checkRes } of validResults) {
          if (item.moduleId && item.buyProxyType === ProxyType.resource && !moduleDone.has(item.moduleId)) {
            moduleDone.set(item.moduleId, { id: item.moduleId, ...checkRes })
          }
        }

        notifyProxyModuleSpeedTest(Array.from(moduleDone.values()))
        await persistProfileRowAfterProxySpeedTest(results, { onlyErrorToast: silent ? undefined : onlyErrorToast })
      },
    }).catch((err) => {
      onlyErrorToast(-1, err.message)
      targets.forEach((item) => {
        setOperationLoading(item, operationName, false)
      })
    })
  }

  return { runProxySpeedTestForRows }
}
