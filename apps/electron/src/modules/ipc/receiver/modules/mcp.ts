import type { IPCMainInstance } from '/@/modules/ipc/types'
import { globalShortcut } from 'electron'
import { closeMcpWindow, createMcpWindow, mcpManager } from '/@/modules/mcp'

export function closeSyncControl() {
  globalShortcut.unregisterAll()
}

/** MCP 相关 */
export function setupMcpIpc(ipcMain: IPCMainInstance) {
  /** 打开mcp */
  ipcMain.on('mcp:open', async (event) => {
    console.log('Opening MCP')
    await mcpManager.startMcpServer()
    await createMcpWindow()
  })

  /** 获取mcp配置 */
  ipcMain.on('mcp:config', (event) => {
    return mcpManager.config
  })

  /** 关闭mcp */
  ipcMain.on('mcp:close', async (event) => {
    mcpManager.closeMcpServer()
    await closeMcpWindow()
  })
}
