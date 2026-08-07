import { windowManager } from '/@/utils/windowManager'

export async function getAgentOpenedWindowIds() {
  if (!globalThis.isElectron) {
    return new Set(
      [...windowManager.winMap.value.entries()]
        .filter(([, win]) => win && !win.closed)
        .map(([dirId]) => String(dirId)),
    )
  }

  try {
    const openedWindows = await globalThis.electronAPI.send('browser:getOpenedBrowser')
    return new Set(
      openedWindows
        .map(item => item.dirId)
        .filter((dirId): dirId is string => Boolean(dirId)),
    )
  }
  catch (error) {
    console.warn('[agent-console] Failed to read opened browser state', error)
    return new Set<string>()
  }
}
