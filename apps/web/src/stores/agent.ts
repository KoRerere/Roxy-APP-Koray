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

  // 全局唯一就绪信号：拿到端口且「本次」/health 成功才算服务端启动完毕。
  // 任何依赖 agent 的请求、以及后续的全局 loading 页，都应只以它为准。
  const isReady = computed(() => !!serverUrl.value && health.isOk)

  const initialized = ref(false)
  let healthCheckRunning = false
  let firstCheckResolve: (() => void) | null = null
  let firstCheckReject: ((reason?: unknown) => void) | null = null

  async function initMcp() {
    // 端口只需获取一次
    if (!mcpPort.value) {
      try {
        const softConfig = await globalThis.electronAPI.send('mcp:config')
        mcpPort.value = softConfig.port
      }
      catch (e) {
        console.error('Failed to init MCP:', e)
        return
      }
    }
    initialized.value = true

    // 健康检查正在运行且当前确实就绪 → 直接返回，无需重新等待首检。
    if (healthCheckRunning && isReady.value)
      return

    // 否则（首次进入、或离开页面后重新进入导致健康检查已停止）：
    // 重新启动健康检查并等待「本次」首检结果，确保 isOk 反映当前真实状态，
    // 而不是沿用上一次遗留的 isOk=true 就放行后续请求。
    await new Promise<void>((resolve, reject) => {
      firstCheckResolve = resolve
      firstCheckReject = reject
      startHealthCheck()
    })
      .catch((e) => {
        // 首检失败不阻断页面渲染：健康检查会在后台持续重试以自愈，
        // 依赖 agent 的请求/页面继续等待 isReady 即可。
        console.error('MCP first health check failed:', e)
      })
      .finally(() => {
        firstCheckResolve = null
        firstCheckReject = null
      })
  }

  function startHealthCheck() {
    if (healthCheckRunning) {
      return
    }
    healthCheckRunning = true
    health.loop = true
    // 每次（重新）启动都复位为初始状态，杜绝沿用上一次的 isOk=true，
    // 保证 isOk 永远只代表当前这一轮 /health 的真实结果。
    health.isOk = false
    health.loading = true
    health.count = 0
    checkConnection()
  }

  function stopHealthCheck() {
    health.loop = false
    health.controller?.abort()
    healthCheckRunning = false
  }

  async function checkConnection() {
    try {
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

          if (ok) {
            firstCheckResolve?.()
            firstCheckResolve = null
            firstCheckReject = null
          }
        }
        catch (e) {
          if (!health.loop) {
            break
          }
          health.isOk = false
        }

        // 初始连续探测失败达到上限：只触发一次——让 initMcp 的首检 await 结束（不再 hang），
        // 但绝不终止循环。agent 可能稍后才启动完成，循环需持续探测以自愈，
        // 否则一旦首次 /health 失败，后续所有依赖 agent 的请求都会永远等不到 isReady。
        if (!health.isOk && firstCheckReject && health.count >= 10) {
          health.loading = false
          onlyErrorToast(-1, $t('服务异常，请关闭 MCP 服务稍后重试'))
          firstCheckReject(new Error('MCP health check failed after max retries'))
          firstCheckResolve = null
          firstCheckReject = null
        }

        await sleep(health.isOk ? health.longInterval : health.shortInterval)
      }
    }
    finally {
      // 循环结束时复位运行标记，确保下次进入页面 startHealthCheck 能重新拉起。
      healthCheckRunning = false
    }
  }

  return {
    mcpPort,
    serverUrl,
    health,
    isReady,
    initialized,
    initMcp,
    startHealthCheck,
    stopHealthCheck,
  }
})
