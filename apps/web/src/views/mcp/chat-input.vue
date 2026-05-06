<script setup lang="ts">
import { motion } from 'motion-v'
import PendingAttachments from '/@/views/mcp/components/pending-attachments.vue'
import type { AttachmentInfo, Todo } from '/@/views/mcp/types'

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf', 'text/plain']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_PENDING_ATTACHMENTS = 5

interface Props {
  health: {
    isOk: boolean
    loading: boolean
  }
  isChatting: boolean
  pendingAttachments: (AttachmentInfo & { preview?: string })[]
  todo?: Todo[]
  class?: string
  uninitialized: boolean
}

interface Emits {
  (e: 'sendMessage'): void
  (e: 'stop'): void
  (e: 'uploadFiles', files: File[]): void
  (e: 'removeAttachment', fileId: string): void
  (e: 'changeMode', value: 'orchestrator' | 'simple'): void
}

const message = defineModel<string>()
const mode = defineModel<'orchestrator' | 'simple'>('mode')

const isDraggingOver = ref(false)
const todoExpanded = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isComposing = ref(false)

function onClickUpload() {
  if (props.pendingAttachments.length >= MAX_PENDING_ATTACHMENTS)
    return
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length > 0)
    emit('uploadFiles', files)
  input.value = ''
}

function onDragOver(event: DragEvent) {
  if (!props.health.isOk || props.isChatting)
    return
  event.preventDefault()
  isDraggingOver.value = true
}

function onDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null
  if (related && (event.currentTarget as HTMLElement).contains(related))
    return
  isDraggingOver.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  isDraggingOver.value = false
  if (!props.health.isOk || props.isChatting)
    return

  const files = Array.from(event.dataTransfer?.files ?? [])
  emit('uploadFiles', files)
}

function onSendMessage() {
  emit('sendMessage')
}

function onStop() {
  emit('stop')
}

function onChangeMode(value: 'orchestrator' | 'simple') {
  mode.value = value
  emit('changeMode', value)
}

function removePendingAttachment(fileId: string) {
  emit('removeAttachment', fileId)
}

function onCompositionStart() {
  isComposing.value = true
}

function onCompositionEnd() {
  isComposing.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !isComposing.value) {
    event.preventDefault()
    onSendMessage()
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- 附件预览区域 -->
    <div v-if="pendingAttachments.length" class="flex flex-wrap gap-2">
      <PendingAttachments
        :attachments="pendingAttachments"
        :on-remove="removePendingAttachment"
      />
    </div>

    <div
      v-if="todo && todo.length > 0"
      class="bg-[var(--colors-background-bg-block)] rounded-2 p-3 w-full relative cursor-pointer"
      :class="{ 'pb-4': todoExpanded }"
      @click="todoExpanded = !todoExpanded"
    >
      <div class="flex justify-between items-center cursor-pointer select-none">
        <span class="text-3 leading-4 font-500 text-[var(--colors-text-text-primary)]">Agent's todo List</span>
        <motion.div
          :animate="{ rotate: todoExpanded ? 0 : 180 }"
          :transition="{ duration: 0.25, ease: 'easeInOut' }"
          class="flex items-center justify-center"
        >
          <SvgIcon name="base/rx_ic_chevron_down" size="16" />
        </motion.div>
      </div>
      <motion.div
        :animate="{ height: todoExpanded ? 'auto' : 0 }"
        :initial="false"
        :transition="{ duration: 0.2, ease: 'easeInOut' }"
        style="overflow: hidden;"
      >
        <div class="flex flex-col gap-2.5 pt-2.5">
          <div v-for="value in todo" :key="value.content" class="flex gap-1.5 items-center">
            <SvgIcon v-if="value.status === 'completed'" name="base/rx_ic_check_fill" color="var(--colors-icon-icon-success)" />
            <div v-else class="size-4 rounded-full border-solid border-1 border-[var(--colors-border-border-base)] bg-white" />
            <span
              class="text-3 leading-4"
              :class="{
                'text-[var(--colors-text-text-inactive)] decoration-line-through': value.status === 'completed',
                'text-[var(--colors-text-text-primary)]': value.status === 'pending' || value.status === 'in_progress',
              }"
            >
              {{ value.content }}
            </span>
          </div>
        </div>
      </motion.div>
    </div>

    <div
      class="relative flex flex-col gap-2 pa-3 rounded-2 send"
      :class="[props.class, { 'send-dragover': isDraggingOver }]"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- 拖拽文件时的蒙层提示 -->
      <Transition name="drag-fade">
        <div v-if="isDraggingOver" class="drag-overlay">
          <SvgIcon name="base/rx_ic_attachment" size="24" color="var(--colors-icon-icon-brand)" />
          <span>{{ $t('松开以上传文件') }}</span>
        </div>
      </Transition>

      <Textarea
        v-model="message"
        :disabled="!health.isOk && !uninitialized"
        class="relative z-10 !pa-0 !shadow-none !border-none resize-none send-textarea"
        :placeholder="!health.isOk ? $t('MCP 服务异常，请稍后重试') : $t('请输入您的指令')"
        fluid
        rows="3"
        cols="30"
        autofocus
        @keydown="onKeydown"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <div class="flex items-center gap-4 select-none">
        <div class="flex items-center gap-1">
          <RxToggleSwitch
            v-model="mode"
            :disabled="!health.isOk"
            class="-ml-2 -mr-1 scale-70"
            true-value="orchestrator"
            false-value="simple"
            @change="onChangeMode"
          />
          <span
            v-tooltip.top="{ value: $t('打开该选项后，可以让 Roxy AI Agent 同时并行操作多个窗口执行任务。同时您的 Token 会消耗地更快。'), showDelay: 300 }"
            class="cursor-pointer send-text"
          >
            {{ $t('多窗口并行') }}
          </span>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          :accept="ALLOWED_MIME_TYPES.join(',')"
          @change="onFileInputChange"
        >
        <div
          class="flex items-center gap-1.5 transition-opacity duration-200"
          :class="pendingAttachments.length >= MAX_PENDING_ATTACHMENTS ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'"
          @click="onClickUpload"
        >
          <SvgIcon name="base/rx_ic_attachment" color="var(--colors-icon-icon-primary)" />
          <span class="send-text">{{ $t('上传') }}</span>
        </div>

        <SvgIcon
          v-if="!isChatting"
          class="cursor-pointer mx-auto mr-0"
          :class="{ 'p-disabled send-inactive': !message }"
          name="base/rx_ic_browser_send"
          size="24"
          color="var(--colors-icon-icon-brand)"
          @click.stop="onSendMessage"
        />
        <SvgIcon
          v-else
          class="cursor-pointer mx-auto mr-0"
          name="base/rx_ic_browser_stop"
          color="var(--colors-icon-icon-secondary)"
          size="24"
          @click.stop="onStop"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.send {
  border: 1px solid var(--textarea-border-color);
  box-shadow: var(--textarea-shadow);
  background: var(--colors-background-bg-page);

  // transition:
  //   background var(--textarea-transition-duration),
  //   color var(--textarea-transition-duration),
  //   border-color var(--textarea-transition-duration),
  //   box-shadow var(--textarea-transition-duration);

  &:has(.p-textarea:disabled) {
    background: var(--textarea-disabled-background);
    color: var(--textarea-disabled-color);
  }

  &:has(.p-textarea:enabled:focus) {
    border-color: var(--textarea-focus-border-color);
    box-shadow: var(--textarea-focus-ring-shadow);
  }
}

.send {
  &-textarea {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 18px;
    background-color: var(--colors-background-bg-page);
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }

  &-inactive {
    color: var(--colors-icon-icon-inactive);
  }

  &-dragover {
    border-color: var(--colors-border-border-info) !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--colors-border-border-info) 20%, transparent) !important;
  }
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: inherit;
  background: color-mix(in srgb, var(--colors-background-bg-action) 90%, transparent);
  color: var(--colors-text-text-brand);
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
}

.drag-fade-enter-active,
.drag-fade-leave-active {
  transition: opacity 0.15s ease;
}

.drag-fade-enter-from,
.drag-fade-leave-to {
  opacity: 0;
}
</style>
