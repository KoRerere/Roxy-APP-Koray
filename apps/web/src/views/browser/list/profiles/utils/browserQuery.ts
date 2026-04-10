export interface BrowserOpenQueryPayload {
  openBrowser?: boolean
  windowId?: number
}

/** 安全解析路由上的 browser 查询（用于自动打开窗口） */
export function parseBrowserOpenQuery(raw: unknown): BrowserOpenQueryPayload | null {
  if (raw == null || raw === '')
    return null
  const str = typeof raw === 'string' ? raw : String(raw)
  try {
    return JSON.parse(str) as BrowserOpenQueryPayload
  }
  catch {
    return null
  }
}
