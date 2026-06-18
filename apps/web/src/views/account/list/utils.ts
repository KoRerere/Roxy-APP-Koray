export function parseWindowInfo(windowInfo: unknown): number[] {
  if (!windowInfo)
    return []
  if (Array.isArray(windowInfo))
    return windowInfo.map(Number).filter(Boolean)
  try {
    const parsed = JSON.parse(String(windowInfo))
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : []
  }
  catch {
    return []
  }
}

export function maskPassword(value?: string, visible = false) {
  if (!value)
    return '--'
  return visible ? value : '••••••••'
}

export function formatAccountCopyText(data: Record<string, any>, includePassword = true) {
  const parts = [data.platformUrl, data.platformUserName]
  if (includePassword && data.platformPassword)
    parts.push(data.platformPassword)
  if (data.platformEfa)
    parts.push(data.platformEfa)
  return parts.filter(Boolean).join(':')
}
