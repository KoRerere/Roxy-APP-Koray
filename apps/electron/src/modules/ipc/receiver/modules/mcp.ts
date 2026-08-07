import type { McpFailureType } from '@roxy/electron-preload'
import type { IPCMainInstance } from '/@/modules/ipc/types'
import { globalShortcut } from 'electron'
import { closeMcpWindow, createMcpWindow, getMcpWindow, mcpManager, restartMcpForAgentUpdate } from '/@/modules/mcp'
import { isMcpError } from '/@/modules/mcp/errors'
import { agentUpdater } from '/@/modules/updater/agentUpdater'

interface McpResponse<T = any> {
  success: boolean
  data?: T
  type?: McpFailureType
  message?: string
  details?: Record<string, any>
}

async function triggerAgentUpdate(route?: string): Promise<McpResponse> {
  try {
    await restartMcpForAgentUpdate(route)
    return { success: true }
  }
  catch (error) {
    if (isMcpError(error)) {
      return {
        success: false,
        type: error.type,
        message: error.message,
        details: error.details,
      }
    }

    return {
      success: false,
      type: 'unknown_error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export function closeSyncControl() {
  globalShortcut.unregisterAll()
}

/** MCP 相关 */
export function setupMcpIpc(ipcMain: IPCMainInstance) {
  /** 打开mcp */
  ipcMain.on('mcp:open', async (_event, payload?: { route?: string }): Promise<McpResponse> => {
    console.log('Opening MCP')

    // 窗口已打开，直接聚焦到前台
    const existingWin = getMcpWindow()
    if (existingWin) {
      await createMcpWindow(payload?.route)
      return { success: true }
    }

    try {
      if (agentUpdater.hasPendingDownloadedUpdate()) {
        await mcpManager.closeMcpServer({ waitForExit: true })
        agentUpdater.clearUpdateMessageData()
      }
      await mcpManager.startMcpServer()
      await createMcpWindow(payload?.route)
      return { success: true }
    }
    catch (error) {
      if (isMcpError(error)) {
        return {
          success: false,
          type: error.type,
          message: error.message,
          details: error.details,
        }
      }
      return {
        success: false,
        type: 'unknown_error',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /** 获取mcp配置 */
  ipcMain.on('mcp:config', async (_event) => {
    return mcpManager.config
  })

  /** 确保 Agent Server 已启动并返回当前端口 */
  ipcMain.on('mcp:ensureServer', async (_event): Promise<McpResponse<{ port: number }>> => {
    try {
      await mcpManager.startMcpServer()
      return {
        success: true,
        data: mcpManager.config,
      }
    }
    catch (error) {
      if (isMcpError(error)) {
        return {
          success: false,
          type: error.type,
          message: error.message,
          details: error.details,
        }
      }

      return {
        success: false,
        type: 'unknown_error',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /** 获取 agent 更新状态 */
  ipcMain.on('mcp:getAgentUpdateInfo', async (_event) => {
    return agentUpdater.getUpdateMessageData()
  })

  /** 手动检测 agent 更新 */
  ipcMain.on('mcp:checkAgentForUpdates', async (_event) => {
    return agentUpdater.checkForUpdatesAndGetMessage()
  })

  /** 应用 agent 更新并重启 agent 窗口 */
  ipcMain.on('mcp:restartAgentForUpdate', async (_event, payload?: { route?: string }): Promise<McpResponse> => {
    return triggerAgentUpdate(payload?.route)
  })

  /** 触发 agent 更新；语义别名，供前端不用绑定到 restart 命名 */
  ipcMain.on('mcp:triggerAgentUpdate', async (_event, payload?: { route?: string }): Promise<McpResponse> => {
    return triggerAgentUpdate(payload?.route)
  })

  /** 关闭mcp */
  ipcMain.on('mcp:close', async (_event) => {
    await mcpManager.closeMcpServer({ waitForExit: true })
    await closeMcpWindow()
  })
}
