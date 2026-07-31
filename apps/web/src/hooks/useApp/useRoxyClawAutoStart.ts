import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { onMounted } from 'vue'

/**
 * Electron 环境下 RoxyClaw 自动启动：配置加载完成后尝试启动，失败时回滚 enabled 状态。
 */
export function useRoxyClawAutoStart() {
  onMounted(async () => {
    if (globalThis.isElectron) {
      const roxyClawStore = useRoxyClawStore()

      // 确保配置加载完成
      await roxyClawStore.fetchConfig()

      if (roxyClawStore.isEnabled) {
        try {
          // 检查 MCP 窗口是否正在运行
          const mcpStatus = await roxyClawStore.getMcpStatus()
          if (mcpStatus.mcpWindowOpen) {
            console.log('MCP window is open, skipping RoxyClaw auto-start')
            // 重置状态为未启用，避免下次继续尝试
            await roxyClawStore.updateConfig({ enabled: false })
            return
          }

          const result = await roxyClawStore.startRoxyClaw()
          if (result.success) {
            console.log('RoxyClaw auto-started successfully')
          }
          else {
            console.error('Failed to auto-start RoxyClaw:', result.message)
            // 自动启动失败时重置状态为未启用
            await roxyClawStore.updateConfig({ enabled: false })
          }
        }
        catch (error) {
          console.error('Failed to auto-start RoxyClaw:', error)
          // 自动启动失败时重置状态为未启用
          await roxyClawStore.updateConfig({ enabled: false })
        }
      }
    }
  })
}
