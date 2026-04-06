import type { IPCMainInstance } from '/@/modules/ipc/types'
import { globalShortcut } from 'electron'
import { closeMcpWindow, createMcpWindow, mcpManager } from '/@/modules/mcp'
import { mcpRuntimeState } from '/@/modules/mcp/state'

export function closeSyncControl() {
  globalShortcut.unregisterAll()
}

/** MCP 相关 */
export function setupMcpIpc(ipcMain: IPCMainInstance) {
  /** 获取 MCP 状态 */
  ipcMain.on('mcp:getStatus', async (_event) => {
    return {
      mcpWindowOpen: mcpRuntimeState.getMcpWindowOpen(),
      roxyClawEnabled: mcpRuntimeState.getRoxyClawEnabled(),
      mcpServerRunning: mcpManager.isWorkerConnected(),
    }
  })

  /** 打开mcp */
  ipcMain.on('mcp:open', async (_event) => {
    console.log('Opening MCP')

    // 检查 RoxyClaw 是否正在运行
    if (mcpRuntimeState.getRoxyClawEnabled()) {
      throw new Error('RoxyClaw is already running. Please stop RoxyClaw first.')
    }

    await mcpManager.startMcpServer()
    await createMcpWindow()
    mcpRuntimeState.setMcpWindowOpen(true)
  })

  /** 获取mcp配置 */
  ipcMain.on('mcp:config', async (_event) => {
    return mcpManager.config
  })

  /** 关闭mcp */
  ipcMain.on('mcp:close', async (_event) => {
    mcpManager.closeMcpServer()
    await closeMcpWindow()
    mcpRuntimeState.setMcpWindowOpen(false)
  })

  /** 启动 RoxyClaw */
  ipcMain.on('mcp:startRoxyClaw', async (_event) => {
    try {
      console.log('Starting RoxyClaw...')

      // 检查 MCP 窗口是否正在运行
      if (mcpRuntimeState.getMcpWindowOpen()) {
        throw new Error('MCP window is already open. Please close MCP window first.')
      }

      await mcpManager.startMcpServer()
      mcpRuntimeState.setRoxyClawEnabled(true)
      return { success: true, message: 'RoxyClaw started successfully' }
    }
    catch (error) {
      console.error('Failed to start RoxyClaw:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Failed to start RoxyClaw' }
    }
  })

  /** 停止 RoxyClaw */
  ipcMain.on('mcp:stopRoxyClaw', async (_event) => {
    try {
      console.log('Stopping RoxyClaw...')
      mcpManager.closeMcpServer()
      mcpRuntimeState.setRoxyClawEnabled(false)
      return { success: true, message: 'RoxyClaw stopped successfully' }
    }
    catch (error) {
      console.error('Failed to stop RoxyClaw:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Failed to stop RoxyClaw' }
    }
  })

  /** 获取 RoxyClaw 状态 */
  ipcMain.on('mcp:roxyClawStatus', async (_event) => {
    return {
      enabled: mcpRuntimeState.getRoxyClawEnabled(),
      connected: mcpManager.isWorkerConnected(),
    }
  })
}
