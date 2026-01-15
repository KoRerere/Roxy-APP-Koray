import type { IPCMainInstance } from '../../types'
import { createAppSender } from './app'
import { createBrowserSender } from './browser'
import { createDialogSender } from './dialog'
import { createExtensionSender } from './extension'
import { createInviteSender } from './invite'
import { createOauth2Sender } from './oauth2'
import { createOpenSender } from './open'
import { createSyncControlSender } from './syncControl'
import { createUserSender } from './user'
import { createWindowSender } from './window'

export function createSenderModules(ipcMain: IPCMainInstance) {
  return {
    app: createAppSender(ipcMain),
    browser: createBrowserSender(ipcMain),
    dialog: createDialogSender(ipcMain),
    extension: createExtensionSender(ipcMain),
    invite: createInviteSender(ipcMain),
    oauth2: createOauth2Sender(ipcMain),
    open: createOpenSender(ipcMain),
    syncControl: createSyncControlSender(ipcMain),
    user: createUserSender(ipcMain),
    window: createWindowSender(ipcMain),
  } as const
}

export * from './app'
export * from './browser'
export * from './dialog'
export * from './extension'
export * from './invite'
export * from './oauth2'
export * from './open'
export * from './syncControl'
export * from './user'
export * from './window'
