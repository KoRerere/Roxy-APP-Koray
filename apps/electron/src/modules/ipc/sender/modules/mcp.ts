import type { IPCMainInstance } from '../../types'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type { UserCalcLlmTokenCostCreateData } from '@roxy/backend-api'

export function createMcpSender(ipcMain: IPCMainInstance) {
  return {
    /** 计算消费 token 数量 */
    tokenUsage(payload: UserCalcLlmTokenCostCreateData['data']) {
      return ipcMain.send('mcp:token-usage', payload)
    },

    /** 通知 MCP 窗口更新 agent 状态 */
    resourceUpdate(payload: ResourceUpdateMessage) {
      return ipcMain.send('mcp:resource-update', payload)
    },
  } as const
}
