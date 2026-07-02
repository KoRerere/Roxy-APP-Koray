import { computed, markRaw, nextTick, ref, shallowRef, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { getImage } from '/@/utils/basic'
import { format } from 'date-fns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useAgentStore } from '/@/stores/agent'
import { fetchSSE, isHiddenToolEvent, MessageViewer, parseHistorySSE2 } from '/@/views/mcp/util'
import { useAgentApi } from '../agent-api'
import type { AssetGenerationOptions, AttachmentInfo, AvatarInfo, FormattedMessage, GeneratedImageInfo, HitlDecision, InputScene, MessageEntryView, SSEEventData, Todo, WorkerStatus } from '/@/views/mcp/types'
import type { ConversationDetail } from '../agent-api'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf', 'text/plain', 'application/json', 'text/markdown', 'text/x-markdown', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif']
const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
}
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_PENDING_ATTACHMENTS = 3
const DEFAULT_ASSET_OPTIONS: AssetGenerationOptions = {
  aspectRatio: '1:1',
  quality: '2K',
  count: '1',
}

function formatDate(date: Date | string | number): string {
  return format(new Date(date), 'yyyy/MM/dd HH:mm')
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function normalizeWorkerStatus(status: unknown): WorkerStatus {
  if (status === 'pending' || status === 'success')
    return status
  return 'failed'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const commaIndex = result.indexOf(',')
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function resolveFileMimeType(file: File) {
  if (file.type)
    return file.type

  const match = file.name.toLowerCase().match(/\.[^.]+$/)
  return match ? EXTENSION_MIME_TYPES[match[0]] || '' : ''
}

function createContentBlock(text: string): MessageEntryView {
  return {
    id: `content-${generateId()}`,
    type: 'content',
    text,
    meta: {},
    workers: [],
  }
}

function buildGeneratedAttachment(image: GeneratedImageInfo, getFileUrl: (fileId: string) => string): AttachmentInfo {
  const resolvedImage = resolveGeneratedImage(image, getFileUrl)

  return {
    fileId: resolvedImage.fileId,
    fileName: resolvedImage.fileName || resolvedImage.fileId,
    mimeType: resolvedImage.mimeType || 'image/png',
    size: resolvedImage.size || 0,
    url: resolvedImage.url,
    localUrl: resolvedImage.localUrl,
    remoteUrl: resolvedImage.remoteUrl,
    fileUrl: resolvedImage.fileUrl,
    source: 'generated',
  }
}

function resolveGeneratedImageUrl(image: GeneratedImageInfo, getFileUrl: (fileId: string) => string) {
  if (!image.url)
    return getFileUrl(image.fileId)

  if (/^(?:https?:|data:|blob:)/i.test(image.url))
    return image.url

  const normalizedUrl = image.url.startsWith('/') ? image.url : `/${image.url}`
  if (normalizedUrl.startsWith('/api/files/'))
    return getFileUrl(image.fileId)

  return image.url
}

function resolveGeneratedImage(image: GeneratedImageInfo, getFileUrl: (fileId: string) => string) {
  const url = resolveGeneratedImageUrl(image, getFileUrl)
  return {
    ...image,
    url,
    localUrl: image.localUrl || url,
    remoteUrl: image.remoteUrl || image.fileUrl,
    fileUrl: image.fileUrl || image.remoteUrl,
  }
}

function resolveGeneratedImages(images: GeneratedImageInfo[], getFileUrl: (fileId: string) => string) {
  return images.map(image => resolveGeneratedImage(image, getFileUrl))
}

function resolveUploadedAttachmentDisplayUrl(
  attachment: Pick<AttachmentInfo, 'fileId' | 'url' | 'localUrl' | 'remoteUrl' | 'fileUrl'>,
  getFileUrl: (fileId: string) => string,
) {
  const candidate = attachment.url || attachment.localUrl

  if (candidate && /^(?:https?:|data:|blob:)/i.test(candidate))
    return candidate

  const normalizedUrl = candidate
    ? (candidate.startsWith('/') ? candidate : `/${candidate}`)
    : ''

  if (attachment.fileId && (!normalizedUrl || normalizedUrl.startsWith('/api/files/')))
    return getFileUrl(attachment.fileId)

  return attachment.remoteUrl || attachment.fileUrl || candidate || ''
}

export interface UseChatStreamOptions {
  onUpdateTitle?: (conversationId: string, title: string) => void
  onCreateConversation?: (data: ConversationDetail) => void
}

export const useChatStreamStore = defineStore('chatStream', () => {
  const [, onlyErrorToast] = useResponseToast()
  const { mixpanelTrack, getUserPayInfo } = useUserStore()
  const { userInfo } = storeToRefs(useUserStore())
  const agentStore = useAgentStore()
  const { conversationDetail, conversationStop, conversationResume, uploadFile, getFileUrl, conversationCreate } = useAgentApi()

  // ---- 外部注入依赖 ----
  let activeConversationId: (() => string) | null = null
  let options: UseChatStreamOptions = {}
  let stopWatcher: (() => void) | null = null

  const aiAvatar: AvatarInfo = {
    role: 'assistant',
    name: 'Ro',
    userName: 'Roxy AI Agent',
    avatar: getImage('mcp/agent_avatar.png'),
    color: '',
  }

  const userAvatar = computed<AvatarInfo>(() => {
    const { avatar, avatarColor, userName } = userInfo.value
    return {
      role: 'user',
      name: userName?.slice(0, 2) || '',
      userName: userName || '',
      avatar: avatar || '',
      color: avatarColor || '',
    }
  })

  // ---- State ----
  const mode = ref<'orchestrator' | 'simple'>('simple')
  const inputScene = ref<InputScene>('automation')
  const assetOptions = ref<AssetGenerationOptions>({ ...DEFAULT_ASSET_OPTIONS })
  const userMessage = ref('')
  const isChatting = ref(false)
  // 录制/enhance 脚本生成是否进行中（active/processing）。与 isChatting 并列，
  // 用于在生成脚本期间阻止切换会话/页面（侧边栏 guard + 路由离开拦截）。
  // 由 chat-view.vue 在 recordingData 变化时同步。
  const isRecordingProcessing = ref(false)
  // 完全访问模式（yolo）：开启后本次会话发消息时携带 fullAccess=true，
  // 后端 agent 启动不挂 HITL interrupt，所有操作（文件读写、命令执行、删除等）直接执行不中断。
  // 会话级开关，默认关闭；不持久化，仅随 /api/chat 请求体传递。
  const fullAccess = ref(false)
  const activeRequestKind = ref<'chat' | 'image' | null>(null)
  const todo = ref<Todo[]>([])
  const pendingAttachments = ref<AttachmentInfo[]>([])
  const pendingScript = ref<any>(null)
  const currentConversation = ref<ConversationDetail>()
  const messageList = shallowRef<any[]>([])
  const isEmpty = computed(() => messageList.value.length === 0)
  const currentImagePrompt = ref('')

  // ---- SSE connection management ----
  let abortController: AbortController | null = null
  let messageViewer = new MessageViewer()

  function abortCurrentStream() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isChatting.value = false
    activeRequestKind.value = null
  }

  // ---- Scroll integration ----
  /** 每次需要强制滚底时自增；view 层 watch 此值，变化则在 nextTick 后强制滚底 */
  const scrollToBottomToken = ref(0)
  let scrollCallback: (() => void) | null = null

  function setScrollCallback(cb: () => void) {
    scrollCallback = cb
  }

  function updateStream(isStreaming = true) {
    const list = messageList.value
    const idx = list.length - 1
    if (idx < 0) {
      nextTick(() => scrollCallback?.())
      return
    }
    // 替换最后一个 item 为新对象，同时用 slice() 换一个新数组引用，
    // 确保 shallowRef + markRaw 下的消息列表更新能触发视图刷新。
    const newItem = markRaw({
      ...list[idx],
      isStreaming,
      messageBlocks: messageViewer.view(),
    })
    todo.value = messageViewer.viewTodo()
    const newList = list.slice()
    newList[idx] = newItem
    messageList.value = newList
    nextTick(() => scrollCallback?.())
  }

  function handleSSEEvent(event: any) {
    const eventData = event.json as SSEEventData | null
    if (!eventData)
      return

    const { type, data, timestamp } = eventData
    const eventTimestamp = timestamp ?? Date.now()

    switch (type) {
      case 'thinking':
        messageViewer.add(data?.thinkingId || '', 'thinking', data?.text || '', eventTimestamp)
        updateStream()
        break

      case 'thinking_complete':
        messageViewer.applyThinkingComplete(data?.thinkingId || '', data?.durationMs ?? 0, data?.taskId)
        updateStream()
        break

      case 'content':
        messageViewer.add(data?.contentId || '', 'content', data?.text || '', eventTimestamp)
        updateStream()
        break

      case 'tool_call':
        if (isHiddenToolEvent(data)) {
          updateStream()
          break
        }

        if (data?.taskId) {
          messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_call', data, eventTimestamp)
        }
        else {
          messageViewer.add(data?.toolId || '', 'tool_call', data, eventTimestamp)
        }
        updateStream()
        break

      case 'tool_result':
        if (isHiddenToolEvent(data)) {
          updateStream()
          break
        }

        if (data?.taskId) {
          messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_result', data, eventTimestamp)
        }
        else {
          messageViewer.add(data?.toolId || '', 'tool_result', data, eventTimestamp)
        }
        updateStream()
        break

      case 'worker_thinking':
        messageViewer.addWorkerEntry(data?.taskId || '', data?.thinkingId || '', 'worker_thinking', data?.text || '', eventTimestamp)
        updateStream()
        break

      case 'worker_content':
        messageViewer.addWorkerEntry(data?.taskId || '', data?.contentId || '', 'worker_content', data?.text || '', eventTimestamp)
        updateStream()
        break

      case 'worker_dispatch':
        messageViewer.setWorkerTitle(data?.taskId || '', data?.title || '')
        updateStream()
        break

      case 'worker_result':
        messageViewer.setWorkerStatus(data?.taskId || '', normalizeWorkerStatus(data?.status), eventTimestamp)
        updateStream()
        break

      case 'worker_stopped':
        messageViewer.setWorkerStatus(data?.taskId || '', 'failed', eventTimestamp)
        messageViewer.markWorkerPendingAsFailed(data?.taskId || '')
        updateStream()
        break

      case 'todo':
        messageViewer.add(type, type, data, eventTimestamp)
        updateStream()
        break

      case 'script_log': {
        // 沙箱脚本日志：按 toolId（或 runId）归组成一个日志块，逐行累积
        const groupId = `script:${data?.toolId || data?.runId || data?.scriptName || 'default'}`
        messageViewer.add(groupId, type, data, eventTimestamp)
        updateStream()
        break
      }

      case 'agent_file':
        messageViewer.add('agent-files', 'agent_file', data, eventTimestamp)
        updateStream()
        break

      // 顶层模型调用网络中断自动重试：同一重试序列复用 retryId，原地更新「重试中…(n/N)」而非新增消息
      case 'retry':
        messageViewer.add(`retry:${data?.retryId ?? eventTimestamp}`, 'retry', data, eventTimestamp)
        updateStream()
        break

      // worker 内重试：不展示提示，仅停止该 worker 当前 thinking 计时；重试后的新块自然新建、保留截断块
      case 'worker_retry':
        messageViewer.noteWorkerRetry(data?.taskId || '', eventTimestamp)
        updateStream()
        break

      case 'error':
        messageViewer.finalize(eventTimestamp)
        messageViewer.add(type, type, data, eventTimestamp)
        updateStream(false)
        isChatting.value = false
        break

      case 'interrupt':
        messageViewer.finalize(eventTimestamp)
        messageViewer.add(type, type, '', eventTimestamp)
        updateStream(false)
        isChatting.value = false
        break

      case 'orchestrator_stopped': {
        messageViewer.finalize(eventTimestamp)
        messageViewer.markPendingAsFailed()
        updateStream(false)
        isChatting.value = false
        break
      }

      case 'hitl_interrupt':
        messageViewer.add(data?.interruptsId, 'hitl_interrupt', data, eventTimestamp)
        updateStream()
        break

      case 'hitl_resume':
        if (data?.interruptsId) {
          messageViewer.add(data.interruptsId, 'hitl_interrupt', { decisions: data.decisions }, eventTimestamp)
          updateStream()
        }
        break

      case 'done':
        messageViewer.finalize(eventTimestamp)
        if (activeRequestKind.value === 'image') {
          messageViewer.remove('__processing__')
          messageViewer.finalizeImages('__images__')
        }
        updateStream(false)
        isChatting.value = false
        break

      case 'image_generating': {
        const count = Math.min(Math.max(Number(eventData.data?.count) || 1, 1), 4)
        const pendingImages: GeneratedImageInfo[] = Array.from({ length: count }, (_, i) => ({
          fileId: `pending-${i}`,
          fileName: '',
          isPending: true,
        }))
        messageViewer.add('__images__', 'image', pendingImages)
        updateStream()
        break
      }

      case 'image_partial': {
        const { index, image } = eventData.data ?? {}
        if (image != null && index != null) {
          messageViewer.setImageAtIndex('__images__', index, {
            ...resolveGeneratedImage(image, getFileUrl),
            prompt: image.prompt || currentImagePrompt.value,
          })
          updateStream()
        }
        break
      }

      case 'title':
        if (data?.title && currentConversation.value) {
          currentConversation.value.title = data.title
          options.onUpdateTitle?.(activeConversationId?.() || '', data.title)
        }
        break
    }
  }

  // ---- Actions ----

  function hasPendingAttachmentUploads() {
    return pendingAttachments.value.some((attachment) => {
      if (attachment.uploadStatus === 'uploading')
        return true

      return attachment.source !== 'generated'
        && Boolean(attachment.preview)
        && !attachment.url
        && !attachment.localUrl
        && !attachment.remoteUrl
        && !attachment.fileUrl
    })
  }

  async function sendMessage(script?: any) {
    const isAssetScene = inputScene.value === 'asset'
    const rawMessage = userMessage.value
    const outgoingMessage = rawMessage
    const outgoingMode = isAssetScene ? 'simple' : mode.value
    const hasText = outgoingMessage.trim().length > 0
    if (isChatting.value || !hasText || hasPendingAttachmentUploads())
      return

    if (!rawMessage) {
      return
    }

    mixpanelTrack('click_agent_send_message')
    const msg = rawMessage
    userMessage.value = ''

    const scriptToSend = script || pendingScript.value
    // pendingScript.value = null

    let isCreatedChat = false
    if (!currentConversation.value) {
      const result = await conversationCreate(isAssetScene ? 'asset' : 'automation')
      if (result.code !== 0) {
        onlyErrorToast(-1, '创建会话失败，请重试')
        return
      }
      isCreatedChat = true
      currentConversation.value = result.data
    }

    const attachmentsToSend = pendingAttachments.value.slice()
    pendingAttachments.value = []

    const displayAttachments: AttachmentInfo[] = attachmentsToSend.map(att => ({
      fileId: att.fileId,
      fileName: att.fileName,
      mimeType: att.mimeType,
      size: att.size,
      url: att.url || att.preview || getFileUrl(att.fileId),
      localUrl: att.localUrl,
      remoteUrl: att.remoteUrl,
      fileUrl: att.fileUrl,
    }))

    messageList.value = [
      ...messageList.value,
      markRaw({
        id: generateId(),
        ...userAvatar.value,
        mode: outgoingMode,
        date: formatDate(new Date()),
        attachments: displayAttachments.length ? displayAttachments : undefined,
        content: msg,
      }),
      markRaw({
        id: generateId(),
        ...aiAvatar,
        mode: outgoingMode,
        date: formatDate(new Date()),
        messageBlocks: [],
        isStreaming: true,
      }),
    ]

    isChatting.value = true
    messageViewer = new MessageViewer()
    abortController = new AbortController()

    if (isAssetScene) {
      activeRequestKind.value = 'image'
      currentImagePrompt.value = outgoingMessage

      nextTick(() => scrollCallback?.())

      fetchSSE(`${agentStore.serverUrl}/api/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          message: outgoingMessage,
          conversationId: currentConversation.value!.id,
          attachments: attachmentsToSend.map(({ fileId }) => ({ fileId })),
          assetOptions: assetOptions.value,
        }),
        onEvent: (event) => {
          handleSSEEvent(event)
        },
        onError: (error: any) => {
          messageViewer.remove('__processing__')
          messageViewer.finalize()
          if (error?.name === 'AbortError') {
            // 用户主动取消已改走服务端 /stop（经 interrupt 事件优雅停止）。
            // 这里的 AbortError 仅来自切换/离开会话时主动断开客户端 fetch：静默清理占位即可，
            // 不能 add('error', ...)，否则 status-message 会因没有 errorCode 退化成“未知错误”闪现。
            messageViewer.finalizeImages('__images__')
          }
          else {
            messageViewer.add('error', 'error', 'Image generation failed, please retry')
            onlyErrorToast(-1, 'Image generation failed, please retry')
          }
          updateStream()
          isChatting.value = false
        },
      }).finally(() => {
        abortController = null
        isChatting.value = false
        activeRequestKind.value = null
        currentImagePrompt.value = ''
        if (isCreatedChat) {
          options.onCreateConversation?.(toRaw(currentConversation.value!))
        }
        getUserPayInfo()
      })

      return
    }

    activeRequestKind.value = 'chat'

    nextTick(() => scrollCallback?.())

    fetchSSE(`${agentStore.serverUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        message: outgoingMessage,
        mode: outgoingMode,
        conversationId: currentConversation.value!.id,
        enableThinking: true,
        fullAccess: fullAccess.value,
        attachments: attachmentsToSend.map(({ fileId }) => ({ fileId })),
        ...(scriptToSend ? { script: scriptToSend } : {}),
      }),
      onEvent: (event) => {
        console.log('🚀 ~ sendMessage ~ event:', event)
        handleSSEEvent(event)
      },
      onError: (error) => {
        console.error('🚀 ~ sendMessage ~ error:', error)
        messageViewer.finalize()
        if (!messageViewer.view().length) {
          messageViewer.add('error', 'content', '请求发生错误，请重试')
        }
        updateStream()
        isChatting.value = false
      },
    }).finally(() => {
      abortController = null
      activeRequestKind.value = null
      if (isCreatedChat) {
        options.onCreateConversation?.(toRaw(currentConversation.value!))
      }
      getUserPayInfo()
    })
  }

  function handleInterrupt() {
    // 图片生成与 chat 一样必须走服务端 /stop：仅 abort 客户端 fetch 只会断开浏览器侧连接，
    // 服务端的 image agent 与 generateImagesFromPlan 仍会继续跑（继续调用 LLM 代理计费、
    // 继续生图、写库），切回会话会看到“仍在运行”。前端先乐观停止计时与流式状态，
    // 再由 conversationStop 触发服务端 abortController 真正 abort。
    messageViewer.finalize()
    updateStream(false)
    isChatting.value = false

    conversationStop(activeConversationId?.() || currentConversation.value?.id || '')
  }

  function handleHitlInterrupt(decisions: HitlDecision[]) {
    return conversationResume(activeConversationId?.() || currentConversation.value?.id || '', decisions)
  }

  // ---- File upload ----

  async function uploadFiles(files: File[]) {
    if (isChatting.value)
      return

    const allowedMimeTypes = inputScene.value === 'asset' ? IMAGE_MIME_TYPES : ALLOWED_MIME_TYPES

    for (const file of files) {
      if (pendingAttachments.value.length >= MAX_PENDING_ATTACHMENTS) {
        onlyErrorToast(-1, `最多只能上传 ${MAX_PENDING_ATTACHMENTS} 个文件`)
        break
      }

      const mimeType = resolveFileMimeType(file)

      if (!allowedMimeTypes.includes(mimeType)) {
        onlyErrorToast(-1, `不支持的文件类型: ${file.name}`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        onlyErrorToast(-1, `文件过大: ${file.name} (最大 5MB)`)
        continue
      }

      const tempId = generateId()
      const preview = mimeType.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined

      pendingAttachments.value.push({
        fileId: tempId,
        fileName: file.name,
        mimeType,
        size: file.size,
        preview,
        uploadStatus: 'uploading',
      })

      try {
        const base64 = await fileToBase64(file)
        const res = await uploadFile(base64, mimeType, file.name)

        if (res.code === 0) {
          const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
          if (index !== -1) {
            const displayUrl = resolveUploadedAttachmentDisplayUrl(res.data, getFileUrl)
            pendingAttachments.value[index] = {
              ...pendingAttachments.value[index],
              fileId: res.data.fileId,
              url: displayUrl,
              localUrl: res.data.localUrl || res.data.url || getFileUrl(res.data.fileId),
              remoteUrl: res.data.remoteUrl || res.data.fileUrl,
              fileUrl: res.data.fileUrl || res.data.remoteUrl,
              preview: undefined,
              uploadStatus: 'uploaded',
            }
          }
          if (preview)
            URL.revokeObjectURL(preview)
        }
        else {
          onlyErrorToast(-1, res.message || '文件上传失败')
          const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
          if (index !== -1)
            pendingAttachments.value.splice(index, 1)
          if (preview)
            URL.revokeObjectURL(preview)
        }
      }
      catch (error) {
        console.error('上传文件失败:', error)
        onlyErrorToast(-1, '文件上传失败，请重试')
        const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
        if (index !== -1)
          pendingAttachments.value.splice(index, 1)
        if (preview)
          URL.revokeObjectURL(preview)
      }
    }
  }

  function removeAttachment(fileId: string) {
    const index = pendingAttachments.value.findIndex(a => a.fileId === fileId)
    if (index !== -1) {
      const attachment = pendingAttachments.value[index]
      if (attachment.preview)
        URL.revokeObjectURL(attachment.preview)
      pendingAttachments.value.splice(index, 1)
    }
  }

  function useGeneratedImageAsReference(image: GeneratedImageInfo) {
    if (isChatting.value)
      return

    const nextAttachment = buildGeneratedAttachment(image, getFileUrl)
    const duplicated = pendingAttachments.value.some(att => att.url === nextAttachment.url)
      || pendingAttachments.value.some(att => att.fileId === nextAttachment.fileId)
    if (duplicated)
      return

    if (pendingAttachments.value.length >= MAX_PENDING_ATTACHMENTS) {
      onlyErrorToast(-1, `最多只能上传 ${MAX_PENDING_ATTACHMENTS} 个文件`)
      return
    }

    pendingAttachments.value.push(nextAttachment)
  }

  // ---- Conversation switching ----

  function formatMessage(data: any): FormattedMessage {
    const isUser = data.role === 'user'

    if (!isUser) {
      if (data.storage_type === 'file' && data.metadata?.source === 'sse_stream' && data.metadata?.assetOptions) {
        const blocks = parseHistorySSE2(data.content || '')
        const messageBlocks = blocks.reduce<typeof blocks>((acc, block) => {
          if (block.type === 'image') {
            const resolvedImages = resolveGeneratedImages(
              (Array.isArray(block.meta?.images) ? block.meta.images as GeneratedImageInfo[] : [])
                .filter(img => !img.isPending)
                .map(img => ({ ...img, prompt: img.prompt || '' })),
              getFileUrl,
            )
            if (resolvedImages.length > 0) {
              acc.push({ ...block, meta: { images: resolvedImages } })
            }
          }
          else {
            acc.push(block)
          }
          return acc
        }, [])
        return {
          id: data.id || generateId(),
          ...aiAvatar,
          mode: data.agent_mode,
          date: formatDate(data.created_at),
          messageBlocks,
          isStreaming: false,
        }
      }

      if (data.metadata?.generatedImages?.length) {
        const revisedPrompt = typeof data.metadata?.revisedPrompt === 'string' && data.metadata.revisedPrompt
          ? data.metadata.revisedPrompt
          : data.content
        const images = Array.isArray(data.metadata.generatedImages)
          ? resolveGeneratedImages(
              data.metadata.generatedImages.map((image: GeneratedImageInfo) => ({
                ...image,
                prompt: image.prompt || revisedPrompt,
              })),
              getFileUrl,
            )
          : []
        const imageBlock: MessageEntryView = { id: '__images__', type: 'image', meta: { images }, text: '', workers: [] }
        return {
          id: data.id || generateId(),
          ...aiAvatar,
          mode: data.agent_mode,
          date: formatDate(data.created_at),
          messageBlocks: revisedPrompt ? [createContentBlock(revisedPrompt), imageBlock] : [imageBlock],
          isStreaming: false,
        }
      }

      const events = parseHistorySSE2(data.content)
      return {
        id: data.id || generateId(),
        ...aiAvatar,
        mode: data.agent_mode,
        date: formatDate(data.created_at),
        messageBlocks: events,
        isStreaming: false,
      }
    }

    const historyAttachments: AttachmentInfo[] | undefined = Array.isArray(data.metadata?.attachments)
      ? data.metadata.attachments.map((att: AttachmentInfo) => ({
          ...att,
          // 历史 attachments 里的 /api/files/{fileId} 是 agent 侧相对路径，
          // 重建时需经 getFileUrl 解析为带 serverUrl 的绝对地址，否则图片加载失败（空白 + alt）
          url: resolveUploadedAttachmentDisplayUrl(att, getFileUrl),
        }))
      : undefined

    return {
      ...userAvatar.value,
      ...data,
      id: data.id || generateId(),
      date: formatDate(data.created_at),
      attachments: historyAttachments,
    }
  }

  function resetChat() {
    abortCurrentStream()
    messageList.value = []
    messageViewer = new MessageViewer()
    todo.value = []
    pendingAttachments.value = []
    pendingScript.value = null
    currentConversation.value = undefined
  }

  async function loadConversation(id: string) {
    if (!id || !userInfo.value) {
      resetChat()
      return
    }

    abortCurrentStream()
    messageViewer = new MessageViewer()
    todo.value = []
    pendingAttachments.value = []

    const res = await conversationDetail(id)
    if (res.code === 0) {
      currentConversation.value = res.data
      inputScene.value = res.data.conversation_type === 'asset' ? 'asset' : 'automation'
      messageList.value = res.data.messages.map(m => markRaw(formatMessage(m)))
      console.log('🚀 ~ loadConversation ~ messageList.value:', toRaw(messageList.value))
      // 自增 token 通知 view 层强制滚底（响应式，无需回调注入）
      scrollToBottomToken.value++
    }
    else {
      messageList.value = []
      currentConversation.value = undefined
    }
  }

  // ---- 初始化 & 销毁 ----

  function init(getActiveId: () => string, opts: UseChatStreamOptions = {}) {
    activeConversationId = getActiveId
    options = opts

    /**
     * 启动会话切换监听
     */
    stopWatcher = watch(
      [() => getActiveId(), userInfo],
      ([newId, _userInfo]) => {
        if (newId && _userInfo) {
          loadConversation(newId)
        }
        else {
          resetChat()
        }
      },
      { immediate: true },
    )
  }

  function destroy() {
    abortCurrentStream()
    stopWatcher?.()
    stopWatcher = null
    activeConversationId = null
    options = {}
  }

  return {
    // State
    mode,
    inputScene,
    assetOptions,
    userMessage,
    isChatting,
    isRecordingProcessing,
    fullAccess,
    todo,
    pendingAttachments,
    pendingScript,
    currentConversation,
    messageList,
    isEmpty,
    // Actions
    sendMessage,
    handleInterrupt,
    handleHitlInterrupt,
    uploadFiles,
    removeAttachment,
    useGeneratedImageAsReference,
    loadConversation,
    resetChat,
    scrollToBottomToken,
    setScrollCallback,
    // Lifecycle
    init,
    destroy,
  }
})
