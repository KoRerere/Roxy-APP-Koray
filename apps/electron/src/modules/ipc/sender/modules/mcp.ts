import type { IPCMainInstance } from '../../types'
import type { UserCalcLlmTokenCostCreateData } from '@roxy/backend-api'

export function createMcpSender(ipcMain: IPCMainInstance) {
  return {
    /** 计算消费 token 数量 */
    tokenUsage(payload: UserCalcLlmTokenCostCreateData['data']) {
      return ipcMain.send('mcp:token-usage', payload)
    },
  } as const
}
