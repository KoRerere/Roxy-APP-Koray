import { RoxyBrowserClient } from '@roxybrowser/openapi'
import { env } from '@/config'

let client: RoxyBrowserClient | undefined

export function getRoxyBrowserClient(): RoxyBrowserClient {
  return client ??= new RoxyBrowserClient({
    baseUrl: env.ROXY_API_HOST,
    apiKey: env.ROXY_API_KEY,
    workspaceId: env.ROXY_WORKSPACE_ID ? Number(env.ROXY_WORKSPACE_ID) : undefined,
  })
}
