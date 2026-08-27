import currency from 'currency.js'
import { driver } from 'driver.js'
import type { Config } from 'driver.js'
import type { SvgNames } from '/@/components/rx-icon'

export function getRawType(data: any) {
  return Object.prototype.toString.call(data).slice(8, -1).toLowerCase()
}

export function isObject(data: any) {
  return getRawType(data) === 'object'
}

export function isFunction(fn: any) {
  return getRawType(fn) === 'function'
}

export function isAsyncFunction(fn: any) {
  return getRawType(fn) === 'asyncfunction'
}

export function isLikeFunction(fn: any) {
  return ['function', 'asyncfunction'].includes(getRawType(fn))
}

export function hasOwnProperty(data: any, key: any) {
  return Object.hasOwn(data, key)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface GenPollingCheckerOptions<TArgs extends readonly unknown[]> {
  /** 轮询间隔（毫秒），默认 3000 */
  intervalMs?: number
  /** 单次检查：`true` 表示达成目标并结束轮询；抛错则中断并由调用方处理 */
  checkOnce: (...args: TArgs) => Promise<boolean>
}

/**
 * 可取消、可覆盖任务的轮询检查器（新 `check` 会顶替仍在进行的旧任务）。
 * `check` / `checkOnce` 参数列表与 `checkOnce` 定义一致（任意个数、类型由调用方推断）。
 */
export function genPollingChecker<TArgs extends readonly unknown[]>(
  options: GenPollingCheckerOptions<TArgs>,
) {
  const { intervalMs = 3000, checkOnce } = options
  let stopped = false
  let currentTaskId = 0

  function stop() {
    stopped = true
    currentTaskId++
  }

  /** 轮询直到 `checkOnce` 返回 `true`，或 `stop()` / 被新任务覆盖 */
  async function check(...args: TArgs) {
    stopped = false
    const taskId = ++currentTaskId
    const shouldEnd = () => stopped || taskId !== currentTaskId

    while (!stopped && taskId === currentTaskId) {
      const isOk = await checkOnce(...args)

      if (isOk) {
        stop()
        return isOk
      }

      if (shouldEnd())
        return

      await sleepInterruptibleForPolling(intervalMs, shouldEnd)

      if (taskId !== currentTaskId)
        return
    }
  }

  return {
    checkOnce,
    check,
    stop,
  }
}

/** 在 `shouldEnd` 为真时立即结束，否则最长等待 `ms`（用于轮询间隔可被 `stop` / 新任务顶替中断） */
async function sleepInterruptibleForPolling(ms: number, shouldEnd: () => boolean): Promise<void> {
  if (ms <= 0)
    return
  const start = performance.now()

  while (!shouldEnd()) {
    const left = ms - (performance.now() - start)
    if (left <= 0)
      return
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(200, left)))
  }
}

export function isEmptyValue(value: any) {
  if (Array.isArray(value)) {
    return value.length === 0
  }
  else if (isObject(value)) {
    return Object.keys(value).length === 0
  }
  return isInvalid(value)
}

export function isInvalid(value: any) {
  return [null, undefined, ''].includes(value)
}

const REGEX_EMAIL = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\])|(([a-z\-0-9]+\.)+[a-z]{2,}))$/i
export function validateEmail(email: string) {
  return REGEX_EMAIL.test(email)
}

const REGEX_PHONE = /^(?:(?:\+|00)86)?1[3-9]\d{9}$/
export function validatePhone(phone: string) {
  return REGEX_PHONE.test(phone)
}

export function createDefaultObject<T extends string[], U>(keys: T, defaultValue: U) {
  return keys.reduce((res, key) => ({ ...res, [key]: defaultValue }), {} as { [K in T[number]]: U })
}

const images = import.meta.glob('/src/assets/images/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
})

export function getImage(path: string) {
  return images[`/src/assets/images/${path}`] as string ?? ''
}

export function deepClone<T>(source: T, hash = new WeakMap()): T {
  if (typeof source !== 'object' || source === null) {
    return source
  }
  if (source instanceof Date) {
    return new Date(source.getTime()) as any
  }
  if (hash.has(source)) {
    return hash.get(source)
  }
  const target: any = Array.isArray(source) ? [] : {}
  hash.set(source, target);
  (Reflect.ownKeys(source) as (keyof T)[]).forEach((key) => {
    target[key] = deepClone((source as any)[key], hash)
  })
  return target
}

export function getRandomIntByRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function copyText(text: string) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text)
  }
  const input = document.createElement('input')
  input.value = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

export function getUserAgentOs() {
  if ((navigator as any).userAgentData) {
    return (navigator as any).userAgentData.platform
  }
  else {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Windows'))
      return 'Windows'
    if (userAgent.includes('Mac'))
      return 'macOS'
    if (userAgent.includes('Android'))
      return 'Android'
    if (userAgent.includes('iPhone'))
      return 'iPhone'
    if (userAgent.includes('iPad'))
      return 'iPad'
    if (userAgent.includes('iPod'))
      return 'iPod'
    if (userAgent.includes('Linux'))
      return 'Linux'

    return 'Windows'
  }
}

export function strConcat(str1?: string, str2?: string) {
  if (!str1)
    return str1
  if (!str2)
    return str2
  return `${str1}${str2}`
}

const REGEX_URL = /^(https?:\/\/)/
export function validateURL(url: string): boolean {
  if (REGEX_URL.test(url)) {
    try {
      // eslint-disable-next-line no-new
      new URL(url)
      return true
    }
    catch (error) {
      return false
    }
  }
  else {
    return false
  }
}

const REGEX_PROXY_URL_1 = /^(?:(?<protocol>https?|ssh|socks5):\/\/)?(?<host>\[[^\]]+\]|[^:[\]{}@]+):(?<port>\d+)(?::(?<user>[^:[\]{}]*))?(?::(?<pass>[^:[\]{}]*))?(?:\[(?<refresh>[^\]]*)\])?(?:\{(?<remark>[^}]*)\})?$/
const REGEX_PROXY_URL_2 = /^(?:(?<protocol>https?|ssh|socks5):\/\/)?(?:(?<user>[^:@[\]{}]+):(?<pass>[^:@[\]{}]+)@(?<host>\[[^\]]+\]|[^:[\]{}@]+):(?<port>\d+)|(?<protocol2>https?|ssh|socks5):\/\/(?<host2>\[[^\]]+\]|[^:[\]{}@]+):(?<port2>\d+):(?<user2>[^:[\]{}]+):(?<pass2>[^:[\]{}]+))(?:\[(?<refresh>[^\]]*)\])?(?:\{(?<remark>[^}]*)\})?$/
// 必须跳过可选协议前缀，否则 socks5://user:pass@host:port 会被误判成 host:port 格式
const REGEX_PROXY_URL_TYPE = /^(?:(?:https?|ssh|socks5):\/\/)?[^:/\s]+:[^:/\s]+@/

export function parseProxyUrl(url: string): {
  protocol?: string | undefined
  host: string | undefined
  port: string | undefined
  proxyUserName: string | undefined
  proxyPassword: string | undefined
  refreshUrl?: string
  remark?: string
} {
  const regex = REGEX_PROXY_URL_TYPE.test(url) ? REGEX_PROXY_URL_2 : REGEX_PROXY_URL_1
  const match = url.match(regex)
  const data = match?.groups
  return {
    protocol: data?.protocol,
    host: data?.host,
    port: data?.port,
    proxyUserName: data?.user,
    proxyPassword: data?.pass,
    refreshUrl: data?.refresh,
    remark: data?.remark,
  }
}

export async function tryRefreshProxyUrl(refreshUrl?: string) {
  const url = refreshUrl?.trim()
  if (!url)
    return null

  return globalThis.electronAPI.send('proxy:refreshUrl', url)
}

const REGEX_URL_DOMAIN = /^(https?):\/\/([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)\/?/
export function parseUrl(url: string) {
  const match = url?.match(REGEX_URL_DOMAIN)
  return match && { protocol: match[1], domain: match[2] }
}

export interface ConcurrentControlOptions {
  notify?: (result: any) => void
  onProgress?: (p: { completed: number, total: number }) => void
  signal?: AbortSignal
}

function normalizeConcurrentOptions(
  third?: ((result: any) => void) | ConcurrentControlOptions,
): ConcurrentControlOptions {
  if (!third)
    return {}
  if (typeof third === 'function')
    return { notify: third }
  return third
}

export function concurrentControl(
  tasks: (() => Promise<any>)[],
  limit: number = 5,
  third?: ((result: any) => void) | ConcurrentControlOptions,
): Promise<any[]> {
  const { notify, onProgress, signal } = normalizeConcurrentOptions(third)
  let activeCount = 0
  let taskIndex = 0
  let completedCount = 0
  const total = tasks.length
  const results: any[] = []

  return new Promise((resolve) => {
    async function runTask(task: () => Promise<any>, index: number) {
      try {
        const result = await task()
        results[index] = result
      }
      catch (error) {
        results[index] = error
      }
      finally {
        activeCount--
        completedCount++
        notify?.(results[index])
        onProgress?.({ completed: completedCount, total })
        runNext()
      }
    }

    function runNext() {
      while (!signal?.aborted && activeCount < limit && taskIndex < tasks.length) {
        const currentTask = tasks[taskIndex]!
        const currentIndex = taskIndex
        taskIndex++
        activeCount++
        runTask(currentTask, currentIndex)
      }

      if (activeCount === 0 && (taskIndex === tasks.length || !!signal?.aborted)) {
        resolve(results)
      }
    }

    runNext()
  })
}

export function formatProxyTime(time: string) {
  if (!time)
    return '--'
  const now = new Date()
  const timestamp = new Date(time).getTime()
  const diff = (now.getTime() - timestamp) / 1000
  const day = Math.floor(diff / 86400)
  const hour = Math.floor(diff / 3600)
  const minute = Math.floor(diff / 60)

  if (day > 7) {
    return time.split(' ')[0]!.replace(/-/g, '/')
  }
  else if (day > 0) {
    return $t('{day}天前', { day })
  }
  else if (hour > 0) {
    return $t('{hour}小时前', { hour })
  }
  else if (minute > 0) {
    return $t('{minute}分钟前', { minute })
  }
  else {
    return $t('刚刚')
  }
}

export function getExtname(filename: string) {
  const parts = filename.split('.')

  if (parts.length <= 1 || (parts.length === 2 && parts[0] === '')) {
    return ''
  }

  return parts.pop()
}

export function safeParseJSON(data: any, fallback?: any) {
  try {
    return JSON.parse(data)
  }
  catch (error) {
    if (fallback === null)
      return null
    return fallback ?? data
  }
}

export function formatNumberToKMB(num: number, precision = 0): string {
  const formats = [
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' },
  ]

  if (num >= formats.at(-1)!.threshold) {
    for (const { threshold, suffix } of formats) {
      if (num >= threshold) {
        return `${currency(num, { symbol: '', precision }).divide(threshold).format()}${suffix}`
      }
    }
  }
  return num?.toLocaleString('en-US')
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type SortOrder = 'asc' | 'desc'
export type SortOrderNumber = 1 | -1 | 0

export function transformSortOrder(order: string): SortOrderNumber
export function transformSortOrder(order: number): SortOrder
export function transformSortOrder(order: undefined): undefined
export function transformSortOrder(order: number | string | undefined): SortOrderNumber | SortOrder | undefined {
  if (!order)
    return
  // 1 升序，-1 降序
  const map = {
    '1': 'asc',
    '-1': 'desc',
    'asc': 1,
    'desc': -1,
  } as const
  return map[order.toString() as keyof typeof map]
}

export function getSortIcon(sortOrder: SortOrderNumber) {
  const map = {
    '0': 'base/rx_ic_chevron_2',
    '-1': 'base/rx_ic_chevron_2_down',
    '1': 'base/rx_ic_chevron_2_up',
  }
  return map[sortOrder.toString() as keyof typeof map] as SvgNames
}

export interface CountdownOptions {
  /**
   * 不足 1天倒计时的间隔（分钟），默认 1 (minute)
   */
  lessThan24Interval?: number
  alwaysSecondLevel?: boolean /**
                               * 是否始终按秒级倒计时，默认 false
                               */
  /**
   * 倒计时结束回调
   */
  onEnd?: () => void
}

export function enhanceCountdown(
  endTime: number | string | Date,
  callback: (data: {
    timestamp: number
    days: number
    hours: number
    minutes: number
    seconds: number
    milliseconds: number
    done: boolean
  }) => void,
  options: CountdownOptions = {},
) {
  // 常量
  /**
   * 分钟级间隔
   */
  const minuteIntervalMs = (options.lessThan24Interval ?? 1) * 60 * 1000
  const HOUR_MS = 3600_000
  const DAY_MS = 24 * HOUR_MS

  // 倒计时结束的时间戳
  let endTimestamp = new Date(endTime).getTime()

  // 内部状态
  /**
   * setTimeout ID
   */
  let timerId: number | null = null
  /**
   * requestAnimationFrame ID
   */
  let rafId: number | null = null
  let isRafRunning = false
  let paused = false
  let ended = false
  /**
   * 暂停时保存剩余时间
   */
  let remainingOnPause: number | null = null

  /**
   * 清理所有定时器/RAF
   */
  function clearAll() {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isRafRunning = false
  }

  /**
   * 保证剩余时间不为负
   */
  function clampZero(n: number) {
    return n <= 0 ? 0 : n
  }

  /**
   * 格式化剩余时间为天/小时/分钟/秒/毫秒
   */
  function format(remaining: number) {
    const r = Math.max(0, remaining)
    const days = Math.floor(r / DAY_MS)
    const hours = Math.floor((r % DAY_MS) / HOUR_MS)
    const minutes = Math.floor((r % HOUR_MS) / 60000)
    const seconds = Math.floor((r % 60000) / 1000)
    const milliseconds = Math.floor(r % 1000)
    return { days, hours, minutes, seconds, milliseconds }
  }

  /**
   * 计算下一次触发的延迟（基于剩余时间对齐）
   */
  function nextDelayForUnit(remaining: number, unitMs: number) {
    const rem = remaining % unitMs
    return rem === 0 ? unitMs : rem
  }

  /**
   * 使用 setTimeout 安排下一次 tick
   */
  function scheduleTimeout(delayMs: number) {
    clearAll()
    timerId = window.setTimeout(() => {
      timerId = null
      tick()
    }, delayMs)
  }

  /**
   * 秒级倒计时（使用 RAF）
   */
  function startRAFCountdown() {
    if (isRafRunning)
      return
    clearAll()
    isRafRunning = true
    /**
     * 上一次触发的秒数
     */
    let lastSecond: number | null = null

    function rafTick() {
      if (paused) {
        isRafRunning = false
        rafId = null
        return
      }

      const now = Date.now()
      const remaining = endTimestamp - now

      // 倒计时结束
      if (remaining <= 0) {
        clearAll()
        if (!ended && options.onEnd) {
          ended = true
          options.onEnd()
        }
        callback({ timestamp: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, done: true })
        return
      }

      const currentSecond = Math.floor(remaining / 1000)
      // 首帧或秒数变化时触发回调
      if (lastSecond === null || currentSecond !== lastSecond) {
        lastSecond = currentSecond
        const data = format(remaining)
        callback({ timestamp: clampZero(remaining), ...data, done: false })
      }

      rafId = window.requestAnimationFrame(rafTick)
    }

    rafId = window.requestAnimationFrame(rafTick)
  }

  /**
   * 主逻辑：决定使用小时/分钟/秒级倒计时
   */
  function tick() {
    if (paused)
      return

    const now = Date.now()
    const remaining = endTimestamp - now
    console.log('remaining', remaining)

    if (remaining <= 0) {
      clearAll()
      if (!ended && options.onEnd) {
        ended = true
        options.onEnd()
      }
      callback({ timestamp: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, done: true })
      return
    }

    // 立即触发回调
    const data = format(remaining)
    callback({ timestamp: clampZero(remaining), ...data, done: false })

    if (options.alwaysSecondLevel) {
      startRAFCountdown()
      return
    }

    if (remaining > DAY_MS) {
      // 剩余 > 1天 → 小时级更新
      const delay = nextDelayForUnit(remaining, HOUR_MS)
      scheduleTimeout(delay)
      return
    }

    if (remaining > HOUR_MS) {
      // 剩余 ≤1天且 >1小时 → 分钟级更新
      const delay = nextDelayForUnit(remaining, minuteIntervalMs)
      scheduleTimeout(delay)
      return
    }

    // 剩余 ≤1小时 → 秒级更新
    startRAFCountdown()
  }

  /**
   * API：停止倒计时
   */
  function stop() {
    clearAll()
    paused = false
    remainingOnPause = null
  }

  /**
   * API：暂停倒计时
   */
  function pause() {
    if (paused)
      return
    paused = true
    const now = Date.now()
    remainingOnPause = Math.max(0, endTimestamp - now)
    clearAll()
  }

  /**
   * API：恢复倒计时
   */
  function resume() {
    if (!paused)
      return
    paused = false
    if (remainingOnPause === null) {
      tick()
      return
    }
    endTimestamp = Date.now() + remainingOnPause
    remainingOnPause = null
    tick()
  }

  // 启动倒计时
  tick()

  return {
    stop,
    pause,
    resume,
  }
}

export function genDriver(config: Config) {
  return driver({
    nextBtnText: $t('下一步'),
    doneBtnText: $t('完成'),
    showButtons: ['next'],
    overlayColor: 'var(--pattern-tour-mask-bg)',
    overlayOpacity: 1,
    allowClose: false,
    disableActiveInteraction: true,
    popoverClass: 'global_driver_class',
    ...config,
  })
}

export function getLocalStorageDriverStatus(key: string) {
  const driverStatus = safeParseJSON(localStorage.getItem('driverStatus')) ?? {}
  return driverStatus[key]
}

export function setLocalStorageDriverStatus(key: string, value: boolean) {
  const driverStatus = safeParseJSON(localStorage.getItem('driverStatus')) ?? {}
  localStorage.setItem('driverStatus', JSON.stringify({ ...driverStatus, [key]: value }))
}

export function localDiscountValue(locale: string, discount: number) {
  if (locale === 'zh-CN') {
    return currency(100).subtract(discount).divide(10).value
  }

  return discount
}

export function truncNumber2(number: number, precision: number = 2) {
  return Math.trunc(number * 10 ** precision) / 10 ** precision
}
