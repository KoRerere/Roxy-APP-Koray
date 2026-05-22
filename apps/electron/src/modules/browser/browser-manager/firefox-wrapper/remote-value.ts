/** 将 WebDriver BiDi RemoteValue 反序列化为 JS 值 */
export function deserializeRemoteValue(value: unknown): unknown {
  if (!value || typeof value !== 'object')
    return value

  const remote = value as { type?: string, value?: unknown }
  switch (remote.type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'bigint':
      return remote.value
    case 'null':
      return null
    case 'undefined':
      return undefined
    case 'array':
      return Array.isArray(remote.value)
        ? remote.value.map(deserializeRemoteValue)
        : []
    case 'object':
      if (Array.isArray(remote.value)) {
        return Object.fromEntries(
          remote.value.map(([key, val]: [string, unknown]) => [key, deserializeRemoteValue(val)]),
        )
      }
      return {}
    default:
      return value
  }
}
