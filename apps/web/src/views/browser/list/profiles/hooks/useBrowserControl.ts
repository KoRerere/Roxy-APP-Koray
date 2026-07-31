import TrialEnded from '/@/layout/components/header/components/trial-ended.vue'
import { computed, h, unref } from 'vue'
import { API } from '/@/api'
import { ProxyExpireStatus } from '/@/enums/proxy'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { windowManager } from '/@/utils/windowManager'
import { isDev } from '/@/utils'
import { createOpeningMessage, createOpenSuccessMessage, setProfileOpenMessage } from './useProfileOpenState'
import type { ProfileOpenMessage, ProfileRow } from './useProfileOpenState'
import { createProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useRouteContext } from '/@/composables/useRouteContext'
import type { MaybeRef } from 'vue'
import type { Driver } from 'driver.js'

/** 按钮控件展示态 */
interface BrowserControlViewState {
  msg: string
  classes: string
  code?: number
  pending?: boolean
  percent?: number
  error?: string
  warning?: string
  opening?: boolean
  uploading?: boolean
  completed?: boolean
}

interface UseBrowserControlOptions {
  data: MaybeRef<ProfileRow>
  openMessage: MaybeRef<Record<string, ProfileOpenMessage>>
  text?: MaybeRef<string>
  driverObj?: MaybeRef<Driver | undefined>
  driverNext?: () => void
  sendFirstOpenRecord?: () => void
  onOpen: (data: ProfileRow) => void
}

/** 行数据是否标记为电商模式窗口/账号 */
export function isEcommerceProfile(isEcommerce?: boolean | number) {
  return isEcommerce === true || isEcommerce === 1
}

/**
 * BrowserControl 组件的全部逻辑：展示态、云浏览器打开、点击处理。
 */
export function useBrowserControl(options: UseBrowserControlOptions) {
  const [showModal] = useDialog()
  const [_, onlyErrorToast] = useResponseToast()
  const simpleLocale = useSimpleLocale()
  const { userInfo, userConfig } = storeToRefs(useUserStore())
  const { isEcommerce } = useRouteContext()
  const profileLabels = computed(() => createProfileEntityLabels(isEcommerce.value))

  const coreInfo = computed(() => {
    const data = unref(options.data)
    return `${data.coreType} ${data.coreVersion}`
  })

  const isOpenLimitReached = computed(() => !unref(options.data).openLimitStatus)

  /** 当前列表模式与行数据模式不一致（跨模式过期不可开） */
  const isCrossModeExpired = computed(() => {
    if (!isOpenLimitReached.value)
      return false
    return isEcommerceProfile(unref(options.data).isEcommerce) !== isEcommerce.value
  })

  /** 跨模式过期时的锁定说明 */
  const crossModeExpiredTip = computed(() => {
    if (!isCrossModeExpired.value)
      return ''
    const profileIsEcommerce = isEcommerceProfile(unref(options.data).isEcommerce)

    return profileIsEcommerce ? $t('电商账号设备过期，无法打开') : $t('通用窗口额度不足，无法打开')
  })

  const usePeoples = computed(() => {
    const data = unref(options.data)
    const users = (data.statusInfo ?? [])
      .filter(item => item.openUserId !== userInfo.value.id)
      .map(item => item.openUserName)
      .filter(Boolean)

    if (users.length < 1)
      return ''

    return `${$t('{count} 人正在使用', { count: users.length })}：${users.join(', ')}`
  })

  const browser = computed<BrowserControlViewState>(() => {
    const data = unref(options.data)
    const openMessage = unref(options.openMessage)
    const text = unref(options.text) ?? profileLabels.value.open
    const dirId = data.dirId!
    const message = openMessage[dirId]

    if (!message) {
      return {
        msg: text,
        classes: 'cursor-pointer',
        error: data.proxyExpireStatus === ProxyExpireStatus.expired
          ? profileLabels.value.proxyExpiredBeforeOpen
          : undefined,
      }
    }

    const { uploading, pending, code, data: messageData, error } = message
    const isFailed = code === 1 || !!error
    const completed = messageData?.percent === 100
    const opening = !(isFailed || completed)

    return {
      code,
      pending,
      msg: isFailed ? text : (messageData?.message ?? text),
      percent: messageData?.percent || 0,
      error: isFailed ? (message.message || error?.message) : undefined,
      warning: messageData?.warningMessages?.join('\n'),
      opening,
      uploading,
      completed,
      classes: opening || uploading ? 'cursor-not-allowed' : 'cursor-pointer',
    }
  })

  const isButtonDisabled = computed(() => {
    const state = browser.value
    return isOpenLimitReached.value
      || !!(state.pending || state.opening || state.uploading)
  })

  const showErrorTooltip = computed(() => !!(browser.value.error || browser.value.warning))

  function showTrialEndedModal() {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(TrialEnded, { onClose: hideModal }),
      },
    })
  }

  /** 云浏览器前端通过 URL language 参数决定文案语言 */
  function getLocalizedConnectUrl(connectUrl: string) {
    try {
      const localizedConnectUrl = new URL(connectUrl)
      localizedConnectUrl.searchParams.set('language', simpleLocale.currentLocale || 'en')
      return localizedConnectUrl.toString()
    }
    catch {
      return connectUrl
    }
  }

  /** @returns true 表示云浏览器路径已处理，false 表示应走 Electron emit */
  async function tryOpenCloudBrowser(): Promise<boolean> {
    if (globalThis.isElectron || !isDev)
      return false

    const data = unref(options.data)
    const openMessage = unref(options.openMessage)
    const cloudBrowserDirId = userConfig.value.cloudBrowserActivateInfo?.dirId
    const remainingUsageMs = userConfig.value.cloudBrowserActivateInfo?.remainingUsageMs || 0

    if (!cloudBrowserDirId || cloudBrowserDirId !== data.dirId)
      return false

    if (remainingUsageMs <= 3000) {
      showTrialEndedModal()
      return true
    }

    if (windowManager.winMap.value.get(cloudBrowserDirId)) {
      windowManager.open('', data.dirId!)
      return true
    }

    setProfileOpenMessage(openMessage, data.dirId!, createOpeningMessage(data.dirId!))

    const { code, data: cloudData, msg } = await API.window.userGetCloudBrowserInfoList({ windowId: data.id! })

    if (code === 0 && cloudData.connectUrl) {
      windowManager.open(getLocalizedConnectUrl(cloudData.connectUrl), data.dirId!)
      setProfileOpenMessage(openMessage, data.dirId!, createOpenSuccessMessage(data.dirId!))
      options.driverNext?.()
      options.sendFirstOpenRecord?.()
      return true
    }

    if (code === 467) {
      showTrialEndedModal()
      return true
    }

    onlyErrorToast(-1, msg)
    return true
  }

  async function openBrowser() {
    if (isButtonDisabled.value)
      return

    if (unref(options.driverObj))
      options.driverNext?.()

    if (await tryOpenCloudBrowser())
      return

    options.onOpen(unref(options.data))
  }

  return {
    browser,
    coreInfo,
    isOpenLimitReached,
    isCrossModeExpired,
    crossModeExpiredTip,
    isButtonDisabled,
    usePeoples,
    showErrorTooltip,
    openBrowser,
  }
}
