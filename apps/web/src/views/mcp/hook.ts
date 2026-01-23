// import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { sleep } from '/@/utils'
import { withTimeout } from '/@/views/mcp/util'

export function useMcp() {
  const [, onlyErrorToast] = useResponseToast()

  const mcpPort = ref()
  const serverUrl = computed(() => `http://localhost:${mcpPort.value}`)
  const health = reactive({
    loop: true,
    loading: true,
    isOk: false,
    count: 0,
    shortInterval: 1000,
    longInterval: 60 * 1000,
    controller: null as AbortController | null,
  })

  const conversationList = ref<any[]>([])
  const currentConversation = ref<any>()
  const currentConversationDetail = ref<any>()

  watch(() => health.loading, () => {
    fetchConversations()
  })

  async function initMcp() {
    const softConfig = await electronAPI.send('mcp:config')
    mcpPort.value = softConfig.port
    checkConnection()
  }

  async function checkConnection() {
    while (health.loop) {
      health.controller?.abort()
      health.controller = new AbortController()
      health.count++

      try {
        const { c: timeoutCtrl, cleanup } = withTimeout(5000)
        const signal = AbortSignal.any
          ? AbortSignal.any([health.controller.signal, timeoutCtrl.signal])
          : health.controller.signal

        const data = await fetch(`${serverUrl.value}/health`, { signal, cache: 'no-store' }).then(res => res.json())
        cleanup?.()

        const ok = data?.status === 'ok'
        health.isOk = ok
        health.loading = false
      }
      catch (e) {
        if (!health.loop)
          break
        health.isOk = false
      }

      if (health.count > 10 && health.loading) {
        onlyErrorToast(-1, $t('服务异常，请关闭 MCP 服务稍后重试'))
        break
      }

      await sleep(health.isOk ? health.longInterval : health.shortInterval)
    }
  }

  async function fetchConversations() {
    const { code, data, msg } = await fetch(`${serverUrl.value}/api/conversations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(ress => ress.json())

    onlyErrorToast(code, msg)

    if (code !== 0)
      return

    conversationList.value = data

    if (!data?.length) {
      await genConversation()
    }
    else {
      const active = data.find((item: any) => item.is_active) || data[0]
      await fetchDetailById(active.id)
    }
  }

  async function genConversation() {
    const { code, data, msg } = await fetch(`${serverUrl.value}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json())

    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    conversationList.value.unshift(data)
    await fetchDetailById(data.id)
  }

  async function fetchDetailById(id: string) {
    const { code, data, msg } = await fetch(`${serverUrl.value}/api/conversations/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(ress => ress.json())

    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    currentConversation.value = conversationList.value.find(item => item.id === id)
    currentConversationDetail.value = data
  }

  async function switchConversation(id: string) {
    if (id === currentConversation.value?.id)
      return
    await Promise.all([fetchDetailById(id), setConversationActive(id)])
  }

  async function setConversationActive(id: string) {
    const { code, msg } = await fetch(`${serverUrl.value}/api/conversations/${id}/active`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json())
    onlyErrorToast(code, msg)
  }

  async function stopConversation() {
    const { code, msg } = await fetch(`${serverUrl.value}/api/chat/${currentConversation.value.id}/interrupt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())

    if (code !== 0)
      throw new Error(msg)
  }

  async function deleteConversation(id: string) {
    const { code, msg } = await fetch(`${serverUrl.value}/api/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())

    if (code !== 0)
      throw new Error(msg)
  }

  onBeforeMount(() => {
    initMcp()
  })

  onBeforeUnmount(() => {
    health.loop = false
    health.controller?.abort()
  })

  return { serverUrl, health, conversationList, currentConversation, currentConversationDetail, initMcp, fetchConversations, genConversation, stopConversation, deleteConversation, switchConversation }
}
