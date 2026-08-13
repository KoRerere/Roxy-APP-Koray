import { h } from 'vue'
import SingleProxies from '/@/views/agent/create/components/single-proxies.vue'
import { useProxy } from '/@/views/agent/hooks'
import { useDrawer } from '/@/hooks/useDrawer'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { emitter } from '/@/utils/eventBus'
import { BuyEntryType } from '/@/enums'
import type { ProxyCreateMode } from '/@/views/agent/create/proxy-create-mode'

/** 打开代理/设备单条表单抽屉的配置 */
export interface ProxyFormDrawerOptions {
  /** 抽屉标题 */
  title: string
  /** 编辑时的回填数据 */
  data?: Record<string, any>
  /** 是否展示备注入口 */
  showRemark?: boolean
  /** 显式文案模式；抽屉场景建议必传 */
  mode?: ProxyCreateMode
  /** 是否允许点击遮罩关闭 */
  dismissable?: boolean
  /** 是否允许 Esc 关闭 */
  closeOnEscape?: boolean
  /** 抽屉关闭回调 */
  onHide?: () => void
  /**
   * 表单确认回调。
   * 返回 false 时保持抽屉打开；其余（含 void）在成功 resolve 后关闭。
   */
  onConfirm: (formData: Record<string, any>) => void | boolean | Promise<void | boolean>
}

/** 抽屉内广告购买所需依赖（在 composable setup 中注入） */
interface ProxyFormDrawerBuyDeps {
  buyProxy: ReturnType<typeof useProxy>['buyProxy']
  showToast: ReturnType<typeof useResponseToast>[0]
  router: ReturnType<typeof useRouter>
}

/**
 * 在指定 drawer 实例中直接挂载 SingleProxies。
 * 由 onConfirm 返回值决定是否关闭抽屉。
 */
export async function openProxyFormDrawer(
  drawerInstance: ReturnType<typeof useDrawer>,
  options: ProxyFormDrawerOptions,
  buyDeps?: ProxyFormDrawerBuyDeps,
) {
  const {
    title,
    data,
    showRemark,
    mode,
    dismissable,
    closeOnEscape,
    onHide,
    onConfirm,
  } = options

  /** 广告「立即购买」：弹购买菜单，成功后关抽屉并回列表高亮新单 */
  async function onBuy() {
    if (!buyDeps)
      return

    try {
      const isDevice = mode === 'device'
      const orderInfo = await buyDeps.buyProxy({
        entryType: BuyEntryType.Immediate,
        ...(isDevice ? { mode: 'device' as const } : {}),
      })

      buyDeps.showToast(0, isDevice
        ? $t('设备已购买成功，正在为您配置中，请稍后。若长时间未加载设备，请刷新页面或联系技术支持。')
        : $t('代理 IP 已购买成功，正在为您配置中，请稍后。若长时间未加载代理 IP，请刷新页面或联系技术支持。'))

      drawerInstance.hideDrawer()
      emitter.emit('updateShopList', orderInfo?.orderNo)

      const routeName = isDevice ? 'ecommerce-device-list' : 'agent-list'
      buyDeps.router.replace({
        name: routeName,
        query: routeName === 'agent-list'
          ? { name: 'shop', orderNo: orderInfo?.orderNo }
          : { orderNo: orderInfo?.orderNo },
      })
    }
    catch {
      // 用户关闭购买弹窗时 buyProxy reject，忽略即可
    }
  }

  await drawerInstance.showDrawer({
    title,
    dismissable,
    closeOnEscape,
    onHide,
    slots: {
      container: () => h(SingleProxies, {
        data,
        showRemark,
        mode,
        showAdvertise: true,
        onBuy,
        onConfirm: async (formData: Record<string, any>) => {
          const result = await onConfirm(formData)
          if (result === false)
            return
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

/**
 * 封装代理/设备表单抽屉打开逻辑；可传入已有 drawer 实例以复用挂载点。
 */
export function useProxyFormDrawer(drawerInstance?: ReturnType<typeof useDrawer>) {
  const drawer = drawerInstance ?? useDrawer()
  const router = useRouter()
  const { buyProxy } = useProxy()
  const [showToast] = useResponseToast()
  const buyDeps: ProxyFormDrawerBuyDeps = { buyProxy, showToast, router }

  return {
    drawerInstance: drawer,
    hideDrawer: drawer.hideDrawer,
    showProxyFormDrawer: (options: ProxyFormDrawerOptions) => openProxyFormDrawer(drawer, options, buyDeps),
  }
}
