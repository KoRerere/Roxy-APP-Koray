<script setup lang="tsx">
import { motion } from 'motion-v'
import PendingAttachments from '/@/views/mcp/components/pending-attachments.vue'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import type { AssetGenerationOptions, AttachmentInfo, InputScene, Todo } from '/@/views/mcp/types'

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf', 'text/plain']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif']
const MAX_PENDING_ATTACHMENTS = 3

interface Props {
  health: {
    isOk: boolean
    loading: boolean
  }
  isChatting: boolean
  pendingAttachments: AttachmentInfo[]
  pendingScript?: any
  todo?: Todo[]
  class?: string
  uninitialized: boolean
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

const { showMenu } = usePopupMenu()
const aspectRatioPopoverRef = ref()
const aspectRatioOpen = ref(false)
const qualityOpen = ref(false)
const countOpen = ref(false)

function trackMenuOpen(openRef: Ref<boolean>) {
  openRef.value = true
  const handler = () => { openRef.value = false }
  document.addEventListener('click', handler, { once: true, capture: true })
}
const isDraggingOver = ref(false)
const todoExpanded = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isComposing = ref(false)

const isAssetScene = computed(() => scene.value === 'asset')
const acceptedMimeTypes = computed(() => isAssetScene.value ? IMAGE_MIME_TYPES : ALLOWED_MIME_TYPES)
const assetAttachments = computed(() => props.pendingAttachments.filter(a => IMAGE_MIME_TYPES.includes(a.mimeType)))
const canUploadMore = computed(() => {
  const count = isAssetScene.value ? assetAttachments.value.length : props.pendingAttachments.length
  return count < MAX_PENDING_ATTACHMENTS
})
const canSend = computed(() => Boolean(message.value?.trim()) || (isAssetScene.value ? assetAttachments.value.length > 0 : props.pendingAttachments.length > 0))

const aspectRatioOptions = [
  { label: '1:1', value: '1:1', w: 20, h: 20 },
  { label: '4:3', value: '4:3', w: 20, h: 15 },
  { label: '3:4', value: '3:4', w: 15, h: 20 },
  { label: '16:9', value: '16:9', w: 20, h: 11 },
  { label: '9:16', value: '9:16', w: 12, h: 20 },
  { label: '3:2', value: '3:2', w: 20, h: 13 },
  { label: '2:3', value: '2:3', w: 13, h: 20 },
  { label: '21:9', value: '21:9', w: 20, h: 9 },
]

const qualityOptions = [
  { label: '2K', value: '2K' },
  { label: '3K', value: '3K' },
  { label: '4K', value: '4K' },
]

const countOptions = [
  { label: removeTrailingS($t('{count} 张', { count: 1 })), value: '1' },
  { label: $t('{count} 张', { count: 2 }), value: '2' },
  { label: $t('{count} 张', { count: 3 }), value: '3' },
  { label: $t('{count} 张', { count: 4 }), value: '4' },
]

function removeTrailingS(str: string) {
  // 判断是否以 's' 结尾（区分大小写）
  if (str && str.endsWith('s')) {
    // slice(0, -1) 表示切到倒数第一个字符之前，也就是去掉了最后一个字符
    return str.slice(0, -1)
  }
  return str
}

function makeMenuOptions<T extends string>(
  options: { label: string, value: T }[],
  currentValue: T,
  onSelect: (value: T) => void,
) {
  return options.map(o => ({
    label: o.label,
    command: () => { onSelect(o.value) },
    render: () => (
      <div class={['flex items-center justify-between gap-3 w-full px-2.5 py-2 rounded-[var(--p-menu-item-border-radius)]', o.value === currentValue && 'bg-[var(--colors-background-bg-action-hover)]']}>
        <span class="text-3.25 text-[var(--colors-text-text-primary)]">{o.label}</span>
        {o.value === currentValue && <SvgIcon name="base/rx_ic_check" size="14" color="var(--colors-icon-icon-brand)" />}
      </div>
    ),
  }))
}

function showAspectRatioMenu(event: MouseEvent) {
  aspectRatioPopoverRef.value?.toggle(event)
  aspectRatioOpen.value = !aspectRatioOpen.value
}

function hideAspectRatioMenu() {
  aspectRatioPopoverRef.value?.hide()
  aspectRatioOpen.value = false
}

function showQualityMenu(event: MouseEvent) {
  hideAspectRatioMenu()
  trackMenuOpen(qualityOpen)
  showMenu(event, {
    model: makeMenuOptions(qualityOptions, assetOptions.value.quality, v => assetOptions.value.quality = v),
    menuProps: { style: { minWidth: '80px', width: '80px' } },
  })
}

function showCountMenu(event: MouseEvent) {
  hideAspectRatioMenu()
  trackMenuOpen(countOpen)
  const opts = countOptions.map(o => ({ label: o.label, value: o.value }))
  showMenu(event, {
    model: makeMenuOptions(opts, assetOptions.value.count, v => assetOptions.value.count = v),
    menuProps: { style: { minWidth: '120px', width: '120px' } },
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
  if (!canSend.value)
    return
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

function getAttachmentPreview(attachment: AttachmentInfo) {
  return attachment.url || ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="!isAssetScene && pendingAttachments.length" class="flex flex-wrap gap-2">
      <PendingAttachments :attachments="pendingAttachments" :on-remove="removePendingAttachment" conversation-type="automation" />
    </div>

    <div v-if="todo && todo.length > 0" class="bg-[var(--colors-background-bg-block)] rounded-2 p-3 w-full relative cursor-pointer" :class="{ 'pb-4': todoExpanded }"
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

      <template v-if="isAssetScene">
        <Textarea v-model="message" :disabled="!health.isOk && !uninitialized" class="asset-textarea relative z-10 !pa-0 !shadow-none !border-none resize-none !bg-[var(--colors-background-bg-page)]"
                  :placeholder="$t('请输入自然语言或结合图片来描述您想要生成的素材，例如：根据图片中的产品，生成符合亚马逊的高清商品主图...')" fluid rows="3" cols="30" autofocus @keydown="onKeydown" @compositionstart="onCompositionStart"
                  @compositionend="onCompositionEnd"
        />

        <div v-if="assetAttachments.length > 0" class="asset-gallery">
          <div v-for="attachment in assetAttachments" :key="attachment.fileId" class="asset-tile asset-tile--preview">
            <img v-if="attachment.mimeType.startsWith('image/') && getAttachmentPreview(attachment)" :src="getAttachmentPreview(attachment)" :alt="attachment.fileName" class="asset-preview">
            <div v-else class="asset-file">
              <SvgIcon name="base/rx_ic_doc_article" size="16" color="var(--colors-icon-icon-secondary)" />
              <span class="asset-file__name">{{ attachment.fileName }}</span>
            </div>
            <button type="button" class="asset-tile__remove bg-black/30 rounded-1 p-1" @click.stop="removePendingAttachment(attachment.fileId)">
              <SvgIcon name="base/rx_ic_delete" size="12" color="#fff" />
            </button>
          </div>

          <!-- <button v-if="canUploadMore" type="button" class="asset-tile asset-tile--upload" @click.stop="onClickUpload">
            <SvgIcon name="base/rx_ic_plus" size="16" color="var(--colors-icon-icon-secondary)" />
          </button> -->
        </div>

        <div class="flex items-end justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap">
            <button type="button" class="asset-toolbar-btn" :class="{ 'opacity-40 cursor-not-allowed': !canUploadMore }" @click.stop="onClickUpload">
              <SvgIcon name="base/rx_ic_attachment" size="16" color="var(--colors-icon-icon-tertiary)" />
              <span>
                {{ $t('上传') }}
                <span v-if="assetAttachments.length > 0">({{ assetAttachments.length }}/{{ MAX_PENDING_ATTACHMENTS }})</span>
              </span>
            </button>

            <div class="asset-option-group">
              <button v-tooltip.top="{ value: $t('比例'), showDelay: 300 }" type="button" class="asset-option-item" @click.stop="showAspectRatioMenu">
                <span>{{ assetOptions.aspectRatio }}</span>
                <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-primary)" :class="{ 'rotate-180': aspectRatioOpen }" class="transition-transform duration-200" />
              </button>
              <Popover ref="aspectRatioPopoverRef" unstyled>
                <div class="aspect-ratio-grid">
                  <button
                    v-for="o in aspectRatioOptions"
                    :key="o.value"
                    type="button"
                    class="aspect-ratio-item"
                    :class="{ 'aspect-ratio-item--active': assetOptions.aspectRatio === o.value }"
                    @click.stop="assetOptions.aspectRatio = o.value; hideAspectRatioMenu()"
                  >
                    <div class="flex items-center justify-center w-5 h-5">
                      <div
                        class="rounded-[2px]"
                        :style="{
                          width: `${o.w}px`,
                          height: `${o.h}px`,
                          background: assetOptions.aspectRatio === o.value ? 'var(--colors-icon-icon-brand)' : 'var(--colors-icon-icon-note)',
                        }"
                      />
                    </div>
                    <span>{{ o.label }}</span>
                  </button>
                </div>
              </Popover>
              <button v-tooltip.top="{ value: $t('分辨率'), showDelay: 300 }" type="button" class="asset-option-item" @click.stop="showQualityMenu">
                <span>{{ assetOptions.quality }}</span>
                <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-primary)" :class="{ 'rotate-180': qualityOpen }" class="transition-transform duration-200" />
              </button>
              <button v-tooltip.top="{ value: $t('生成张数'), showDelay: 300 }" type="button" class="asset-option-item" @click.stop="showCountMenu">
                <span>{{ countOptions.find(o => o.value === assetOptions.count)?.label ?? assetOptions.count }}</span>
                <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-primary)" :class="{ 'rotate-180': countOpen }" class="transition-transform duration-200" />
              </button>
            </div>
          </div>

          <SvgIcon v-if="!isChatting" class="cursor-pointer asset-send" :class="{ 'p-disabled send-inactive': !canSend }" name="base/rx_ic_browser_send" size="24" color="var(--colors-icon-icon-brand)"
                   @click.stop="onSendMessage"
          />
          <SvgIcon v-else class="cursor-pointer asset-send" name="base/rx_ic_browser_stop" color="var(--colors-icon-icon-secondary)" size="24" @click.stop="onStop" />
        </div>
      </template>

      <template v-else>
        <Textarea v-model="message" :disabled="!health.isOk && !uninitialized" class="asset-textarea relative z-10 !pa-0 !shadow-none !border-none resize-none !bg-[var(--colors-background-bg-page)]"
                  :placeholder="!health.isOk ? $t('MCP 服务异常，请稍后重试') : $t('请输入您的指令')" fluid rows="3" cols="30" autofocus @keydown="onKeydown" @compositionstart="onCompositionStart"
                  @compositionend="onCompositionEnd"
        />

        <div class="flex items-center justify-between gap-4 select-none">
          <div class="flex items-center gap-3">
            <button type="button" class="asset-toolbar-btn" @click="onChangeMode(mode === 'simple' ? 'orchestrator' : 'simple')">
              <RxToggleSwitch :model-value="mode" :disabled="!health.isOk" class="-ml-2 -mr-1 scale-70" true-value="orchestrator" false-value="simple" />
              <span v-tooltip.top="{ value: $t('打开该选项后，可以让 Roxy AI Agent 同时并行操作多个窗口执行任务。同时您的 Token 会消耗得更快。'), showDelay: 300 }">
                {{ $t('多窗口并行') }}
              </span>
            </button>

            <button type="button" class="asset-toolbar-btn" :class="{ 'opacity-40 cursor-not-allowed': !canUploadMore }">
              <div class="flex items-center gap-1.5 transition-opacity duration-200" :class="canUploadMore ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'" @click="onClickUpload">
                <SvgIcon name="base/rx_ic_attachment" color="var(--colors-icon-icon-tertiary)" />
                <span>{{ $t('上传') }}</span>
              </div>
            </button>

            <button v-if="pendingScript" type="button" class="asset-toolbar-btn">
              <div class="relative bg-[var(--colors-background-bg-block)] overflow-hidden flex items-center gap-1.5 rounded-1.5 pr-1.5">
                <div class="flex items-center">
                  <div class="p-1 flex items-center justify-center">
                    <SvgIcon name="base/rx_ic_doc_api" size="16" color="var(--colors-icon-icon-secondary)" />
                  </div>
                  <span class="text-3 text-[var(--colors-text-text-primary)] leading-20px">
                    {{ pendingScript.name }}
                  </span>
                </div>
                <SvgIcon name="base/rx_ic_delete" size="12" color="var(--colors-icon-icon-tertiary)" class="cursor-pointer" @click="emit('removeScript')" />
              </div>
            </button>
          </div>

          <SvgIcon v-if="!isChatting" class="cursor-pointer" :class="{ 'p-disabled send-inactive': !canSend }" name="base/rx_ic_browser_send" size="24" color="var(--colors-icon-icon-brand)"
                   @click.stop="onSendMessage"
          />
          <SvgIcon v-else class="cursor-pointer" name="base/rx_ic_browser_stop" color="var(--colors-icon-icon-secondary)" size="24" @click.stop="onStop" />
        </div>
      </template>
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
  line-height: 20px;
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

.asset-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 31px;
  background: var(--component-segment-bg-selection);
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.asset-option-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  border-radius: 60px;
  background: var(--component-segment-bg-selection);
}

.asset-option-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 60px;
  background: transparent;
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;

  &:hover {
    background-color: var(--component-table-bg-button-hover);
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

.aspect-ratio-grid {
  display: grid;
  grid-template-columns: repeat(4, 60px);
  gap: 8px;
  padding: 8px;
  background: var(--colors-background-bg-page);
  border: 0.5px solid var(--colors-border-border-action);
  border-radius: 8px;
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.07),
    0 2px 2.5px rgba(0, 0, 0, 0.07),
    0 3px 4px rgba(0, 0, 0, 0.07);
}

.aspect-ratio-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 60px;
  height: 68px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: var(--colors-background-bg-action-hover);
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;

  &--active {
    color: var(--colors-text-text-brand);
  }
}
</style>
