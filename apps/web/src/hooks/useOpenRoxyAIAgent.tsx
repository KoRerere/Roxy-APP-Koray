import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { emitter } from '/@/utils/eventBus'
import { getMcpErrorMessage } from '/@/stores/roxy-claw'
import { useUserStore } from '/@/stores/user'
import { $t } from '/@/locales'
import router from '/@/router'

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

async function showApiPortOccupied(port: number, canOpenApiSettings: boolean) {
  if (canOpenApiSettings) {
    await router.push({ name: 'api-keys' })
  }

  emitter.emit('showToast', {
    severity: 'warn',
    summary: $t('端口已被占用'),
    detail: canOpenApiSettings
      ? $t('我们检测到你当前设置的端口 {port} 已被占用，请修改端口以正常使用 API 服务', { port })
      : $t('当前设置的 API 端口 {port} 已被占用，请先解决本地端口占用问题后再打开，或联系团队管理员修改端口', { port }),
    life: 5000,
  })
}

export function useOpenRoxyAIAgent() {
  const { check } = usePermission()
  const { mixpanelTrack } = useUserStore()

  const opening = ref(false)

  async function openRoxyAIAgent(route = '/agent-console') {
    if (!check('Roxy_AI_Agent_All')) {
      return
    }

    if (opening.value) {
      return
    }

    mixpanelTrack('click_enter_agent')
    opening.value = true

    try {
      // 检查 API 是否开启
      const ApiResult = await API.base.userGetUserApiList()
      if (ApiResult.code !== 0) {
        onlyErrorToast(ApiResult.code, ApiResult.msg || $t('Roxy Agent 启动失败'))
        return
      }

      const apiPort = Number(ApiResult.data.port)
      const canOpenApiSettings = check('API_MCP_view_page')
      if (!ApiResult.data.open) {
        const { code, msg } = await API.base.userSetUserApiCreate({ ...ApiResult.data, open: true })
        onlyErrorToast(code, msg)
        if (code !== 0) {
          return
        }

        // 开关或端口改变时重启 API 服务
        const restartResult = await globalThis.electronAPI.send('app:restartAPIServer')
        if (!restartResult?.success) {
          if (restartResult?.reason === 'port_occupied') {
            await showApiPortOccupied(apiPort, canOpenApiSettings)
          }
          else {
            onlyErrorToast(-1, $t('Roxy Agent 启动失败'))
          }
          return
        }
      }
      else if (globalThis.isElectron) {
        const availablePort = await globalThis.electronAPI.send('util:checkPort', apiPort)
        if (availablePort !== apiPort) {
          await showApiPortOccupied(apiPort, canOpenApiSettings)
          return
        }
      }

      // 打开 Roxy AI Agent 窗口
      const result = await globalThis.electronAPI.send('mcp:open', { route })
      console.log('Mcp open result:', result)
      if (!result.success) {
        if (result.type === 'openapi_port_occupied') {
          await showApiPortOccupied(Number(result.details?.port) || apiPort, canOpenApiSettings)
          return
        }
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
