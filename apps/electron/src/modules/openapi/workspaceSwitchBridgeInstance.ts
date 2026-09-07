import { getMainWindow } from '/@/modules/app/mainWindow'
import { ipcSender } from '/@/modules/ipc/sender'
import { createWorkspaceSwitchBridge } from './workspaceSwitchBridge'

export const workspaceSwitchBridge = createWorkspaceSwitchBridge({
  sendRequest: payload => ipcSender.user.workspaceSelectRequested(payload),
  hasMainWindow: () => {
    const mainWindow = getMainWindow()
    return Boolean(mainWindow && !mainWindow.isDestroyed())
  },
})
