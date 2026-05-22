import { computed, nextTick, onUnmounted, ref, toRaw, watch } from 'vue'
import { getImage } from '/@/utils/basic'
import { format } from 'date-fns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useAgentStore } from '/@/stores/agent'
import { fetchSSE, MessageViewer, parseHistorySSE2 } from '/@/views/mcp/util'
import { useAgentApi } from '../agent-api'
import type { ConversationDetail } from '../agent-api'
import type { AssetGenerationOptions, AttachmentInfo, AvatarInfo, FormattedMessage, GeneratedImageInfo, HitlDecision, InputScene, MessageEntryView, SSEEventData, Todo, WorkerStatus } from '/@/views/mcp/types'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf', 'text/plain']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_PENDING_ATTACHMENTS = 5
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

function createContentBlock(text: string): MessageEntryView {
  return {
    id: `content-${generateId()}`,
    type: 'content',
    text,
    meta: {},
    workers: [],
  }
}

function createErrorBlock(text: string): MessageEntryView {
  return {
    id: `error-${generateId()}`,
    type: 'error',
    text,
    meta: {},
    workers: [],
  }
}

function buildGeneratedAttachment(image: GeneratedImageInfo): AttachmentInfo {
  return {
    fileId: image.fileId,
    fileName: image.fileName,
    mimeType: image.mimeType || 'image/png',
    size: image.size || 0,
    url: image.url || '',
    source: 'generated',
  }
}

function resolveGeneratedImages(images: GeneratedImageInfo[], getFileUrl: (fileId: string) => string) {
  return images.map(image => ({
    ...image,
    url: image.url || getFileUrl(image.fileId),
  }))
}

export interface UseChatStreamOptions {
  onUpdateTitle?: (conversationId: string, title: string) => void
  onCreateConversation?: (data: ConversationDetail) => void
}

export function useChatStream(
  activeConversationId: () => string,
  options: UseChatStreamOptions = {},
) {
  const [, onlyErrorToast] = useResponseToast()
  const { mixpanelTrack } = useUserStore()
  const { userInfo } = storeToRefs(useUserStore())
  const agentStore = useAgentStore()
  const { conversationDetail, conversationStop, conversationResume, uploadFile, getFileUrl, conversationCreate, generateImages } = useAgentApi()

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
  const activeRequestKind = ref<'chat' | 'image' | null>(null)
  const todo = ref<Todo[]>([])
  const pendingAttachments = ref<AttachmentInfo[]>([])
  const pendingScript = ref<any>(null)
  const currentConversation = ref<ConversationDetail>()
  const messageList = ref<any[]>([])
  const isEmpty = computed(() => messageList.value.length === 0)
  /** 当前正在生成图片的提示词，供 handleSSEEvent 中的 image_partial/image_done 使用 */
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
  let scrollCallback: (() => void) | null = null

  function setScrollCallback(cb: () => void) {
    scrollCallback = cb
  }

  function updateStream() {
    const currentMessage = messageList.value[messageList.value.length - 1]
    if (currentMessage) {
      currentMessage.isStreaming = true
      currentMessage.messageBlocks = messageViewer.view()
      todo.value = messageViewer.viewTodo()
    }
    nextTick(() => scrollCallback?.())
  }

  function handleSSEEvent(event: any) {
    const eventData = event.json as SSEEventData | null
    if (!eventData)
      return

    const { type, data, timestamp } = eventData

    switch (type) {
      case 'thinking':
        messageViewer.add(data?.thinkingId || '', 'thinking', data?.text || '', timestamp)
        updateStream()
        break

      case 'content':
        messageViewer.add(data?.contentId || '', 'content', data?.text || '', timestamp)
        updateStream()
        break

      case 'tool_call':
        if (data?.taskId) {
          messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_call', data)
        }
        else {
          messageViewer.add(data?.toolId || '', 'tool_call', data)
        }
        updateStream()
        break

      case 'tool_result':
        if (data?.taskId) {
          messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_result', data)
        }
        else {
          messageViewer.add(data?.toolId || '', 'tool_result', data)
        }
        updateStream()
        break

      case 'worker_thinking':
        messageViewer.addWorkerEntry(data?.taskId || '', data?.thinkingId || '', 'worker_thinking', data?.text || '', timestamp)
        updateStream()
        break

      case 'worker_content':
        messageViewer.addWorkerEntry(data?.taskId || '', data?.contentId || '', 'worker_content', data?.text || '', timestamp)
        updateStream()
        break

      case 'worker_result':
        messageViewer.setWorkerStatus(data?.taskId || '', (data?.status || 'success') as WorkerStatus)
        updateStream()
        break

      case 'todo':
        messageViewer.add(type, type, data, timestamp)
        updateStream()
        break

      case 'error':
        messageViewer.add(type, type, data, timestamp)
        updateStream()
        isChatting.value = false
        break

      case 'interrupt':
        messageViewer.add(type, type, '', timestamp)
        updateStream()
        isChatting.value = false
        break

      case 'hitl_interrupt':
        messageViewer.add(data?.interruptsId, 'hitl_interrupt', data, timestamp)
        updateStream()
        break

      case 'hitl_resume':
        if (data?.interruptsId) {
          messageViewer.add(data.interruptsId, 'hitl_interrupt', { decisions: data.decisions }, timestamp)
          updateStream()
        }
        break

      case 'done':
        if (activeRequestKind.value === 'image') {
          messageViewer.remove('__processing__')
          // 清除仍处于 pending 状态的占位（生成失败或数量不足时）
          messageViewer.finalizeImages('__images__')
        }
        updateStream()
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
            ...image,
            url: image.url || getFileUrl(image.fileId),
            prompt: currentImagePrompt.value,
          })
          updateStream()
        }
        break
      }

      case 'title':
        if (data?.title && currentConversation.value) {
          currentConversation.value.title = data.title
          options.onUpdateTitle?.(activeConversationId(), data.title)
        }
        break
    }
  }

  // ---- Actions ----

  async function sendMessage(script?: any) {
    const isAssetScene = inputScene.value === 'asset'
    const rawMessage = userMessage.value
    const outgoingMessage = rawMessage
    const outgoingMode = isAssetScene ? 'simple' : mode.value
    const hasText = outgoingMessage.trim().length > 0
    const hasAttachments = pendingAttachments.value.length > 0
    if (isChatting.value || (!hasText && !hasAttachments))
      return

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
    }))

    messageList.value.push({
      ...userAvatar.value,
      mode: outgoingMode,
      date: formatDate(new Date()),
      attachments: displayAttachments.length ? displayAttachments : undefined,
      content: msg,
    })

    messageList.value.push({
      ...aiAvatar,
      mode: outgoingMode,
      date: formatDate(new Date()),
      messageBlocks: [],
      isStreaming: true,
    })

    isChatting.value = true
    messageViewer = new MessageViewer()
    abortController = new AbortController()

    if (isAssetScene) {
      activeRequestKind.value = 'image'
      currentImagePrompt.value = outgoingMessage

      messageViewer.add('__processing__', 'content', $t('好的，已接收到用户需求，任务执行中...'), Date.now())
      nextTick(() => scrollCallback?.())

      fetchSSE(`${agentStore.serverUrl}/api/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          message: outgoingMessage,
          conversationId: currentConversation.value!.id,
          attachments: attachmentsToSend.map(({ fileId, fileName, mimeType, size, url }) => ({ fileId, fileName, mimeType, size, url })),
          assetOptions: assetOptions.value,
        }),
        onEvent: (event) => {
          handleSSEEvent(event)
        },
        onError: (error: any) => {
          messageViewer.remove('__processing__')
          messageViewer.finalize()
          if (error?.name === 'AbortError') {
            messageViewer.add('error', 'error', 'Image generation cancelled')
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
        attachments: attachmentsToSend.map(({ fileId, fileName, mimeType, size, url }) => ({ fileId, fileName, mimeType, size, url })),
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
    })
  }

  function handleInterrupt() {
    if (activeRequestKind.value === 'image') {
      abortCurrentStream()
      return
    }
    conversationStop(activeConversationId() || currentConversation.value?.id || '')
  }

  function handleHitlInterrupt(decisions: HitlDecision[]) {
    return conversationResume(activeConversationId() || currentConversation.value?.id || '', decisions)
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

      if (!allowedMimeTypes.includes(file.type)) {
        onlyErrorToast(-1, `不支持的文件类型: ${file.name}`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        onlyErrorToast(-1, `文件过大: ${file.name} (最大 5MB)`)
        continue
      }

      const tempId = generateId()
      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined

      pendingAttachments.value.push({
        fileId: tempId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        preview,
      })

      try {
        const base64 = await fileToBase64(file)
        const res = await uploadFile(base64, file.type, file.name)

        if (res.code === 0) {
          const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
          if (index !== -1) {
            pendingAttachments.value[index] = {
              ...pendingAttachments.value[index],
              fileId: res.data.fileId,
              url: getFileUrl(res.data.fileId),
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

    const nextAttachment = buildGeneratedAttachment(image)
    const duplicated = pendingAttachments.value.some(att => att.url === nextAttachment.url)
      || pendingAttachments.value.some(att => att.fileId === nextAttachment.fileId)
    if (duplicated)
      return

    if (pendingAttachments.value.length >= MAX_PENDING_ATTACHMENTS) {
      onlyErrorToast(-1, `最多只能上传 ${MAX_PENDING_ATTACHMENTS} 个文件`)
      return
    }

    pendingAttachments.value.push(nextAttachment)
    // if (!userMessage.value.trim() && image.prompt) {
    //   userMessage.value = image.prompt
    // }
  }

  // ---- Conversation switching ----

  function formatMessage(data: any): FormattedMessage {
    const isUser = data.role === 'user'

    if (!isUser) {
      // 图片生成的 SSE 文件（新格式）
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
          ...aiAvatar,
          mode: data.agent_mode,
          date: formatDate(data.created_at),
          messageBlocks,
          isStreaming: false,
        }
      }

      // 旧格式：metadata 里直接存了 generatedImages
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
          ...aiAvatar,
          mode: data.agent_mode,
          date: formatDate(data.created_at),
          messageBlocks: revisedPrompt ? [createContentBlock(revisedPrompt), imageBlock] : [imageBlock],
          isStreaming: false,
        }
      }

      const events = parseHistorySSE2(data.content)
      return {
        ...aiAvatar,
        mode: data.agent_mode,
        date: formatDate(data.created_at),
        messageBlocks: events,
        isStreaming: false,
      }
    }

    return {
      ...userAvatar.value,
      ...data,
      date: formatDate(data.created_at),
      attachments: data.metadata?.attachments,
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
    // pendingScript.value = null

    const res = await conversationDetail(id)
    if (res.code === 0) {
      currentConversation.value = res.data
      inputScene.value = res.data.conversation_type === 'asset' ? 'asset' : 'automation'
      messageList.value = res.data.messages.map(formatMessage)
      console.log('🚀 ~ loadConversation ~ messageList.value:', toRaw(messageList.value))
      nextTick(() => scrollCallback?.())
    }
    else {
      messageList.value = []
      currentConversation.value = undefined
    }
  }

  // Watch for conversation changes
  watch(
    [activeConversationId, userInfo],
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

  // Cleanup on unmount
  onUnmounted(() => {
    abortCurrentStream()
  })

  return {
    // State
    mode,
    inputScene,
    assetOptions,
    userMessage,
    isChatting,
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
    // Scroll integration
    setScrollCallback,
  }
}
