<script setup lang="ts">
import { useDebounceFn, useElementSize } from '@vueuse/core'
import { getImage } from '/@/utils/basic'
import ChatInput from './chat-input.vue'
import AgentExample from './agent-example.vue'
import { useThemeStore } from '/@/stores/theme'
import type { GeneratedImageInfo, HitlDecision, InputScene } from '/@/views/mcp/types'
import MessageItem from './components/message-item.vue'
import PendingAttachments from './components/pending-attachments.vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import { compare } from 'compare-versions'
import { useChatStreamStore } from '../pinia-store/useChatStreamStore'
import { useAgentStore } from '/@/stores/agent'
import GradientButton from './components/gradient-button.vue'
import { useRouter } from 'vue-router'
import { useAgentApi } from '/@/views/mcp/agent-api'
import type { RecordingStatusData } from '/@/views/mcp/agent-api'
import { extractZipEntry } from './utils/zip-extract'
import { useResponseToast } from '/@/hooks/useResponseToast'

const router = useRouter()
const agentStore = useAgentStore()
const [, onlyErrorToast] = useResponseToast()

function goToSkillsStore() {
  router.push('/mcp/skills-store')
}

const chatStore = useChatStreamStore()
const { userMessage, mode, assetOptions } = storeToRefs(chatStore)
const scene = computed<InputScene>({
  get: () => chatStore.inputScene,
  set: (v) => { chatStore.inputScene = v },
})

const sceneOptions: Array<{ label: string, value: InputScene }> = [
  { label: $t('网页自动化'), value: 'automation' },
  { label: $t('生图生素材'), value: 'asset' },
]

function onSelectScene(value: InputScene) {
  scene.value = value
}

const themeStore = useThemeStore()
const background = computed(() => themeStore.realTheme === 'dark'
  ? getImage('mcp/agent-chat-dark.svg')
  : getImage('mcp/agent-chat-light.svg'))

// ---- 自动滚动 ----
// DynamicScroller 实例：$el 即其内部可滚动根元素，强制滚底时直接操作它
const scrollerRef = useTemplateRef<{ scrollToBottom: () => void, $el?: HTMLElement }>('scroller')
const inputContainerRef = useTemplateRef<HTMLElement>('inputContainer')
const titleBarRef = useTemplateRef<HTMLElement>('titleBar')
const shouldAutoScroll = ref(true)
const INPUT_BOTTOM_OFFSET = 24
const inputContainerSize = reactive(
  useElementSize(inputContainerRef, { width: 0, height: 0 }, { box: 'border-box' }),
)
const titleBarSize = reactive(
  useElementSize(titleBarRef, { width: 0, height: 0 }, { box: 'border-box' }),
)

const containerStyle = computed(() => {
  if (chatStore.isEmpty)
    return undefined

  return {
    paddingTop: `${Math.ceil(titleBarSize.height || 60)}px`,
  }
})

const contentContainerStyle = computed(() => {
  if (chatStore.isEmpty)
    return undefined

  return {
    paddingBottom: `${Math.ceil(inputContainerSize.height) + INPUT_BOTTOM_OFFSET}px`,
  }
})

function onWheel(e: WheelEvent) {
  if (e.deltaY < 0)
    shouldAutoScroll.value = false
}

/**
 * DynamicScroller 的 @scroll 透传为原生 scroll 事件，event.target 即其内部可滚动根元素。
 * 用 event.target 读取，避免再持有独立 ref；距底 < 50px 视为「贴底」，重新启用自动滚动。
 */
function onScroll(e: Event) {
  if (!shouldAutoScroll.value) {
    const el = e.target as HTMLElement | null
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 50)
      shouldAutoScroll.value = true
  }
}

function scrollToBottom() {
  if (!shouldAutoScroll.value)
    return
  const el = scrollerRef.value?.$el as HTMLElement | undefined
  if (el)
    el.scrollTop = el.scrollHeight
}

/**
 * 强制滚底：直接操作滚动容器 DOM，用稳定性轮询跟上 DynamicScroller 的渐进测高。
 *
 * DynamicScroller 的 scrollToBottom() 内部有防重入锁，快速切换时会被吞掉；
 * 且它只跑固定几次 rAF，长列表测高未完成时就停了。
 *
 * 这里改用 epoch 令牌取消旧循环：每次调用时 epoch 自增，旧循环检测到 epoch 变了就退出。
 * 每帧把 scrollTop 顶到 scrollHeight，连续 MAX_STABLE_FRAMES 帧 scrollHeight 不再增长则停止。
 */
let scrollEpoch = 0
const MAX_STABLE_FRAMES = 6
/**
 * 约 2 秒保护上限
 */
const MAX_FRAMES = 120

function forceScrollToBottom() {
  shouldAutoScroll.value = true
  const epoch = ++scrollEpoch

  let lastScrollHeight = -1
  let stableCount = 0
  let frameCount = 0

  function tick() {
    if (epoch !== scrollEpoch)
      return // 已被新的调用取代，退出

    const el = scrollerRef.value?.$el as HTMLElement | undefined
    if (!el) {
      // DOM 未就绪，稍后重试
      requestAnimationFrame(tick)
      return
    }

    el.scrollTop = el.scrollHeight

    frameCount++
    if (el.scrollHeight === lastScrollHeight) {
      stableCount++
    }
    else {
      lastScrollHeight = el.scrollHeight
      stableCount = 0
    }

    if (stableCount < MAX_STABLE_FRAMES && frameCount < MAX_FRAMES)
      requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}

// 对话切换时强制滚底（watch token，由 loadConversation 自增触发）
watch(() => chatStore.scrollToBottomToken, () => {
  forceScrollToBottom()
}, { flush: 'post' })

// 输入框高度变化（ResizeObserver 驱动）防抖，避免缩放/换行时连续触发 nextTick + 滚动
const debouncedScrollToBottom = useDebounceFn(async () => {
  await nextTick()
  scrollToBottom()
}, 80)

watch(() => inputContainerSize.height, debouncedScrollToBottom)

function selectAgentExample(item: any) {
  userMessage.value = item.promptTemplateContent
}

function handleHitlInterrupt(decisions: HitlDecision[]) {
  return chatStore.handleHitlInterrupt(decisions)
}

function handleUseGeneratedImage(image: GeneratedImageInfo) {
  scene.value = 'asset'
  chatStore.useGeneratedImageAsReference(image)
}

function handleSend() {
  forceScrollToBottom()
  chatStore.sendMessage()
}

function isLast(index: number, messageList: any[]) {
  return index === messageList.length - 1
}

const agentApi = useAgentApi()

const recordingData = ref<RecordingStatusData | null>(null)

const recordingUIStatus = computed(() => {
  if (!recordingData.value)
    return 'idle'
  return recordingData.value.status
})

const recordingUIPhase = computed(() => recordingData.value?.phase)

let recordingPollTimer: ReturnType<typeof setInterval> | null = null

function stopRecordingPoll() {
  if (recordingPollTimer) {
    clearInterval(recordingPollTimer)
    recordingPollTimer = null
  }
}

// 录制/enhance 处于进行中的状态：active（录制中）/ processing（生成脚本中）
const RECORDING_ACTIVE_STATUSES = ['active', 'processing']
const RECORDING_TERMINAL_STATUSES = ['done', 'failed', 'cancelled', 'needs_review']

/**
 * 统一写入 recordingData 并同步 chatStore.isRecordingProcessing。
 * 进行中（active/processing）时置 isRecordingProcessing=true，用于阻止切换会话/页面；
 * 终态或无数据时置 false。
 */
function applyRecordingData(data: RecordingStatusData | null) {
  recordingData.value = data
  chatStore.isRecordingProcessing = !!data && RECORDING_ACTIVE_STATUSES.includes(data.status)
}

async function pollRecordingStatus() {
  const conversationId = chatStore.currentConversation?.id
  if (!conversationId)
    return

  try {
    const res = await agentApi.recordingStatus(conversationId)
    if (res.code === 0) {
      const prevStatus = recordingData.value?.status
      applyRecordingData(res.data)

      if (!res.data || RECORDING_TERMINAL_STATUSES.includes(res.data.status)) {
        stopRecordingPoll()
        if (res.data?.status === 'done' && prevStatus !== 'done') {
          await nextTick()
          forceScrollToBottom()
        }
      }
    }
  }
  catch {
    // 网络错误不影响主流程
  }
}

/**
 * 从后端拉取当前会话的录制状态并恢复前端视图。
 * 用于切走再切回（路由重挂载 / 切换会话）后重建 recordingData 与轮询：
 * - 进行中（active/processing）：重建数据 + 重启轮询，恢复"停止生成"入口与进度可见性；
 * - 终态（done/failed/...）：填入数据展示上次结果，不轮询；
 * - 无数据：置 idle。
 */
async function syncRecordingStatus(conversationId?: string) {
  const id = conversationId ?? chatStore.currentConversation?.id
  if (!id) {
    applyRecordingData(null)
    return
  }

  try {
    const res = await agentApi.recordingStatus(id)
    if (res.code !== 0) {
      applyRecordingData(null)
      return
    }
    applyRecordingData(res.data ?? null)
    if (res.data && RECORDING_ACTIVE_STATUSES.includes(res.data.status)) {
      stopRecordingPoll()
      recordingPollTimer = setInterval(pollRecordingStatus, 2000)
    }
    else {
      stopRecordingPoll()
    }
  }
  catch {
    // 拉取失败不影响主流程，保持现有本地状态
  }
}

async function handleStartRecording() {
  const conversationId = chatStore.currentConversation?.id
  if (!conversationId)
    return

  try {
    const res = await agentApi.recordingStart(conversationId)
    if (res.code === 0) {
      applyRecordingData({
        recordingId: res.data.recordingId,
        conversationId: res.data.conversationId,
        status: 'active',
        hasUnsupportedOps: false,
        eventCount: 0,
        createdAt: res.data.createdAt,
      } as RecordingStatusData)
    }
    else {
      console.error('[Recording] Start failed:', res.msg)
    }
  }
  catch (err: any) {
    console.error('[Recording] Start error:', err.message)
  }
}

async function handleStopRecording() {
  const conversationId = chatStore.currentConversation?.id
  if (!conversationId)
    return

  try {
    const res = await agentApi.recordingStop(conversationId)
    if (res.code === 0) {
      if (recordingData.value) {
        applyRecordingData({
          ...recordingData.value,
          status: 'processing',
        })
      }

      stopRecordingPoll()
      recordingPollTimer = setInterval(pollRecordingStatus, 2000)
    }
    else {
      console.error('[Recording] Stop failed:', res.msg)
    }
  }
  catch (err: any) {
    console.error('[Recording] Stop error:', err.message)
  }
}

async function handleStopGeneration() {
  const conversationId = chatStore.currentConversation?.id
  if (!conversationId)
    return

  try {
    const res = await agentApi.recordingCancel(conversationId)
    if (res.code === 0) {
      stopRecordingPoll()
      if (recordingData.value) {
        applyRecordingData({
          ...recordingData.value,
          status: 'cancelled',
        })
      }
    }
    else {
      console.error('[Recording] Cancel generation failed:', res.msg)
    }
  }
  catch (err: any) {
    console.error('[Recording] Cancel generation error:', err.message)
  }
}

async function handleRetryGeneration() {
  const conversationId = chatStore.currentConversation?.id
  if (!conversationId)
    return

  try {
    const res = await agentApi.recordingRetry(conversationId)
    if (res.code === 0) {
      // 本地立即切回 processing 并清空终态字段，重启轮询拿后续 phase/状态
      if (recordingData.value) {
        applyRecordingData({
          ...recordingData.value,
          status: 'processing',
          phase: undefined,
          errorMessage: undefined,
          completedAt: undefined,
          finalScript: undefined,
          finalScriptPath: undefined,
          finalScriptFileId: undefined,
          finalScriptOssUrl: undefined,
        })
      }

      stopRecordingPoll()
      recordingPollTimer = setInterval(pollRecordingStatus, 2000)
    }
    else {
      console.error('[Recording] Retry generation failed:', res.msg)
    }
  }
  catch (err: any) {
    console.error('[Recording] Retry generation error:', err.message)
  }
}

watch(
  () => chatStore.currentConversation?.id,
  (newId) => {
    stopRecordingPoll()
    // 切会话时清空旧状态，并拉取新会话的录制状态以恢复视图（进行中则重启轮询）
    applyRecordingData(null)
    if (newId)
      syncRecordingStatus(newId)
  },
)

// 路由离开 /mcp/chat 去往其他 mcp 子路由时，若录制/enhance 正在进行则阻止切换
onBeforeRouteLeave(() => {
  if (chatStore.isRecordingProcessing) {
    onlyErrorToast(-1, $t('任务进行中，不可操作'))
    return false
  }
  return true
})

onMounted(() => {
  chatStore.setScrollCallback(scrollToBottom)
  // 路由重新挂载（从其他页面切回）时恢复当前会话的录制状态
  syncRecordingStatus()
})

onUnmounted(() => {
  stopRecordingPoll()
  // 组件卸载时复位进行中标志（状态已由后端持有，重挂载时 syncRecordingStatus 恢复）
  chatStore.isRecordingProcessing = false
})

const recordingScriptFileName = computed(() => {
  const title = chatStore.currentConversation?.title || 'recording'
  const safeTitle = title.replace(/[/\\:*?"<>|]/g, '_').substring(0, 40)
  const suffix = recordingData.value?.recordingId?.split('_').pop() || Date.now()
  return `${safeTitle}_${suffix}.ts`
})

const recordingScriptDownloadUrl = computed(() => {
  if (recordingData.value?.finalScriptFileId)
    return agentApi.getFileUrl(recordingData.value.finalScriptFileId, { download: true, fileName: recordingScriptFileName.value })
  if (recordingData.value?.finalScriptOssUrl)
    return recordingData.value.finalScriptOssUrl
  return ''
})

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadRecordingScript() {
  if (recordingScriptDownloadUrl.value) {
    try {
      const res = await fetch(recordingScriptDownloadUrl.value)
      if (res.ok) {
        const buffer = await res.arrayBuffer()
        // 真实产物是单入口 zip（入口名 script.ts）。按下载源后缀决定解压策略：
        //  - .zip：直接解压取出 script.ts；
        //  - .ts（OSS/前端覆盖了文件名）：先检测是否含 zip 头，有则解压，否则当作正常 TS 脚本。
        const sourceExt = getSourceFileExtension(recordingScriptDownloadUrl.value)
        const scriptText = await extractScriptFromBuffer(buffer, sourceExt)
        downloadBlob(new Blob([scriptText], { type: 'text/typescript' }), recordingScriptFileName.value)
        return
      }
    }
    catch {
      if (!recordingData.value?.finalScriptOssUrl || recordingData.value?.finalScriptFileId)
        return
    }
  }

  const script = recordingData.value?.finalScript
  if (!script)
    return

  downloadBlob(new Blob([script], { type: 'text/typescript' }), recordingScriptFileName.value)
}

/** 从下载源 URL 推断真实文件后缀（小写，含点；无法判断时返回空串） */
function getSourceFileExtension(url: string): string {
  try {
    const u = new URL(url)
    const pathname = u.pathname
    const dot = pathname.lastIndexOf('.')
    if (dot < 0)
      return ''
    return pathname.slice(dot).toLowerCase()
  }
  catch {
    // 非标准 URL（如本地 /api/files/:id），按整体取后缀
    const clean = url.split('?')[0].split('#')[0]
    const dot = clean.lastIndexOf('.')
    return dot < 0 ? '' : clean.slice(dot).toLowerCase()
  }
}

/**
 * 从下载到的字节中还原脚本源码。
 * - 后缀 .zip：直接解压取出 `script.ts` 入口。
 * - 后缀 .ts 或未知：先检测 PK 头，是 zip 则解压，否则当作正常 TS 脚本直接返回文本。
 * 解压失败时回退为原始文本，保证下载不中断。
 */
async function extractScriptFromBuffer(buffer: ArrayBuffer, sourceExt: string): Promise<string> {
  const hasZipHeader = buffer.byteLength >= 4
    && new Uint8Array(buffer)[0] === 0x50 // 'P' (PK 头)

  // .zip 后缀直接解压；.ts / 未知后缀仅当检测到 zip 头（PK）时才解压，否则当作正常 TS 脚本
  const shouldUnzip = sourceExt === '.zip' || hasZipHeader
  if (!shouldUnzip)
    return new TextDecoder('utf-8').decode(buffer)

  try {
    return await extractZipEntry(buffer, 'script.ts')
  }
  catch (err: any) {
    console.warn('[Recording] Failed to extract script.ts from zip, fallback to raw text:', err?.message)
    return new TextDecoder('utf-8').decode(buffer)
  }
}
</script>

<template>
  <div class="h-full relative bg-[var(--colors-background-bg-page)]">
    <!-- 背景渐变装饰 -->
    <img v-if="chatStore.isEmpty" class="absolute size-full z-1 object-cover object-center" :src="background">

    <!-- 有内容时 DynamicScroller 是唯一滚动容器，外层不能再滚动（消除嵌套滚动） -->
    <div class="flex flex-col items-center h-full relative z-2 gap-6" :class="chatStore.isEmpty ? 'pt-9 overflow-y-auto' : 'overflow-hidden'" :style="containerStyle">
      <!-- 标题栏，粘性布局 -->
      <div
        v-if="!chatStore.isEmpty"
        ref="titleBar"
        class="w-full h-15 flex items-center px-6 z-2 absolute top-0"
        :class="chatStore.isEmpty ? '' : 'border-b-solid border border-[var(--colors-border-border-inactive)]'"
      >
        <div class="font-semibold text-[var(--colors-text-text-primary)] text-lg truncate">
          {{ chatStore.currentConversation?.title }}
        </div>
      </div>

      <!-- Label -->
      <!-- <div v-if="chatStore.isEmpty" class="px-3 py-1.5 rounded-full bg-[linear-gradient(100deg,#3FAAF6_0%,#F359DC_50%,#F28FB0_100%)]">
        <p class="m-0 font-[Archivo] text-[var(--component-button-primary-text)] text-13px font-600">
          {{ $t('全球首个指纹浏览器 AI Agent') }}
        </p>
      </div> -->

      <template v-if="chatStore.isEmpty">
        <!-- 主标题 -->
        <div class="text-center flex-col flex items-center gap-6">
          <div class="font-['Archivo'] font-700 text-[var(--colors-text-text-primary)] text-9 leading-[44px]">
            <p class="m-0">
              {{ $t('Roxy AI Agent, 您的数字员工') }}
            </p>
          </div>

          <div v-if="compare($appVersion, '3.8.7', '>=')" class="inline-flex items-center gap-1 w-fit p-1 rounded-[12px] bg-[linear-gradient(100deg,rgba(63,170,246,0.12)_0%,rgba(243,89,220,0.12)_50%,rgba(242,143,176,0.12)_100%)] backdrop-blur-[8px]">
            <button
              v-for="item in sceneOptions"
              :key="item.value"
              type="button"
              class="inline-flex items-center justify-center px-3 py-1.5 border-0 rounded-lg cursor-pointer transition-[background-color,box-shadow] duration-200 ease-in-out"
              :class="scene === item.value ? 'bg-[var(--colors-background-bg-page)] shadow-[0_1px_1px_rgba(0,0,0,0.06)] is-gradient font-700' : 'bg-transparent'"
              @click="onSelectScene(item.value)"
            >
              <span
                class="text-[var(--colors-text-text-primary)] text-[14px] leading-[20px]"
                :class="scene === item.value ? 'bg-[linear-gradient(101deg,#3faaf6_-10.13%,#f359dc_44.94%,#f28fb0_100%)] bg-clip-text text-transparent' : ''"
              >
                {{ item.label }}
              </span>
            </button>
          </div>
        </div>

        <GradientButton :border-radius="9999" :colors="['#3FAAF6', '#ffe7ef', '#F359DC']">
          <div class="flex justify-between items-center gap-15 cursor-pointer" @click="goToSkillsStore">
            <div class="flex gap-2 items-center">
              <div class="size-5">
                <img :src="getImage('mcp/rx_ic_flame.png')" class="w-full">
              </div>
              <p class="text-[var(--colors-text-text-primary)] font-[Archivo] my-0 text-14px">
                {{ $t('Skills 商城：TK / 亚马逊 / 跨境运营技能包一键安装，助你提效拓客') }}
              </p>
            </div>

            <div class="text-[var(--colors-text-text-brand)] font-3 flex gap-1 items-center text-3 font-500 leading-20px">
              {{ $t('去体验') }}
              <SvgIcon name="base/rx_ic_arrow_right" color="var(--colors-text-text-brand)" />
            </div>
          </div>
        </GradientButton>
      </template>

      <DynamicScroller
        v-else
        ref="scroller"
        :items="chatStore.messageList"
        :min-item-size="80"
        key-field="id"
        class="w-full flex-1 min-h-0 pl-1.5"
        :style="[contentContainerStyle, { willChange: 'transform' }]"
        :class="chatStore.isEmpty ? '' : 'pt-8'"
        @scroll="onScroll"
        @wheel="onWheel"
      >
        <template #default="{ item, index, active }">
          <!-- active 必须透传：DynamicScrollerItem 据此判断自己是否在可视池中并触发测高 -->
          <DynamicScrollerItem :item="item" :active="active" :data-index="index">
            <!-- content-visibility: auto 让屏外节点跳过 layout/paint；contain-intrinsic-size 给浏览器估算高度 -->
            <div class="w-full max-w-[640px] mx-auto pb-6" style="content-visibility: auto; contain-intrinsic-size: auto 120px">
              <div class="flex items-start self-stretch gap-2">
                <RxAvatar class="border border-[var(--colors-border-border-inactive)] rounded-full" :avatar="item.avatar" :color="item.color" :name="item.name" :size="32" :font-size="16" />
                <div class="flex-1 flex flex-col gap-3 overflow-hidden">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[var(--colors-text-text-placeholder)] text-3 font-bold leading-[16px]">{{ item.userName }}</span>
                    <span class="text-[var(--colors-text-text-inactive)] text-3 leading-[16px]">{{ item.date }}</span>
                  </div>
                  <MessageItem
                    v-if="item.role === 'assistant'"
                    :item="item"
                    :handle-hitl-interrupt="handleHitlInterrupt"
                    :conversation-type="chatStore.currentConversation?.conversation_type"
                    :is-chatting="chatStore.isChatting"
                    :is-last="isLast(index, chatStore.messageList)"
                    @use-reference="handleUseGeneratedImage"
                  />
                  <div v-else class="flex flex-col gap-5">
                    <div class="whitespace-pre-line text-[var(--colors-text-text-primary)] text-3.5 leading-[1.4]">
                      {{ item.content }}
                    </div>
                    <div v-if="item.attachments?.length" class="flex flex-col gap-2 max-w-185px">
                      <PendingAttachments :attachments="item.attachments" :conversation-type="chatStore.currentConversation?.conversation_type" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DynamicScrollerItem>
        </template>

        <template #after>
          <div
            v-if="recordingData?.status === 'done' && (recordingData.finalScript || recordingData.finalScriptFileId || recordingData.finalScriptOssUrl)"
            class="w-full max-w-[640px] mx-auto pb-6 px-1.5"
          >
            <div class="flex items-start gap-2">
              <div class="w-8 h-8 shrink-0" />
              <div class="flex-1 rounded-2 border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-block)] overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--colors-border-border-inactive)]">
                  <SvgIcon name="base/rx_ic_doc_api" size="16" color="var(--colors-icon-icon-brand)" class="shrink-0" />
                  <span class="flex-1 text-3.5 font-500 text-[var(--colors-text-text-primary)] truncate">
                    {{ recordingScriptFileName }}
                  </span>
                  <span class="text-3 text-[var(--colors-text-text-tertiary)] shrink-0">
                    {{ $t('自动化脚本') }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3 py-2">
                  <span class="text-3 text-[var(--colors-text-text-secondary)]">
                    {{ $t('录制完成，脚本已生成') }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 h-7 px-3 border-0 rounded-[31px] bg-[var(--colors-brand-brand-default)] text-white text-3 leading-5 cursor-pointer hover:opacity-90 transition-opacity duration-150 shrink-0"
                    @click="downloadRecordingScript"
                  >
                    <SvgIcon name="base/rx_ic_download" size="14" color="white" />
                    {{ $t('下载脚本') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </DynamicScroller>

      <!-- 输入框 -->
      <div ref="inputContainer" class="max-w-[640px] w-full rounded-2" :class="[chatStore.isEmpty ? '' : 'mt-2.5 absolute left-1/2 transform -translate-x-1/2 bottom-0']">
        <ChatInput
          v-model:mode="mode"
          v-model:scene="scene"
          v-model:asset-options="assetOptions"
          v-model="userMessage"
          :pending-attachments="chatStore.pendingAttachments"
          :pending-script="chatStore.pendingScript"
          :conversation-id="chatStore.currentConversation?.id"
          :is-chatting="chatStore.isChatting"
          :health="{ isReady: agentStore.isReady, loading: agentStore.health.loading }"
          :todo="chatStore.todo"
          :recording-status="recordingUIStatus"
          :recording-phase="recordingUIPhase"
          @send-message="handleSend"
          @stop="chatStore.handleInterrupt()"
          @upload-files="(files) => chatStore.uploadFiles(files)"
          @remove-attachment="(fileId) => chatStore.removeAttachment(fileId)"
          @remove-script="chatStore.pendingScript = null"
          @start-recording="handleStartRecording"
          @stop-recording="handleStopRecording"
          @stop-generation="handleStopGeneration"
          @retry-generation="handleRetryGeneration"
        />
        <div v-if="!chatStore.isEmpty" class="h-6 bg-[var(--colors-background-bg-page)]" />
      </div>

      <div v-if="chatStore.isEmpty && scene === 'automation'" class="max-w-[640px] w-full pb-10">
        <AgentExample @select="selectAgentExample" />
      </div>
    </div>
  </div>
</template>
