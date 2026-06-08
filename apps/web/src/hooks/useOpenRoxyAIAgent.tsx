import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { showToast } from '/@/hooks/useResponseToast/handleBusinessCode'
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

async function getMcpStatus(): Promise<{ mcpWindowOpen: boolean, roxyClawEnabled: boolean, mcpServerRunning: boolean }> {
  if (globalThis.electronAPI) {
    try {
      return await globalThis.electronAPI.send('mcp:getStatus')
    }
    catch (error) {
      console.error('Failed to get MCP status:', error)
      return { mcpWindowOpen: false, roxyClawEnabled: false, mcpServerRunning: false }
    }
  }
  return { mcpWindowOpen: false, roxyClawEnabled: false, mcpServerRunning: false }
}

export function useOpenRoxyAIAgent() {
  const { check } = usePermission()
  const { mixpanelTrack } = useUserStore()

  const opening = ref(false)

  async function openRoxyAIAgent(scene?: string, skill?: string) {
    if (!check('Roxy_AI_Agent_All')) {
      return
    }

    if (opening.value)
      return

    mixpanelTrack('click_enter_agent')
    opening.value = true

    try {
      // 检查 RoxyClaw 是否正在运行
      const mcpStatus = await getMcpStatus()
      if (mcpStatus.roxyClawEnabled) {
        showToast({
          severity: 'warn',
          summary: $t('Agent 被占用'),
          detail: (
            <I18nT keypath={$t('RoxyClaw 正在运行中，使用 Roxy AI Agent 之前请先{RoxyClaw}。', { RoxyClaw: '{RoxyClaw}' })}>
              {{ RoxyClaw: () => <a class="cursor-pointer" onClick={() => router.push({ name: 'roxy-claw-home' })}>{$t('关闭 RoxyClaw')}</a> }}
            </I18nT>
          ),
          life: 5000,
        })
        opening.value = false
        return
      }

      // 检查 API 是否开启
      const ApiResult = await API.base.userGetUserApiList()
      if (ApiResult.code === 0 && !ApiResult.data.open) {
        let opened = false
        async function openApiKeys() {
          if (opened)
            return
          const { code, msg } = await API.base.userSetUserApiCreate({ ...ApiResult.data, open: true })
          onlyErrorToast(code, msg)
          if (code === 0) {
            // 开关或端口改变时 重启 API 服务
            await globalThis.electronAPI.send('app:restartAPIServer')
          }
          opened = true
          router.push({ name: 'api-keys' })
        }

        showToast({
          severity: 'warn',
          summary: $t('未开启 API'),
          detail: (
            <I18nT keypath={$t('请先 {start} 状态后再使用 AI Agent。', { start: '{start}' })}>
              {{ start: () => <a class="cursor-pointer" onClick={openApiKeys}>{$t('开启 API')}</a> }}
            </I18nT>
          ),
          life: 5000,
        })
        opening.value = false
        return
      }

      // 检查 API 端口是否被占用
      const apiPort = await globalThis.electronAPI.send('util:getApiPort')
      if (apiPort === -1) {
        showToast({
          severity: 'warn',
          summary: $t('端口已被占用'),
          detail: $t('我们检测到你当前设置的端口 {port} 已被占用，请修改端口以正常使用 API 服务', { port: ApiResult.data.port }),
          life: 5000,
        })
        router.push({ name: 'api-keys' })
        return
      }

      // 打开 Roxy AI Agent 窗口
      const openOptions: { scene?: string, skill?: string } = {}
      if (scene)
        openOptions.scene = scene
      if (skill)
        openOptions.skill = skill
      const result = await globalThis.electronAPI.send('mcp:open', openOptions)
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
