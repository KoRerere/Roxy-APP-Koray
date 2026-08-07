import type { ResolvedTaskWindow } from './types'
import { env } from '@/config'

interface RoxyApiResponse {
  code: number
  msg?: string
}

export async function closeTaskBrowserWindow(dirId: string): Promise<void> {
  if (!env.ROXY_API_HOST) {
    throw new Error('ROXY_API_HOST is not configured')
  }
  if (!env.ROXY_API_KEY) {
    throw new Error('ROXY_API_KEY is not configured')
  }

  const response = await fetch(`${env.ROXY_API_HOST}/browser/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': env.ROXY_API_KEY,
    },
    body: JSON.stringify({ dirId }),
  })

  if (!response.ok) {
    throw new Error(`Browser close request failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json() as RoxyApiResponse
  if (result.code !== 0) {
    throw new Error(result.msg || 'Failed to close browser')
  }
}

export async function closeTaskBrowserWindows(
  windows: ResolvedTaskWindow[],
): Promise<string[]> {
  const dirIds = Array.from(new Set(windows.map(window => window.dirId)))
  const results = await Promise.allSettled(dirIds.map(dirId =>
    closeTaskBrowserWindow(dirId)))

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`[task] Failed to close browser window dirId=${dirIds[index]}:`, result.reason)
    }
  })

  return dirIds.filter((_, index) => results[index]?.status === 'fulfilled')
}
