import type { Driver } from 'driver.js'
import { clearEcommerceSkipCreateGuide, getEcommerceSkipCreateGuideState, setEcommerceSkipCreateGuideState } from '/@/domain/before-enter'
import { blurDomSpotlight, focusDomSpotlight } from '/@/hooks/useDomSpotlight'
import { genDriver, sleep, whenPageLoadingHidden } from '/@/utils'

const CREATE_BTN_SELECTOR = '#NEW_ACCOUNT'
const BASIC_INFO_SELECTOR = '#ecommerce-basic-info'
const BIND_DEVICE_SELECTOR = '#BIND_DEVICE_0'
const OPEN_SELECTOR = '#OPEN_0'
const GUIDE_WAIT_TIMEOUT_MS = 15_000

type WaitCancelRegistrar = (cancel: () => void) => void

function getValidGuideTarget(selector: string): HTMLElement | null {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el)
    return null

  const { width, height } = el.getBoundingClientRect()
  return width > 0 && height > 0 ? el : null
}

/** 通过 MutationObserver 等待引导目标出现，避免轮询 DOM */
function waitForGuideTarget(
  selector: string,
  timeoutMs = GUIDE_WAIT_TIMEOUT_MS,
  registerCancel?: WaitCancelRegistrar,
): Promise<HTMLElement | null> {
  const existing = getValidGuideTarget(selector)
  if (existing)
    return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout>
    let observer: MutationObserver

    const finish = (el: HTMLElement | null) => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      observer.disconnect()
      resolve(el)
    }

    registerCancel?.(() => finish(null))

    timer = setTimeout(() => {
      console.warn('[EcommerceSkipCreateGuide] guide target wait timed out:', selector)
      finish(null)
    }, timeoutMs)

    observer = new MutationObserver(() => {
      const el = getValidGuideTarget(selector)
      if (el)
        finish(el)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'style', 'class'],
    })
  })
}

async function waitForLayoutStable() {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

async function prepareGuideTarget(el: HTMLElement) {
  el.scrollIntoView({ block: 'center', inline: 'nearest' })
  await waitForLayoutStable()
  await sleep(200)
}

function highlightSelector(selector: string) {
  const el = document.querySelector(selector) as HTMLElement | null
  el?.scrollIntoView({ block: 'center', inline: 'nearest' })
  focusDomSpotlight(selector)
}

/**
 * 跳过 before-enter 后的跨页引导：
 * 创建账号按钮 → 基础信息 →（可选）绑定设备 → 启动
 */
export function useEcommerceSkipCreateGuide(options: {
  onComplete?: () => void
} = {}) {
  const driverObj = ref<Driver>()
  let guideTaskId = 0
  const activeWaits: Array<() => void> = []
  let removeTargetClickListener: (() => void) | undefined

  function registerWaitCancel(cancel: () => void) {
    activeWaits.push(cancel)
  }

  function clearActiveWaits() {
    activeWaits.forEach(cancel => cancel())
    activeWaits.length = 0
  }

  function unbindTargetClickListener() {
    removeTargetClickListener?.()
    removeTargetClickListener = undefined
  }

  function destroyDriver() {
    const driver = driverObj.value
    if (!driver)
      return
    unbindTargetClickListener()
    driverObj.value = undefined
    driver.destroy()
  }

  function cancelGuideTask() {
    guideTaskId++
    clearActiveWaits()
    destroyDriver()
    blurDomSpotlight()
  }

  function finishGuideCompletely() {
    clearEcommerceSkipCreateGuide()
    cancelGuideTask()
    options.onComplete?.()
  }

  function bindTargetClickListener(selector: string, onClick: () => void) {
    unbindTargetClickListener()
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el)
      return

    const handler = () => {
      onClick()
    }
    el.addEventListener('click', handler, { capture: true })
    removeTargetClickListener = () => {
      el.removeEventListener('click', handler, { capture: true })
    }
  }

  async function driveSingleStep(params: {
    selector: string
    description: string
    side?: 'left' | 'right' | 'top' | 'bottom'
    /** 是否叠加脉冲聚光灯；基础信息步骤仅用 Driver 自带高亮 */
    useSpotlight?: boolean
    /** Driver 高亮区相对目标的内边距 */
    stagePadding?: number
    /** 用户关闭弹层时（非点击目标推进） */
    onDismiss?: () => void
    /** 用户点击高亮目标时推进；未提供则仅允许关闭 */
    onTargetClick?: () => void
  }) {
    const taskId = ++guideTaskId
    clearActiveWaits()
    destroyDriver()

    const pageReady = await whenPageLoadingHidden(registerWaitCancel)
    if (!pageReady || taskId !== guideTaskId)
      return false

    await nextTick()

    const target = await waitForGuideTarget(params.selector, GUIDE_WAIT_TIMEOUT_MS, registerWaitCancel)
    if (!target || taskId !== guideTaskId)
      return false

    await prepareGuideTarget(target)
    if (taskId !== guideTaskId)
      return false

    clearActiveWaits()

    let advancedByClick = false
    const useSpotlight = params.useSpotlight !== false

    driverObj.value = genDriver({
      showProgress: false,
      disableActiveInteraction: false,
      allowClose: true,
      overlayClickBehavior: 'close',
      showButtons: ['close'],
      stagePadding: params.stagePadding ?? 0,
      popoverOffset: 20,
      onDestroyed: () => {
        unbindTargetClickListener()
        blurDomSpotlight()
        driverObj.value = undefined
        if (!advancedByClick)
          params.onDismiss?.()
      },
      steps: [
        {
          element: params.selector,
          popover: {
            description: params.description,
            side: params.side ?? 'right',
            align: 'center',
          },
          onHighlightStarted: () => {
            nextTick(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  void sleep(100).then(() => {
                    if (taskId !== guideTaskId)
                      return
                    if (useSpotlight)
                      highlightSelector(params.selector)
                    // 允许点击高亮区内交互，并在点击后推进/关闭
                    if (params.onTargetClick) {
                      bindTargetClickListener(params.selector, () => {
                        advancedByClick = true
                        params.onTargetClick?.()
                      })
                    }
                  })
                })
              })
            })
          },
          onDeselected: () => {
            unbindTargetClickListener()
            blurDomSpotlight()
          },
        },
      ],
    })

    driverObj.value.drive()
    return true
  }

  /** 列表页：聚焦右上「创建账号」 */
  async function startCreateBtnGuide() {
    const state = getEcommerceSkipCreateGuideState()
    if (state?.phase !== 'create_btn')
      return

    await driveSingleStep({
      selector: CREATE_BTN_SELECTOR,
      description: $t('点击「创建账号」开始创建您的电商账号'),
      side: 'right',
      useSpotlight: false,
      stagePadding: 8,
      onDismiss: () => {
        // 用户主动关闭则终止整段跳过引导
        clearEcommerceSkipCreateGuide()
      },
      onTargetClick: () => {
        setEcommerceSkipCreateGuideState({ phase: 'basic_info' })
        destroyDriver()
        blurDomSpotlight()
      },
    })
  }

  /** 创建页：聚焦基础信息表单（仅 Driver 高亮，点击区内内容后关闭） */
  async function startBasicInfoGuide() {
    const state = getEcommerceSkipCreateGuideState()
    if (state?.phase !== 'basic_info')
      return

    await driveSingleStep({
      selector: BASIC_INFO_SELECTOR,
      description: $t('填写电商账号基础信息，完成账号创建'),
      side: 'bottom',
      useSpotlight: false,
      /**
       * 关闭后仍保留 phase，等待创建成功进入后续步骤
       */
      onDismiss: () => { },
      onTargetClick: () => {
        destroyDriver()
      },
    })
  }

  /** 创建成功后写入 post_create，并记录是否已在表单内绑定设备 */
  function markPostCreateGuide(skipBind: boolean) {
    const state = getEcommerceSkipCreateGuideState()
    if (!state)
      return
    setEcommerceSkipCreateGuideState({
      phase: 'post_create',
      skipBind,
    })
  }

  /** 列表页：创建成功后聚焦绑定设备；点击绑定后等成功再聚焦启动 */
  async function startPostCreateGuide() {
    const state = getEcommerceSkipCreateGuideState()
    if (state?.phase !== 'post_create')
      return

    const skipBind = state.skipBind === true

    if (!skipBind) {
      const bindStarted = await driveSingleStep({
        selector: BIND_DEVICE_SELECTOR,
        description: $t('为账号绑定设备后即可启动'),
        side: 'bottom',
        onDismiss: () => {
          // 关闭且未完成绑定：不进入启动引导
          clearEcommerceSkipCreateGuide()
        },
        onTargetClick: () => {
          // 点击绑定后收起聚焦，等绑定成功再进入步骤四
          setEcommerceSkipCreateGuideState({ phase: 'awaiting_bind' })
          destroyDriver()
          blurDomSpotlight()
        },
      })

      // 目标不存在（列表侧已绑定）则直接启动
      if (!bindStarted && getEcommerceSkipCreateGuideState()?.phase === 'post_create')
        await startOpenGuide()
      return
    }

    await startOpenGuide()
  }

  async function startOpenGuide() {
    const state = getEcommerceSkipCreateGuideState()
    if (!state)
      return
    if (state.phase !== 'post_create' && state.phase !== 'awaiting_bind' && state.phase !== 'open')
      return

    setEcommerceSkipCreateGuideState({
      ...state,
      phase: 'open',
    })

    await driveSingleStep({
      selector: OPEN_SELECTOR,
      description: $t('打开您的第一个账号'),
      side: 'right',
      onDismiss: () => {
        finishGuideCompletely()
      },
      onTargetClick: () => {
        finishGuideCompletely()
      },
    })
  }

  /** 列表绑定设备成功后：仅在等待绑定成功时推进到启动引导 */
  function notifyDeviceBindSuccess() {
    const state = getEcommerceSkipCreateGuideState()
    if (state?.phase !== 'awaiting_bind')
      return
    void startOpenGuide()
  }

  /** 账号列表按当前 phase 启动对应步骤 */
  async function tryStartListGuide() {
    const state = getEcommerceSkipCreateGuideState()
    if (!state)
      return

    if (state.phase === 'create_btn')
      await startCreateBtnGuide()
    else if (state.phase === 'post_create')
      await startPostCreateGuide()
    else if (state.phase === 'open')
      await startOpenGuide()
  }

  onBeforeUnmount(() => {
    cancelGuideTask()
  })

  return {
    driverObj,
    startCreateBtnGuide,
    startBasicInfoGuide,
    startPostCreateGuide,
    markPostCreateGuide,
    notifyDeviceBindSuccess,
    tryStartListGuide,
    finishGuideCompletely,
    cancelGuideTask,
  }
}
