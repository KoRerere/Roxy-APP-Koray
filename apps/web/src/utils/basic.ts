import { $t } from '/@/locales'
import currency from 'currency.js'

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
  return Object.prototype.hasOwnProperty.call(data, key)
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
    }).then((handleFile: FileSystemFileHandle[]) => handleFile[0].getFile())

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

export function getRandomInt(min: number, max: number) {
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

export enum ParseMode {
  one,  // 主机:端口:账号:密码
  two,  // 账号:密码@主机:端口
}

export function parseProxyUrl(url: string, type?: IPType, mode?: ParseMode): ProxyObject {
  type = type ?? IPType.IPV4
  mode = mode ?? ParseMode.one
  if (type === IPType.IPV4) {
    if (mode === ParseMode.one) {
      return parseProxyUrlIPv4One(url)
    }
    else {
      return parseProxyUrlIPv4Two(url)
    }
  }
  else {
    if (mode === ParseMode.one) {
      return parseProxyUrlIPv6One(url)
    }
    else {
      return parseProxyUrlIPv6Two(url)
    }
  }
}

function parseProxyUrlIPv4One(url: string): ProxyObject {
  const [_, protocol, host, port, proxyUserName, proxyPassword] = url.match(/^\*?(?:(?<protocol>\w+):\/\/)?(?<host>[^:]+):(?<port>\d+)(?::(?<proxyUserName>[^:]*)(?::(?<proxyPassword>[^[{]*))?)?/) || []
  const refreshUrl = url.match(/\[(.*?)\]/)?.[1]
  const remark = url.match(/\{(.*?)\}/)?.[1]
  return {
    protocol,
    host,
    port,
    proxyUserName,
    proxyPassword,
    refreshUrl,
    remark,
  }
}

function parseProxyUrlIPv4Two(url: string): ProxyObject {
  const arr = url.match(/^(?:(?<user>[^:@]+)(?::(?<pass>[^@]*))?@)?(?<host>[^:]+):(?<port>\d+)$/) || []
  const [_, proxyUserName, proxyPassword, host, port] = arr;
  const refreshUrl = url.match(/\[(.*?)\]/)?.[1]
  const remark = url.match(/\{(.*?)\}/)?.[1]
  return {
    host,
    port,
    proxyUserName,
    proxyPassword,
    refreshUrl,
    remark,
  }
}

function parseProxyUrlIPv6One(url: string): ProxyObject {
  const regex = /^(?<host>\[[^\]]+\]|[^:\[\]\{\}@]+):(?<port>\d+)(?::(?<user>[^:]*))?(?::(?<pass>[^:\[\]\{\}]*))?(?:\[(?<refresh>[^\]]*)\])?(?:\{(?<remark>[^\}]*)\})?$/
  const match = url.match(regex)
  const data = match?.groups
  return {
    host: data?.host,
    port: data?.port,
    proxyUserName: data?.user,
    proxyPassword: data?.pass,
    refreshUrl: data?.refresh,
    remark: data?.remark,
  }
}

function parseProxyUrlIPv6Two(url: string): ProxyObject {
  const regex = /^(?<user>[^:@\[\]\{\}]+):(?<pass>[^:@\[\]\{\}]+)@(?<host>\[[^\]]+\]|[^:\[\]\{\}@]+):(?<port>\d+)(?:\[(?<refresh>[^\]]*)\])?(?:\{(?<remark>[^\}]*)\})?$/

  const match = url.match(regex)
  const data = match?.groups
  return {
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
        const currentTask = tasks[taskIndex]
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
  const now = new Date()
  const timestamp = new Date(time).getTime()
  const diff = (now.getTime() - timestamp) / 1000
  const day = Math.floor(diff / 86400)
  const hour = Math.floor(diff / 3600)
  const minute = Math.floor(diff / 60)

  if (day > 7) {
    return time.split(' ')[0].replace(/-/g, '/')
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
  const parts = filename.split('.');

  if (parts.length <= 1 || (parts.length === 2 && parts[0] === '')) {
    return '';
  }

  return parts.pop();
}

export function startCountdown(
  endTime: number | string | Date,
  callback: (time: { timestamp: number, hours: number, minutes: number, seconds: number, done: boolean }) => void
) {
  const endTimestamp = new Date(endTime).getTime()
  let remainingTime = endTimestamp - Date.now();
  let timer: number | null = null

  function updateCountdown(): void {
    if (remainingTime <= 0) {
      callback({ timestamp: 0, hours: 0, minutes: 0, seconds: 0, done: true });
      return;
    }
    const hours = Math.floor(remainingTime / (1000 * 60 * 60));
    const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);
    callback({ timestamp: remainingTime, hours, minutes, seconds, done: false });

    remainingTime = endTimestamp - Date.now();
    requestAnimationFrame(updateCountdown);
  }

  function stop() {
    timer && cancelAnimationFrame(timer)
  }

  updateCountdown();
  return stop
}

export function safeParseJSON(data: any, fallback?: any) {
  try {
    return JSON.parse(data)
  }
  catch (error) {
    return fallback ?? data
  }
}

export function formatNumberToKMB(num: number, precision = 0): string {
  const formats = [
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' },
  ]

  if (num >= formats[formats.length - 1].threshold) {
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