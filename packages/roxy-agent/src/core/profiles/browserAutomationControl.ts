import { getRoxyBrowserClient } from '@/core/roxyBrowserClient'

async function requestBrowserAutomationControl(
  action: 'acquire' | 'sync' | 'release',
  payload: { dirId: string, executionId: string, label?: string, targetId?: string },
): Promise<boolean> {
  try {
    // TODO: Use typed SDK methods once automation control is added to @roxybrowser/openapi.
    const result = await getRoxyBrowserClient().api.transport.request({
      method: 'POST',
      path: `/browser/automation/${action}`,
      params: payload,
    })
    if (result.code !== 0) {
      throw new Error(result.msg || `browser automation ${action} failed`)
    }
    return true
  }
  catch (error) {
    // Electron and roxy-agent are released independently. Older desktop builds
    // may not expose these endpoints, so automation must continue without UI state.
    console.warn(
      `[automation-control] Ignored ${action} failure for ${payload.dirId}:`,
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

export function acquireBrowserAutomationControl(dirId: string, executionId: string): Promise<boolean> {
  return requestBrowserAutomationControl('acquire', { dirId, executionId, label: 'AI' })
}

export function syncBrowserAutomationControl(
  dirId: string,
  executionId: string,
  targetId: string,
): Promise<boolean> {
  return requestBrowserAutomationControl('sync', { dirId, executionId, targetId, label: 'AI' })
}

export function releaseBrowserAutomationControl(dirId: string, executionId: string): Promise<boolean> {
  return requestBrowserAutomationControl('release', { dirId, executionId })
}
