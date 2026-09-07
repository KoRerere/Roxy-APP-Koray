import { browserManager } from '/@/modules/browser/browser-manager'
import { BrowserAutomationControlManager } from './automationControlManager'
import { TabGroupAutomationSurface } from './tabGroupAutomationSurface'

const surface = new TabGroupAutomationSurface()

export const browserAutomationControlManager = new BrowserAutomationControlManager({
  isBrowserOpen: async (dirId) => Boolean(await browserManager.getOpenedBrowser(dirId)),
  surface,
})

export * from './automationControlManager'
