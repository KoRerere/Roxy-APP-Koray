function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function normalizeQueryValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value == null) {
    return ''
  }

  return String(value)
}

function appendQueryParam(searchParams: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined) {
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return
    }

    if (value.every(item => item == null || item instanceof Date || !isPlainObject(item))) {
      searchParams.append(key, value.map(normalizeQueryValue).join(','))
      return
    }

    value.forEach((item, index) => {
      appendQueryParam(searchParams, `${key}[${index}]`, item)
    })
    return
  }

  if (isPlainObject(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendQueryParam(searchParams, `${key}[${childKey}]`, childValue)
    })
    return
  }

  searchParams.append(key, normalizeQueryValue(value))
}

// Keep query serialization browser-native so Vite 8 does not pull Node-only
/**
 * helpers from qs into the shared renderer vendor chunk.
 */
export function serializeRequestParams(params: unknown): string {
  if (!isPlainObject(params)) {
    return ''
  }

  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    appendQueryParam(searchParams, key, value)
  })

  return searchParams.toString()
}
