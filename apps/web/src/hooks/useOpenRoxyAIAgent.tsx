import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { emitter } from '/@/utils/eventBus'
import { getMcpErrorMessage } from '/@/stores/roxy-claw'
import { useUserStore } from '/@/stores/user'
import { $t } from '/@/locales'

function onlyErrorToast(code: number, message: string) {
  if (code !== 0) {
    emitter.emit('showToast', {
      severity: 'error',
      summary: $t('操作失败'),
      detail: message,
      life: 5000,
    })
  }
}

export function useOpenRoxyAIAgent() {
  const { check } = usePermission()
  const { mixpanelTrack } = useUserStore()

  const opening = ref(false)

  async function openRoxyAIAgent(route = '/agent-console') {
    if (!check('Roxy_AI_Agent_All')) {
      return
    }

    if (opening.value)
      return

    mixpanelTrack('click_enter_agent')
    opening.value = true

    try {
      // 检查 API 是否开启
      const ApiResult = await API.base.userGetUserApiList()
      if (ApiResult.code === 0 && !ApiResult.data.open) {
        const { code, msg } = await API.base.userSetUserApiCreate({ ...ApiResult.data, open: true })
        onlyErrorToast(code, msg)
        if (code !== 0)
          return

        // 开关或端口改变时重启 API 服务
        await globalThis.electronAPI.send('app:restartAPIServer')
      }

      // 打开 Roxy AI Agent 窗口
      const result = await globalThis.electronAPI.send('mcp:open', { route })
      console.log('Mcp open result:', result)
      if (!result.success) {
        const errorMessage = result.type
          ? getMcpErrorMessage(result.type)
          : result.message || $t('Roxy Agent 启动失败')
        onlyErrorToast(-1, errorMessage)
      }
    }
    catch (error) {
      console.error('Failed to open MCP:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('Roxy Agent 启动失败'))
    }
    finally {
      opening.value = false
    }
  }

  return {
    opening,
    openRoxyAIAgent,
  }
}
