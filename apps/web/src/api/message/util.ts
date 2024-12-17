export function parseHeaderParams(headerValue: string) {
  const params: Recordable = {}
  // 将参数按分号分隔，遍历并解析每个键值对
  headerValue.split(';').forEach((part) => {
    const [key, value] = part.split('=').map(str => str.trim())
    if (key && value) {
      params[key] = value.replace(/^"|"$/g, '') // 移除引号（如果有）
    }
  })
  return params
}
