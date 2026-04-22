import { defineStore } from 'pinia'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { sleep } from '/@/utils'
import { withTimeout } from '/@/views/mcp/util'

export const useAgentStore = defineStore('agent', () => {
  const [, onlyErrorToast] = useResponseToast()

  const mcpPort = ref<number>()
  const serverUrl = computed(() => (mcpPort.value ? `http://localhost:${mcpPort.value}` : ''))

  const health = reactive({
    loop: true,
    loading: true,
    isOk: false,
    count: 0,
    shortInterval: 1000,
    longInterval: 60 * 1000,
    controller: null as AbortController | null,
  })

  // 标记是否已初始化
  const initialized = ref(false)
  // 健康检查 loop 的引用，用于 cleanup
  let healthCheckRunning = false

  async function initMcp() {
    if (initialized.value) {
      return
    }
    initialized.value = true

    try {
      const softConfig = await globalThis.electronAPI.send('mcp:config')
      mcpPort.value = softConfig.port
      startHealthCheck()
    }
    catch (e) {
      console.error('Failed to init MCP:', e)
      initialized.value = false
    }
  }

  function startHealthCheck() {
    if (healthCheckRunning) {
      return
    }
    healthCheckRunning = true
    health.loop = true
    checkConnection()
  }

  function stopHealthCheck() {
    health.loop = false
    health.controller?.abort()
    healthCheckRunning = false
  }

  async function checkConnection() {
    while (health.loop) {
      if (!serverUrl.value) {
        await sleep(health.shortInterval)
        continue
      }

      health.controller?.abort()
      health.controller = new AbortController()
      health.count++

      try {
        const { c: timeoutCtrl, cleanup } = withTimeout(5000)
        const signal = AbortSignal.any
          ? AbortSignal.any([health.controller.signal, timeoutCtrl.signal])
          : health.controller.signal

        const response = await fetch(`${serverUrl.value}/health`, { signal, cache: 'no-store' })
        cleanup?.()

        if (!response.ok) {
          onlyErrorToast(response.status, $t('Roxy Agent 服务异常，请尝试重启服务'))
        }

        const data = await response.json()

        const ok = data?.code === 0
        if (!ok) {
          onlyErrorToast(data?.code, $t('API 服务异常，请检查端口是否被占用'))
        }

        health.isOk = ok
        health.loading = false
      }
      catch (e) {
        if (!health.loop) {
          break
        }
        health.isOk = false
      }

      if (health.count > 10 && health.loading) {
        onlyErrorToast(-1, $t('服务异常，请关闭 MCP 服务稍后重试'))
        break
      }

      await sleep(health.isOk ? health.longInterval : health.shortInterval)
    }
  }

  return {
    mcpPort,
    serverUrl,
    health,
    initialized,
    initMcp,
    startHealthCheck,
    stopHealthCheck,
  }
})
