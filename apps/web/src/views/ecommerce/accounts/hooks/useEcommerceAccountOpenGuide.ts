import type { Driver } from 'driver.js'
import { blurDomSpotlight, focusDomSpotlight } from '/@/hooks/useDomSpotlight'
import { genDriver, sleep, whenPageLoadingHidden } from '/@/utils'
import { emitter } from '/@/utils/eventBus'

const GUIDE_TARGET_SELECTOR = '#OPEN_0'
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
      console.warn('[EcommerceAccountOpenGuide] guide target wait timed out:', selector)
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

/** 等待 layout 稳定后再启动 driver，降低虚拟列表首帧偏移风险 */
async function waitForLayoutStable() {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** 虚拟列表行在 scrollIntoView 后仍可能位移，额外等待并重算目标位置 */
async function prepareGuideTarget(el: HTMLElement) {
  el.scrollIntoView({ block: 'center', inline: 'nearest' })
  await waitForLayoutStable()
  await sleep(200)
}

function highlightGuideTarget() {
  const el = document.querySelector(GUIDE_TARGET_SELECTOR) as HTMLElement | null
  el?.scrollIntoView({ block: 'center', inline: 'nearest' })
  focusDomSpotlight(GUIDE_TARGET_SELECTOR)
}

export function useEcommerceAccountOpenGuide(options: {
  onComplete?: () => void
}) {
  const driverObj = ref<Driver>()
  let guideTaskId = 0
  const activeWaits: Array<() => void> = []
  let removeGuideTargetClickListener: (() => void) | undefined

  function registerWaitCancel(cancel: () => void) {
    activeWaits.push(cancel)
  }

  function clearActiveWaits() {
    activeWaits.forEach(cancel => cancel())
    activeWaits.length = 0
  }

  /** 移除启动按钮上的引导点击监听，避免重复触发或泄漏 */
  function unbindGuideTargetClickListener() {
    removeGuideTargetClickListener?.()
    removeGuideTargetClickListener = undefined
  }

  /** 用户点击启动按钮后立即结束引导，不等待浏览器打开结果 */
  function bindGuideTargetClickListener() {
    unbindGuideTargetClickListener()

    const el = document.querySelector(GUIDE_TARGET_SELECTOR) as HTMLElement | null
    if (!el)
      return

    const onClick = () => {
      driverNext()
    }
    el.addEventListener('click', onClick, { capture: true })
    removeGuideTargetClickListener = () => {
      el.removeEventListener('click', onClick, { capture: true })
    }
  }

  /** 销毁 driver 并清理引导状态，可重复调用 */
  function driverNext() {
    const driver = driverObj.value
    if (!driver)
      return

    unbindGuideTargetClickListener()
    guideTaskId++
    clearActiveWaits()
    driverObj.value = undefined
    driver.destroy()
    emitter.emit('asideMenuGuide')
  }

  async function startGuide() {
    const taskId = ++guideTaskId
    clearActiveWaits()

    const pageReady = await whenPageLoadingHidden(registerWaitCancel)
    if (!pageReady || taskId !== guideTaskId)
      return

    await nextTick()

    const target = await waitForGuideTarget(GUIDE_TARGET_SELECTOR, GUIDE_WAIT_TIMEOUT_MS, registerWaitCancel)
    if (!target || taskId !== guideTaskId)
      return

    await prepareGuideTarget(target)
    if (taskId !== guideTaskId)
      return

    clearActiveWaits()

    driverObj.value = genDriver({
      showProgress: false,
      disableActiveInteraction: false,
      allowClose: true,
      overlayClickBehavior: 'close',
      showButtons: ['close'],
      stagePadding: 0,
      popoverOffset: 20,
      onDestroyed: () => {
        unbindGuideTargetClickListener()
        blurDomSpotlight()
        options.onComplete?.()
      },
      steps: [
        {
          element: GUIDE_TARGET_SELECTOR,
          popover: {
            description: $t('打开您的第一个账号'),
            side: 'right',
            align: 'center',
          },
          onHighlightStarted: () => {
            nextTick(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  void sleep(100).then(() => {
                    highlightGuideTarget()
                    bindGuideTargetClickListener()
                  })
                })
              })
            })
          },
          onDeselected: () => {
            unbindGuideTargetClickListener()
            blurDomSpotlight()
          },
        },
      ],
    })

    driverObj.value.drive()
  }

  onBeforeUnmount(() => {
    guideTaskId++
    clearActiveWaits()
    unbindGuideTargetClickListener()
    driverObj.value?.destroy()
    driverObj.value = undefined
  })

  return {
    driverObj,
    driverNext,
    startGuide,
  }
}
