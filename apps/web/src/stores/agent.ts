import { defineStore } from 'pinia'
import { useResponseToast } from '/@/hooks/useResponseToast'

type AgentHealthStatus = 'idle' | 'starting' | 'connecting' | 'ready' | 'unhealthy' | 'stopped'

const INITIAL_READY_TIMEOUT = 15000
const AGENT_CHANNEL_FAILURE_LIMIT = 10

export const useAgentStore = defineStore('agent', () => {
  const [, onlyErrorToast] = useResponseToast()

  const mcpPort = ref<number>()
  const serverUrl = computed(() => (mcpPort.value ? `http://localhost:${mcpPort.value}` : ''))

  const health = reactive({
    loading: false,
    isOk: false,
    status: 'idle' as AgentHealthStatus,
    consecutiveFailures: 0,
    lastSuccessAt: 0,
    lastError: '',
  })

  // 全局唯一就绪信号：拿到端口且统一 WebSocket 收到 channel.ready。
  const isReady = computed(() => !!serverUrl.value && health.isOk)
  const initialized = ref(false)

  let ensureServerPromise: Promise<number> | null = null
  let readyPromise: Promise<void> | null = null
  let readyPromiseTimeout: number | undefined
  let crashToastShown = false

  async function ensureServer() {
    if (mcpPort.value)
      return mcpPort.value

    if (ensureServerPromise)
      return ensureServerPromise

    health.status = 'starting'
    health.loading = true
    health.lastError = ''

    ensureServerPromise = (async () => {
      const result = await globalThis.electronAPI.send('mcp:ensureServer')
      if (!result?.success || !result.data?.port)
        throw new Error(result?.message || 'Agent server failed to start')

      mcpPort.value = result.data.port
      initialized.value = true
      health.status = 'connecting'
      return result.data.port
    })()
      .catch((error) => {
        health.isOk = false
        health.status = 'unhealthy'
        health.loading = false
        health.lastError = error instanceof Error ? error.message : String(error)
        throw error
      })
      .finally(() => {
        ensureServerPromise = null
      })

    return ensureServerPromise
  }

  function markAgentChannelConnecting() {
    health.isOk = false
    health.loading = true
    health.status = 'connecting'
  }

  function markAgentChannelReady() {
    health.isOk = true
    health.loading = false
    health.status = 'ready'
    health.consecutiveFailures = 0
    health.lastSuccessAt = Date.now()
    health.lastError = ''
    crashToastShown = false
  }

  function markAgentChannelFailure(error: string) {
    health.isOk = false
    health.consecutiveFailures++
    health.lastError = error
    const failedPermanently = health.consecutiveFailures >= AGENT_CHANNEL_FAILURE_LIMIT
    health.loading = !failedPermanently
    health.status = failedPermanently ? 'unhealthy' : 'connecting'

    if (failedPermanently && !crashToastShown) {
      crashToastShown = true
      console.error('Agent WebSocket failed after max retries:', error)
      onlyErrorToast(-1, $t('Roxy Agent 出现问题，请尝试重新启动 Agent'), { life: 0 })
    }
  }

  function markAgentChannelStopped() {
    health.isOk = false
    health.loading = false
    health.status = 'stopped'
  }

  async function waitUntilReady(timeout = INITIAL_READY_TIMEOUT) {
    await ensureServer()

    if (isReady.value)
      return

    if (readyPromise)
      return readyPromise

    readyPromise = new Promise<void>((resolve, reject) => {
      const stop = watch(
        isReady,
        (ready) => {
          if (ready) {
            cleanup()
            resolve()
          }
        },
        { immediate: true },
      )

      readyPromiseTimeout = window.setTimeout(() => {
        cleanup()
        reject(new Error('Agent server is not ready'))
      }, timeout)

      function cleanup() {
        stop()
        if (readyPromiseTimeout !== undefined)
          window.clearTimeout(readyPromiseTimeout)
        readyPromiseTimeout = undefined
        readyPromise = null
      }
    })

    return readyPromise
  }

  async function initMcp(timeout = INITIAL_READY_TIMEOUT) {
    await waitUntilReady(timeout)
  }

  return {
    mcpPort,
    serverUrl,
    health,
    isReady,
    initialized,
    ensureServer,
    waitUntilReady,
    initMcp,
    markAgentChannelConnecting,
    markAgentChannelFailure,
    markAgentChannelReady,
    markAgentChannelStopped,
  }
})
