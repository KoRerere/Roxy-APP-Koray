import type {
  ProfileBrowserType,
  ProfileConnection,
  ProfileConnectionSource,
  ProfileProtocol,
} from './profileRuntimeManager'
import type { ProfileConnectionInfo, RoxyBrowserClient } from '@roxybrowser/openapi'
import { getRoxyBrowserClient } from '@/core/roxyBrowserClient'

export class RoxyProfileConnectionSource implements ProfileConnectionSource {
  private readonly client: RoxyBrowserClient

  constructor(client?: RoxyBrowserClient) {
    this.client = client ?? getRoxyBrowserClient()
  }

  async get(dirId: string, browserType?: ProfileBrowserType): Promise<ProfileConnection | undefined> {
    const rows = await this.client.profiles.connectionInfo([dirId])
    const row = rows.find(item => String(item.dirId) === String(dirId))
    return row ? normalizeConnection(row, browserType) : undefined
  }

  async list(): Promise<ProfileConnection[]> {
    const rows = await this.client.profiles.connectionInfo()
    return rows.map(row => normalizeConnection(row)).filter((item): item is ProfileConnection => Boolean(item))
  }

  async open(dirId: string, browserType?: ProfileBrowserType): Promise<ProfileConnection> {
    await this.client.profiles.open(dirId, { forceOpen: false })
    for (let attempt = 0; attempt < 5; attempt++) {
      const connection = await this.get(dirId, browserType)
      if (connection) {
        return connection
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    throw new Error(`浏览器 ${dirId} 打开后未提供可用的自动化连接。`)
  }
}

function normalizeConnection(
  row: ProfileConnectionInfo,
  requestedBrowserType?: ProfileBrowserType,
): ProfileConnection | undefined {
  const ws = typeof row.ws === 'string' ? row.ws.trim() : ''
  const http = typeof row.http === 'string' ? row.http.trim() : ''
  const inferredFirefox = requestedBrowserType === 'firefox'
    || Boolean(ws && !ws.includes('/devtools/browser/'))
  const browserType: ProfileBrowserType = inferredFirefox ? 'firefox' : 'chromium'
  const protocol: ProfileProtocol = inferredFirefox ? 'bidi' : 'cdp'
  const endpoint = ws || http
  if (!endpoint || !row.dirId) {
    return undefined
  }
  return {
    dirId: String(row.dirId),
    endpoint,
    protocol,
    browserType,
    connectedAt: Date.now(),
    ...(Number.isFinite(row.pid) ? { pid: row.pid } : {}),
    ...(row.windowName ? { windowName: row.windowName } : {}),
    ...(Number.isFinite(row.sortNum) ? { windowSortNum: row.sortNum } : {}),
  }
}
