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

export function validateEmail(email: string) {
  const regex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\])|(([a-z\-0-9]+\.)+[a-z]{2,}))$/i
  return regex.test(email)
}

export function validatePhone(phone: string) {
  const regex = /^(?:(?:\+|00)86)?1[3-9]\d{9}$/
  return regex.test(phone)
}

export function createDefaultObject<T extends string[], U>(keys: T, defaultValue: U) {
  return keys.reduce((res, key) => ({ ...res, [key]: defaultValue }), {} as { [K in T[number]]: U })
}

export function getImage(path: string) {
  return new URL(`../assets/images/${path}`, import.meta.url).href
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

export function checkCookieFormat(cookie: string): boolean {
  try {
    if (cookie && typeof cookie === 'string') {
      if (!Array.isArray(JSON.parse(cookie))) {
        return false
      }
    }
  }
  catch (error) {
    return false
  }
  return true
}

export async function readCookiesFile(): Promise<any> {
  try {
    const file = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'cookies Files',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    }).then((handleFile: FileSystemFileHandle[]) => handleFile[0]!.getFile())

    const reader = new FileReader()
    reader.readAsText(file)
    return new Promise((resolve) => {
      reader.onload = function fileReadCompleted() {
        const isOk = reader.result && checkCookieFormat(reader.result as string)
        resolve({
          code: isOk ? 0 : -1,
          data: isOk ? reader.result : null,
          message: isOk ? $t('导入成功') : $t('导入 Cookie 格式错误，请检查格式'),
        })
      }
    })
  }
  catch (error) {
    console.log(error)
  }
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

export function validateURL(url: string): boolean {
  const regex = /^(https?:\/\/)/
  if (regex.test(url)) {
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

interface ProxyObject {
  protocol?: string | undefined
  host: string | undefined
  port: string | undefined
  proxyUserName: string | undefined
  proxyPassword: string | undefined
  refreshUrl?: string
  remark?: string
}

export enum IPType {
  IPV4 = 'IPV4',
  IPV6 = 'IPV6',
}

export function parseProxyUrl(url: string): ProxyObject {
  const regex1 = /^(?:(?<protocol>https?|ssh|socks5):\/\/)?(?<host>\[[^\]]+\]|[^:[\]{}@]+):(?<port>\d+)(?::(?<user>[^:[\]{}]*))?(?::(?<pass>[^:[\]{}]*))?(?:\[(?<refresh>[^\]]*)\])?(?:\{(?<remark>[^}]*)\})?$/
  const regex2 = /^(?:(?<protocol>https?|ssh|socks5):\/\/)?(?:(?<user>[^:@[\]{}]+):(?<pass>[^:@[\]{}]+)@(?<host>\[[^\]]+\]|[^:[\]{}@]+):(?<port>\d+)|(?<protocol2>https?|ssh|socks5):\/\/(?<host2>\[[^\]]+\]|[^:[\]{}@]+):(?<port2>\d+):(?<user2>[^:[\]{}]+):(?<pass2>[^:[\]{}]+))(?:\[(?<refresh>[^\]]*)\])?(?:\{(?<remark>[^}]*)\})?$/
  const regex = /^[^:/\s]+:[^:/\s]+@/.test(url) ? regex2 : regex1
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

export function parseUrl(url: string) {
  const match = url?.match(/^(https?):\/\/([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)\/?/)
  return match && { protocol: match[1], domain: match[2] }
}

export function concurrentControl(tasks: (() => Promise<any>)[], limit: number = 5, notify?: (result: any) => void): Promise<any[]> {
  let activeCount = 0
  let taskIndex = 0
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
        notify?.(results[index])
        runNext()
      }
    }

    function runNext() {
      while (activeCount < limit && taskIndex < tasks.length) {
        const currentTask = tasks[taskIndex]!
        const currentIndex = taskIndex
        taskIndex++
        activeCount++
        runTask(currentTask, currentIndex)
      }

      if (taskIndex === tasks.length && activeCount === 0) {
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

export function localDiscountValue(locale: string, discount: number) {
  if (locale === 'zh-CN') {
    return currency(100).subtract(discount).divide(10).value
  }

  return discount
}
