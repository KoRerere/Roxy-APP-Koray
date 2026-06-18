<script setup lang="tsx">
import { nextTick, onMounted } from 'vue'
import { motion } from 'motion-v'
import PendingAttachments from './components/pending-attachments.vue'
import AssetToolbar from './components/asset-toolbar.vue'
import AutomationToolbar from './components/automation-toolbar.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { AssetGenerationOptions, AttachmentInfo, InputScene, Todo } from '/@/views/mcp/types'
import { isMacOS } from '/@/utils'

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()
const [, onlyErrorToast] = useResponseToast()
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'application/json',
  'text/markdown',
  'text/x-markdown',
]
const ALLOWED_FILE_EXTENSIONS = ['.json', '.md', '.markdown']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif']
const MAX_PENDING_ATTACHMENTS = 3
const TEXTAREA_MIN_HEIGHT = 60
const TEXTAREA_MAX_HEIGHT = 160

interface Props {
  health: {
    isReady: boolean
    loading: boolean
  }
  isChatting: boolean
  conversationId?: string
  pendingAttachments: AttachmentInfo[]
  pendingScript?: any
  todo?: Todo[]
  class?: string
}

interface Emits {
  (e: 'sendMessage'): void
  (e: 'stop'): void
  (e: 'uploadFiles', files: File[]): void
  (e: 'removeAttachment', fileId: string): void
  (e: 'removeScript'): void
  (e: 'changeMode', value: 'orchestrator' | 'simple'): void
}

const message = defineModel<string>()
const mode = defineModel<'orchestrator' | 'simple'>('mode')
const scene = defineModel<InputScene>('scene', { default: 'automation' })
const assetOptions = defineModel<AssetGenerationOptions>('assetOptions', {
  default: () => ({
    aspectRatio: '1:1',
    quality: '2K',
    count: '1',
  }),
})

const isDraggingOver = ref(false)
const todoExpanded = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<{ $el: HTMLTextAreaElement } | null>(null)
const isComposing = ref(false)

const isAssetScene = computed(() => scene.value === 'asset')
const acceptedMimeTypes = computed(() => isAssetScene.value ? IMAGE_MIME_TYPES : [...ALLOWED_MIME_TYPES, ...ALLOWED_FILE_EXTENSIONS])
const assetAttachments = computed(() => props.pendingAttachments.filter(a => IMAGE_MIME_TYPES.includes(a.mimeType)))
const canUploadMore = computed(() => {
  const count = isAssetScene.value ? assetAttachments.value.length : props.pendingAttachments.length
  return count < MAX_PENDING_ATTACHMENTS
})
const hasMessageText = computed(() => Boolean(message.value?.trim()))
const hasPendingAttachmentUploads = computed(() => props.pendingAttachments.some(isAttachmentUploadPending))

function isAttachmentUploadPending(attachment: AttachmentInfo) {
  if (attachment.uploadStatus === 'uploading')
    return true

  return attachment.source !== 'generated'
    && Boolean(attachment.preview)
    && !attachment.url
    && !attachment.localUrl
    && !attachment.remoteUrl
    && !attachment.fileUrl
}

const canSend = computed(() => hasMessageText.value && !hasPendingAttachmentUploads.value)

const textareaPlaceholder = computed(() => {
  if (props.health.loading) {
    return $t('MCP 服务连接中，请稍候...')
  }
  if (!props.health.isReady) {
    return $t('MCP 服务暂未就绪，请稍后重试')
  }
  if (isAssetScene.value) {
    return $t('请输入自然语言或结合图片来描述您想要生成的素材，例如：根据图片中的产品，生成符合亚马逊的高清商品主图...')
  }

  if (isMacOS) {
    return $t('请输入您的指令，通过 Cmd + 回车 即可换行')
  }
  else {
    return $t('请输入您的指令，通过 Shift + 回车 即可换行')
  }
})

watch(mode, (val) => {
  emit('changeMode', val)
})

watch(message, resizeTextarea, { flush: 'post' })

onMounted(resizeTextarea)

function resizeTextarea() {
  nextTick(() => {
    const textarea = textareaRef.value?.$el
    if (!textarea)
      return

    if (!textarea.value) {
      textarea.style.height = `${TEXTAREA_MIN_HEIGHT}px`
      textarea.style.overflowY = 'hidden'
      return
    }

    textarea.style.height = 'auto'
    const height = Math.min(Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT)
    textarea.style.height = `${height}px`
    textarea.style.overflowY = textarea.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
  })
}

function onClickUpload() {
  if (!canUploadMore.value)
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
  if (!props.health.isReady || props.isChatting)
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
  if (!props.health.isReady || props.isChatting)
    return

  const files = Array.from(event.dataTransfer?.files ?? [])
  emit('uploadFiles', files)
}

function getPastedFiles(event: ClipboardEvent) {
  const clipboardData = event.clipboardData
  if (!clipboardData)
    return { files: [] as File[], hasFileItem: false }

  const dataFiles = Array.from(clipboardData.files ?? [])
  const items = Array.from(clipboardData.items ?? [])
  const types = Array.from(clipboardData.types ?? [])
  const itemFiles = items
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  return {
    files: dataFiles.length > 0 ? dataFiles : itemFiles,
    hasFileItem: dataFiles.length > 0 || items.some(item => item.kind === 'file') || types.some(type => type.toLowerCase().includes('file')),
  }
}

function onPaste(event: ClipboardEvent) {
  const { files, hasFileItem } = getPastedFiles(event)
  if (!hasFileItem)
    return

  event.preventDefault()

  if (!props.health.isReady || props.isChatting) {
    onlyErrorToast(-1, $t('当前无法粘贴文件，请稍后重试'))
    return
  }

  if (files.length === 0) {
    onlyErrorToast(-1, $t('粘贴文件失败，请使用附件按钮上传'))
    return
  }

  emit('uploadFiles', files)
}

function onSendMessage() {
  if (!canSend.value)
    return
  emit('sendMessage')
}

function onStop() {
  emit('stop')
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
  if (event.key === 'Enter') {
    // ⌘+Enter (macOS) 或 Ctrl+Enter：手动插入换行
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      const textarea = event.target as HTMLTextAreaElement
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value
      const newValue = `${value.substring(0, start)}\n${value.substring(end)}`
      message.value = newValue
      // 设置光标位置到换行符后面
      nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      })
      return
    }

    // Shift+Enter：默认换行（不处理）
    if (event.shiftKey) {
      return
    }

    // 单独 Enter：发送消息
    if (!isComposing.value) {
      event.preventDefault()
      onSendMessage()
    }
  }
}

function getAttachmentPreview(attachment: AttachmentInfo) {
  return attachment.preview || attachment.url || attachment.remoteUrl || attachment.fileUrl || attachment.localUrl || ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="!isAssetScene && pendingAttachments.length" class="flex flex-wrap gap-2">
      <PendingAttachments :attachments="pendingAttachments" :on-remove="removePendingAttachment" conversation-type="automation" />
    </div>

    <div
      v-if="todo && todo.length > 0"
      class="bg-[var(--colors-background-bg-block)] rounded-2 p-3 w-full relative cursor-pointer"
      :class="{ 'pb-4': todoExpanded }"
      @click="todoExpanded = !todoExpanded"
    >
      <div class="flex justify-between items-center cursor-pointer select-none">
        <span class="text-3 leading-4 font-500 text-[var(--colors-text-text-primary)]">Agent's todo List</span>
        <motion.div :animate="{ rotate: todoExpanded ? 0 : 180 }" :transition="{ duration: 0.25, ease: 'easeInOut' }" class="flex items-center justify-center">
          <SvgIcon name="base/rx_ic_chevron_down" size="16" />
        </motion.div>
      </div>
      <motion.div :animate="{ height: todoExpanded ? 'auto' : 0 }" :initial="false" :transition="{ duration: 0.2, ease: 'easeInOut' }" style="overflow: hidden;">
        <div class="flex flex-col gap-2.5 pt-2.5">
          <div v-for="value in todo" :key="value.content" class="flex gap-1.5 items-center">
            <SvgIcon v-if="value.status === 'completed'" name="base/rx_ic_check_fill" color="var(--colors-icon-icon-success)" />
            <div v-else class="size-4 rounded-full border-solid border-1 border-[var(--colors-border-border-base)] bg-white" />
            <span class="text-3 leading-4" :class="{
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

    <div class="relative flex flex-col gap-3 pa-3 rounded-2 send bg-[var(--colors-background-bg-page)] overflow-y-auto" :class="[props.class, { 'send-dragover': isDraggingOver, 'send--asset': isAssetScene }]"
         @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop"
    >
      <Transition name="drag-fade">
        <div v-if="isDraggingOver" class="drag-overlay">
          <SvgIcon name="base/rx_ic_attachment" size="24" color="var(--colors-icon-icon-brand)" />
          <span>{{ $t('拖拽文件到这里以上传') }}</span>
        </div>
      </Transition>

      <input ref="fileInputRef" type="file" multiple class="hidden" :accept="acceptedMimeTypes.join(',')" @change="onFileInputChange">

      <!-- 共享 Textarea -->
      <Textarea
        ref="textareaRef"
        v-model="message"
        :disabled="!health.isReady && !health.loading"
        class="asset-textarea relative z-10 !pa-0 !shadow-none !border-none resize-none !bg-[var(--colors-background-bg-page)]"
        :placeholder="textareaPlaceholder"
        fluid
        rows="3"
        cols="30"
        autofocus
        @keydown="onKeydown"
        @paste="onPaste"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />

      <!-- 图片画廊（仅素材场景） -->
      <div v-if="isAssetScene && assetAttachments.length > 0" class="asset-gallery">
        <div v-for="attachment in assetAttachments" :key="attachment.fileId" class="asset-tile asset-tile--preview">
          <img v-if="attachment.mimeType.startsWith('image/') && getAttachmentPreview(attachment)" :src="getAttachmentPreview(attachment)" :alt="attachment.fileName" class="asset-preview">
          <div v-else class="asset-file">
            <SvgIcon name="base/rx_ic_doc_article" size="16" color="var(--colors-icon-icon-secondary)" />
            <span class="asset-file__name">{{ attachment.fileName }}</span>
          </div>
          <div v-if="isAttachmentUploadPending(attachment)" class="asset-tile__loading">
            <SvgIcon name="base/rx_ic_spin" size="18" color="#fff" class="asset-tile__loading-icon" />
          </div>
          <button type="button" class="asset-tile__remove bg-black/30 rounded-1 p-1" @click.stop="removePendingAttachment(attachment.fileId)">
            <SvgIcon name="base/rx_ic_delete" size="12" color="#fff" />
          </button>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="flex items-center justify-between" :class="isAssetScene ? 'gap-3 flex-wrap' : 'gap-4 select-none'">
        <AssetToolbar
          v-if="isAssetScene"
          v-model:asset-options="assetOptions"
          :can-upload-more="canUploadMore"
          :attachment-count="assetAttachments.length"
          :max-attachments="MAX_PENDING_ATTACHMENTS"
          :disabled="!health.isReady && !health.loading"
          @upload="onClickUpload"
        />
        <AutomationToolbar
          v-else
          v-model:mode="mode"
          :can-upload-more="canUploadMore"
          :conversation-id="conversationId"
          :pending-script="pendingScript"
          :disabled="isChatting || (!health.isReady && !health.loading)"
          @upload="onClickUpload"
          @remove-script="emit('removeScript')"
        />

        <SvgIcon
          v-if="!isChatting" class="cursor-pointer asset-send"
          :class="{ 'p-disabled send-inactive': !canSend }"
          name="base/rx_ic_browser_send"
          size="32"
          color="var(--colors-icon-icon-brand)"
          @click.stop="onSendMessage"
        />
        <SvgIcon v-else class="cursor-pointer asset-send" name="base/rx_ic_browser_stop" color="var(--colors-icon-icon-secondary)" size="32" @click.stop="onStop" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.send {
  border: 1px solid var(--textarea-border-color);
  box-shadow: var(--textarea-shadow);

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
  &-text {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }

  &-inactive {
    opacity: 0.4;
  }

  &-dragover {
    border-color: var(--colors-border-border-info) !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--colors-border-border-info) 20%, transparent) !important;
  }
}

.asset-textarea {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  height: 60px;
  line-height: 20px;
  min-height: 60px;
  max-height: 160px;
  overflow-y: hidden;
}

.asset-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.asset-tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  overflow: hidden;
  border: 1px solid var(--colors-border-border-action);
  border-radius: 8px;
  background: var(--colors-background-bg-action);

  &--upload {
    background: transparent;
    cursor: pointer;
  }

  &__remove {
    position: absolute;
    z-index: 20;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    // width: 18px;
    // height: 18px;
    border: 0;
    cursor: pointer;
  }

  &__loading {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 48%);
    pointer-events: none;
  }

  &__loading-icon {
    animation: asset-tile-loading-spin 1s linear infinite;
  }
}

@keyframes asset-tile-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.asset-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;

  &__name {
    display: -webkit-box;
    overflow: hidden;
    color: var(--colors-text-text-secondary);
    font-size: 11px;
    line-height: 14px;
    text-align: center;
    word-break: break-word;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.asset-send {
  flex-shrink: 0;
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 11;
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
