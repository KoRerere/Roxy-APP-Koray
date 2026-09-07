import type {
  AutomationControlSurface,
  AutomationControlSurfaceAcquireInput,
  BrowserAutomationControlState,
} from './automationControlManager'
import type { AutomationBrowser } from './extensionBridge'
import { browserManager } from '/@/modules/browser/browser-manager'
import { automationControlExtensionBridge } from './extensionBridge'

export class TabGroupAutomationSurface implements AutomationControlSurface {
  async acquire(input: AutomationControlSurfaceAcquireInput): Promise<{ overlayVisible: false }> {
    const browserItem = await browserManager.getOpenedBrowser(input.dirId)
    if (!browserItem) {
      throw new Error(`browser window is not open: ${input.dirId}`)
    }
    if (browserItem.isFirefox) {
      throw new Error('browser automation control is not supported for Firefox')
    }
    const browser = browserItem.getBrowser()
    if (!browser) {
      throw new Error(`browser CDP connection is unavailable: ${input.dirId}`)
    }
    const automationBrowser = browser as unknown as AutomationBrowser

    try {
      await automationControlExtensionBridge.request(input.dirId, automationBrowser, input.targetId ? 'sync' : 'acquire', {
        executionId: input.executionId,
        label: input.label,
        ...(input.targetId ? { targetId: input.targetId } : {}),
      })
      return { overlayVisible: false }
    }
    catch (error) {
      if (input.previous) {
        await automationControlExtensionBridge.request(
          input.dirId,
          automationBrowser,
          input.previous.targetId ? 'sync' : 'acquire',
          {
            executionId: input.previous.executionId,
            label: input.previous.label,
            ...(input.previous.targetId ? { targetId: input.previous.targetId } : {}),
          },
        ).catch(() => {})
      }
      throw error
    }
  }

  async release(state: BrowserAutomationControlState): Promise<void> {
    const browserItem = await browserManager.getOpenedBrowser(state.dirId)
    const browser = browserItem?.getBrowser()
    if (!browser) {
      return
    }
    await automationControlExtensionBridge
      .request(state.dirId, browser as unknown as AutomationBrowser, 'release', {
        executionId: state.executionId,
      })
      .catch((error) => {
        console.warn(`[automation-control] Failed to release tab group for ${state.dirId}:`, error)
      })
  }

  async dispose(dirId: string): Promise<void> {
    automationControlExtensionBridge.unregisterProfile(dirId)
  }
}
