<script setup lang="ts">
import { useDebounceFn, useElementSize } from '@vueuse/core'
import { getImage } from '/@/utils/basic'
import ChatInput from './chat-input.vue'
import AgentExample from './agent-example.vue'
import { useThemeStore } from '/@/stores/theme'
import type { GeneratedImageInfo, HitlDecision, InputScene } from '/@/views/mcp/types'
import MessageItem from './components/message-item.vue'
import PendingAttachments from './components/pending-attachments.vue'
import { compare } from 'compare-versions'
import { useChatStreamStore } from '../pinia-store/useChatStreamStore'
import { useAgentStore } from '/@/stores/agent'
import GradientButton from './components/gradient-button.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const agentStore = useAgentStore()

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
const scrollContainerRef = useTemplateRef<HTMLElement>('scrollContainer')
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

function onScroll() {
  if (!shouldAutoScroll.value) {
    const el = scrollContainerRef.value
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 50)
      shouldAutoScroll.value = true
  }
}

function scrollToBottom() {
  if (!shouldAutoScroll.value)
    return
  requestAnimationFrame(() => {
    const el = scrollContainerRef.value
    if (el)
      el.scrollTop = el.scrollHeight
  })
}

onMounted(() => {
  chatStore.setScrollCallback(scrollToBottom)
})

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

function isLast(index: number, messageList: any[]) {
  return index === messageList.length - 1
}
</script>

<template>
  <div class="h-full relative bg-[var(--colors-background-bg-page)]">
    <!-- 背景渐变装饰 -->
    <img v-if="chatStore.isEmpty" class="absolute size-full z-1 object-cover object-center" :src="background">

    <div class="flex flex-col items-center h-full relative z-2 gap-6 overflow-y-auto" :class="chatStore.isEmpty ? 'pt-9' : ''" :style="containerStyle">
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

      <div
        v-else
        ref="scrollContainer"
        class="w-full flex-1 min-h-0 w-full pl-1.5 overflow-y-auto will-change-auto"
        :style="contentContainerStyle"
        :class="chatStore.isEmpty ? '' : 'pt-8'"
        @scroll="onScroll"
        @wheel="onWheel"
      >
        <div class="w-full flex flex-col mx-auto gap-6 max-w-[640px]">
          <div v-for="(item, index) in chatStore.messageList" :key="item.id" class="flex items-start self-stretch gap-2">
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
      </div>

      <!-- 输入框 -->
      <div ref="inputContainer" class="max-w-[640px] w-full rounded-2" :class="[chatStore.isEmpty ? '' : 'mt-2.5 absolute left-1/2 transform -translate-x-1/2 bottom-0']">
        <ChatInput
          v-model:mode="mode"
          v-model:scene="scene"
          v-model:asset-options="assetOptions"
          v-model="userMessage"
          :pending-attachments="chatStore.pendingAttachments"
          :pending-script="chatStore.pendingScript"
          :is-chatting="chatStore.isChatting"
          :health="{ isReady: agentStore.isReady, loading: agentStore.health.loading }"
          :todo="chatStore.todo"
          @send-message="chatStore.sendMessage()"
          @stop="chatStore.handleInterrupt()"
          @upload-files="(files) => chatStore.uploadFiles(files)"
          @remove-attachment="(fileId) => chatStore.removeAttachment(fileId)"
          @remove-script="chatStore.pendingScript = null"
        />
        <div v-if="!chatStore.isEmpty" class="h-6 bg-[var(--colors-background-bg-page)]" />
      </div>

      <div v-if="chatStore.isEmpty && scene === 'automation'" class="max-w-[640px] w-full pb-10">
        <AgentExample @select="selectAgentExample" />
      </div>
    </div>
  </div>
</template>
