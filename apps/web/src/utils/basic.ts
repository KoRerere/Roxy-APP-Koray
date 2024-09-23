function getRawType(data: any) {
  return Object.prototype.toString.call(data).slice(8, -1).toLowerCase()
}

export function isObject(data: any) {
  return getRawType(data) === 'object'
}

export function isFunction(fn: any) {
  return getRawType(fn) === 'function'
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

export function setRowsLoading(row: any, operateName: string, fn: (row: any) => Promise<any>) {
  (row.loadingOperationMap || (row.loadingOperationMap = {}))[operateName] = true
  return fn(row).then((data: any) => {
    row.loadingOperationMap[operateName] = false
    return data
  })
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

export function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    // console.log('Copied to clipboard:', text)
  })
}
