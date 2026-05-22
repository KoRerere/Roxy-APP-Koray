<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import ChatInput from './chat-input.vue'
import AgentExample from './agent-example.vue'
import { useThemeStore } from '/@/stores/theme'
import type { ConversationDetail } from './agent-api'
import type { AssetGenerationOptions, AttachmentInfo, GeneratedImageInfo, HitlDecision, InputScene, Todo } from '/@/views/mcp/types'
import MessageItem from '/@/views/mcp/components/message-item.vue'
import PendingAttachments from '/@/views/mcp/components/pending-attachments.vue'
import { compare } from 'compare-versions'
import { useUserStore } from '/@/stores/user'

withDefaults(defineProps<{
  messageList: any[]
  isChatting: boolean
  todo?: Todo[]
  pendingAttachments: AttachmentInfo[]
  pendingScript?: any
  currentConversation?: ConversationDetail
  isEmpty: boolean
  uninitialized?: boolean
}>(), {
  todo: () => [],
})

const emit = defineEmits<{
  (e: 'sendMessage'): void
  (e: 'interrupt'): void
  (e: 'hitlInterrupt', decisions: HitlDecision[]): void
  (e: 'uploadFiles', files: File[]): void
  (e: 'removeAttachment', fileId: string): void
  (e: 'removeScript'): void
  (e: 'setScrollCallback', cb: () => void): void
  (e: 'useGeneratedImage', image: GeneratedImageInfo): void
}>()

const userMessage = defineModel<string>('userMessage', { default: '' })
const mode = defineModel<'orchestrator' | 'simple'>('mode', { default: 'simple' })
const scene = defineModel<InputScene>('scene', { default: 'automation' })
const assetOptions = defineModel<AssetGenerationOptions>('assetOptions', {
  default: () => ({
    aspectRatio: '1:1',
    quality: '2K',
    count: '1张',
  }),
})
const userStore = useUserStore()

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
const sentinelRef = useTemplateRef<HTMLElement>('scrollSentinel')
const scrollContainerRef = useTemplateRef<HTMLElement>('scrollContainer')
const isAtBottom = ref(true)

function onScroll() {
  const el = scrollContainerRef.value
  if (!el)
    return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

function scrollToBottom() {
  if (!isAtBottom.value)
    return
  sentinelRef.value?.scrollIntoView({ block: 'end' })
}

onMounted(() => {
  emit('setScrollCallback', scrollToBottom)
})

function selectAgentExample(item: any) {
  userMessage.value = item.promptTemplateContent
}

function handleHitlInterrupt(decisions: HitlDecision[]) {
  return emit('hitlInterrupt', decisions)
}

function handleUseGeneratedImage(image: GeneratedImageInfo) {
  scene.value = 'asset'
  emit('useGeneratedImage', image)
}

function isLast(index: number, messageList: any[]) {
  return index === messageList.length - 1
}
</script>

<template>
  <div class="h-full relative bg-[var(--colors-background-bg-page)]" style="will-change: transform;">
    <!-- 背景渐变装饰 -->
    <img v-if="isEmpty" class="absolute size-full z-1 object-cover object-center" :src="background">

    <div class="flex flex-col items-center h-full relative z-2 overflow-y-auto" :class="isEmpty ? 'pt-9' : 'pt-24 pb-6'">
      <!-- 标题栏，粘性布局 -->
      <div v-if="!isEmpty" class="w-full h-15 flex items-center px-6 z-2 absolute top-0" :class="isEmpty ? '' : 'border-b-solid border border-[var(--colors-border-border-inactive)]'">
        <div class="font-['Inter'] font-semibold text-[var(--colors-text-text-primary)] text-lg truncate">
          {{ currentConversation?.title }}
        </div>
      </div>

      <!-- Label -->
      <div v-if="isEmpty" class="px-3 py-1.5 rounded-full bg-[linear-gradient(100deg,#3FAAF6_0%,#F359DC_50%,#F28FB0_100%)]">
        <p class="m-0 font-[Archivo] text-[var(--component-button-primary-text)] text-13px font-600">
          {{ $t('全球首个指纹浏览器 AI Agent') }}
        </p>
      </div>

      <!-- 主标题 -->
      <div v-if="isEmpty" class="text-center mt-3 flex-col flex items-center gap-6">
        <div class="font-['Archivo'] font-700 text-[var(--colors-text-text-primary)] text-9 leading-[44px]">
          <p class="m-0">
            {{ $t('Roxy AI Agent, 您的数字员工') }}
          </p>
        </div>

        <div v-if="compare(userStore.appVersion, '3.8.7', '>=')" class="scene-switch">
          <button
            v-for="item in sceneOptions"
            :key="item.value"
            type="button"
            class="scene-switch__item"
            :class="{ 'is-active is-gradient font-700': scene === item.value }"
            @click="onSelectScene(item.value)"
          >
            <span
              class="scene-switch__label"
              :class="{ 'scene-switch__label--gradient': scene === item.value }"
            >
              {{ item.label }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-else
        ref="scrollContainer"
        class="overflow-y-auto w-full flex-1 min-h-0"
        style="will-change: transform;"
        @scroll="onScroll"
      >
        <div class="w-full flex flex-col mx-auto gap-6 max-w-[584px]">
          <div v-for="(item, index) in messageList" :key="index" class="flex items-start self-stretch gap-2">
            <RxAvatar class="user-avatar" :avatar="item.avatar" :color="item.color" :name="item.name" :size="32" :font-size="16" />
            <div class="flex-1 flex flex-col gap-3 overflow-hidden">
              <div class="flex items-center justify-between gap-2">
                <span class="user-name">{{ item.userName }}</span>
                <span class="user-date">{{ item.date }}</span>
              </div>
              <MessageItem
                v-if="item.role === 'assistant'"
                :item="item"
                :handle-hitl-interrupt="handleHitlInterrupt"
                :conversation-type="currentConversation?.conversation_type"
                :is-chatting="isChatting"
                :is-last="isLast(index, messageList)"
                @use-reference="handleUseGeneratedImage"
              />
              <div v-else class="flex flex-col gap-5">
                <div class="whitespace-pre-line text-[var(--colors-text-text-primary)] text-3.5 leading-[1.4]">
                  {{ item.content }}
                </div>
                <div v-if="item.attachments?.length" class="flex flex-col gap-2 max-w-185px">
                  <PendingAttachments :attachments="item.attachments" :conversation-type="currentConversation?.conversation_type" />
                </div>
              </div>
            </div>
          </div>
          <!-- 哨兵元素 -->
          <div ref="scrollSentinel" class="h-px" />
        </div>
      </div>

      <!-- 输入框 -->
      <div class="max-w-[584px] w-full rounded-2" :class="[isEmpty ? 'mt-6' : 'mt-2.5']">
        <ChatInput
          v-model:mode="mode"
          v-model:scene="scene"
          v-model:asset-options="assetOptions"
          v-model="userMessage"
          :pending-attachments="pendingAttachments"
          :pending-script="pendingScript"
          :is-chatting="isChatting"
          :health="{ isOk: true, loading: false }"
          :todo="todo"
          :uninitialized
          @send-message="emit('sendMessage')"
          @stop="emit('interrupt')"
          @upload-files="(files) => emit('uploadFiles', files)"
          @remove-attachment="(fileId) => emit('removeAttachment', fileId)"
          @remove-script="emit('removeScript')"
        />
      </div>

      <div v-if="isEmpty && scene === 'automation'" class="max-w-[584px] w-full mt-5 pb-10">
        <AgentExample @select="selectAgentExample" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user {
  &-avatar {
    border: 1px solid var(--colors-border-border-inactive);
    border-radius: 50%;
  }

  &-name {
    color: var(--colors-text-text-placeholder);
    font-size: 12px;
    font-weight: 700;
    line-height: 16px;
  }

  &-date {
    color: var(--colors-text-text-inactive);
    font-size: 12px;
    line-height: 16px;
  }
}

.scene-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 4px;
  border-radius: 12px;
  background: linear-gradient(
    100deg,
    rgba(63, 170, 246, 0.12) 0%,
    rgba(243, 89, 220, 0.12) 50%,
    rgba(242, 143, 176, 0.12) 100%
  );
  backdrop-filter: blur(8px);

  &__item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;

    &.is-active {
      background: var(--colors-background-bg-page);
      box-shadow: 0 1px 1px rgb(0 0 0 / 6%);
    }
  }

  &__label {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 20px;

    &--gradient {
      background: linear-gradient(101deg, #3faaf6 -10.13%, #f359dc 44.94%, #f28fb0 100%);
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
}

.conversation-type {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--colors-border-border-action);
  border-radius: 999px;
  background: var(--colors-background-bg-action);
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 16px;

  &--asset {
    border-color: color-mix(in srgb, #f359dc 30%, var(--colors-border-border-action));
    color: #d53db8;
  }
}
</style>
