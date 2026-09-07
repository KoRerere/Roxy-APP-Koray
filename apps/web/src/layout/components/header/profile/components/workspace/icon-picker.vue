<script setup lang="ts">
import data from '@emoji-mart/data'
import { Picker } from 'emoji-mart'
import { tryOnScopeDispose, useFileDialog } from '@vueuse/core'
import { useThemeStore } from '/@/stores/theme'
import { useSimpleLocale } from '/@/stores/locale'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { needsCompactFallbackText } from '/@/utils/workspace'

const props = defineProps<{
  disabled?: boolean
  fallbackText?: string
}>()

/** 空间图标上限 1MB，与设计稿一致 */
const MAX_WORKSPACE_IMAGE_BYTES = 1024 * 1024
/** 预览缩到 2x 展示尺寸，避免原图解码卡主线程 */
const PREVIEW_MAX_EDGE = 144
const ALLOWED_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.bmp'])
const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'])

/** emoji 图标 */
const picture = defineModel<string | undefined>('picture')
/** 自定义上传的图片地址 */
const pictureUrl = defineModel<string | undefined>('pictureUrl')

const themeStore = useThemeStore()
const { isZh } = storeToRefs(useSimpleLocale())
const [showToast] = useResponseToast()

const op = useTemplateRef('op')
const emojiContainerRef = useTemplateRef('emojiContainer')

const activeTab = ref<'emoji' | 'upload'>('emoji')
/** 弹层内未确认的选图路径 */
const pendingLocalPath = ref('')
/** 点过弹层保存、等团队保存时再上传的路径 */
const committedLocalPath = ref('')
const previewSrc = ref('')
const committedPreviewSrc = ref('')
/** 系统选文件框会抢焦点关掉弹层，这段时间不能把刚选的图当未确认草稿清掉 */
const pickingFile = ref(false)

const isCompactFallback = computed(() => needsCompactFallbackText(props.fallbackText))
/** 触发器只展示已确认的预览，未点弹层保存的草稿不往外漏 */
const displayImageUrl = computed(() => committedPreviewSrc.value || pictureUrl.value || '')
const displayEmoji = computed(() => (displayImageUrl.value ? '' : (picture.value || '')))

const tabs = computed(() => [
  { title: $t('表情'), value: 'emoji' },
  { title: $t('上传'), value: 'upload' },
])

const { open, onChange } = useFileDialog({
  accept: '.png,.jpg,.jpeg,.bmp',
  directory: false,
  reset: true,
})

/** 从路径取出小写扩展名，含点 */
function getFileExt(fileName: string) {
  return `.${fileName.split(/[/\\]/).pop()?.split('.').pop()?.toLowerCase() ?? ''}`
}

/** 扩展名 + MIME 双检，防止改后缀的非图片混进来 */
function isAllowedWorkspaceImage(file: File) {
  if (!ALLOWED_IMAGE_EXT.has(getFileExt(file.name))) {
    return false
  }
  return !file.type || ALLOWED_IMAGE_MIME.has(file.type)
}

/** Web 选图：用 File 做缩略预览。Electron 走系统对话框，不能用这条 */
async function applyPickedImage(file: File, localPath: string) {
  if (file.size > MAX_WORKSPACE_IMAGE_BYTES) {
    showToast(-1, $t('建议使用正方形图片，大小不超过 1MB'))
    return
  }

  try {
    const nextPreview = await createPreviewUrl(file)
    revokeDraftPreview()
    pendingLocalPath.value = localPath
    previewSrc.value = nextPreview
  }
  catch {
    showToast(-1, $t('仅支持上传图片文件'))
  }
}

/**
 * HTML accept 在 Windows 上会多出「所有文件」；Electron 用系统对话框 filters。
 * 预览直接用 roxy-media，img 能加载，fetch / createImageBitmap 会失败。
 */
async function openImagePicker() {
  if (!globalThis.isElectron) {
    open()
    return
  }

  pickingFile.value = true
  try {
    const localPath = await globalThis.electronAPI.send('dialog:selectFile', [
      { name: $t('图片'), extensions: ['png', 'jpg', 'jpeg', 'bmp'] },
    ])
    if (!localPath) {
      return
    }
    if (!ALLOWED_IMAGE_EXT.has(getFileExt(localPath))) {
      showToast(-1, $t('仅支持上传图片文件'))
      return
    }

    const mediaPath = await globalThis.electronAPI.send('util:toMediaPath', localPath)
    if (!mediaPath) {
      showToast(-1, $t('发生错误'))
      return
    }

    // 系统对话框本身就是选图确认，弹层会被抢焦点关掉，不能再等弹层「确认」
    if (committedPreviewSrc.value !== mediaPath) {
      revokeBlob(committedPreviewSrc.value)
    }
    revokeDraftPreview()
    pendingLocalPath.value = localPath
    committedLocalPath.value = localPath
    previewSrc.value = mediaPath
    committedPreviewSrc.value = mediaPath
    picture.value = ''
    pictureUrl.value = ''
  }
  finally {
    pickingFile.value = false
  }
}

/** src 是否为 blob: URL */
function isBlobSrc(src: string) {
  return src.startsWith('blob:')
}

/** 释放单个 blob，避免误 revoke 仍在展示的地址 */
function revokeBlob(src: string) {
  if (isBlobSrc(src)) {
    URL.revokeObjectURL(src)
  }
}

/** 释放未被确认预览占用的 blob */
function revokeDraftPreview() {
  if (previewSrc.value !== committedPreviewSrc.value) {
    revokeBlob(previewSrc.value)
  }
}

/** 清空本地预览占用的 blob */
function revokeAllPreviews() {
  if (previewSrc.value !== committedPreviewSrc.value) {
    revokeBlob(previewSrc.value)
  }
  revokeBlob(committedPreviewSrc.value)
}

/** 打开 / 关闭弹层时把草稿同步成已确认状态；选文件过程中或已有未确认路径则不动 */
function syncUploadDraftFromModel() {
  if (pickingFile.value || pendingLocalPath.value) {
    return
  }
  revokeDraftPreview()
  previewSrc.value = committedPreviewSrc.value || pictureUrl.value || ''
}

/** 缩略预览：只处理同源 File/Blob，roxy-media 图不能走这里 */
async function createPreviewUrl(file: Blob) {
  const bitmap = await createImageBitmap(file, {
    resizeWidth: PREVIEW_MAX_EDGE,
    resizeQuality: 'medium',
  })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
  if (!blob) {
    throw new Error('Preview encode failed')
  }
  return URL.createObjectURL(blob)
}

/** 清空本地选图与预览，不影响已回显的远程 pictureUrl */
function resetLocalImage() {
  pendingLocalPath.value = ''
  committedLocalPath.value = ''
  revokeAllPreviews()
  previewSrc.value = ''
  committedPreviewSrc.value = ''
}

/** 只挂一次 emoji-mart，重复 new Picker 会卡顿 */
function ensureEmojiPicker() {
  const container = emojiContainerRef.value
  if (!container || container.childElementCount > 0) {
    return
  }

  const emojiInstance = new Picker({
    data,
    locale: isZh.value ? 'zh' : 'en',
    theme: themeStore.theme === 'system' ? 'auto' : themeStore.theme,
    navPosition: 'bottom',
    previewPosition: 'none',
    skinTonePosition: 'search',
    onEmojiSelect,
  })
  container.appendChild(emojiInstance as unknown as Node)
}

/** 选中 emoji 覆盖自定义图，避免 pictureUrl 仍优先展示 */
function onEmojiSelect(emoji: { native?: string }) {
  picture.value = emoji.native || ''
  pictureUrl.value = ''
  resetLocalImage()
  op.value?.hide()
}

/** 已有自定义图时默认停在上传 Tab，避免再扫一遍 emoji */
async function showPicker(event: MouseEvent) {
  if (props.disabled) {
    return
  }

  activeTab.value = displayImageUrl.value ? 'upload' : 'emoji'
  syncUploadDraftFromModel()
  op.value?.instance?.toggle(event)
  await nextTick()
  if (activeTab.value === 'emoji') {
    ensureEmojiPicker()
  }
  op.value?.instance?.alignOverlay()
}

/** 切到表情 Tab 后再挂载 picker，高度变化后重新对齐浮层 */
async function onTabChange(value: string | number) {
  if (value === 'emoji') {
    await nextTick()
    ensureEmojiPicker()
    op.value?.instance?.alignOverlay()
  }
}

/** 触发器删除同时清掉 emoji 和自定义图 */
function handleClearTrigger(event: MouseEvent) {
  event.stopPropagation()
  picture.value = ''
  pictureUrl.value = ''
  resetLocalImage()
  op.value?.hide()
}

/** 预览删除只清空草稿，不恢复回显；不想换图可以不点保存 */
function handleClearPreview(event: MouseEvent) {
  event.stopPropagation()
  pendingLocalPath.value = ''
  revokeDraftPreview()
  previewSrc.value = ''
}

onChange(async (files) => {
  const file = files?.[0]
  if (!file) {
    return
  }

  if (!isAllowedWorkspaceImage(file)) {
    showToast(-1, $t('仅支持上传图片文件'))
    return
  }

  const localPath = globalThis.electronAPI.getPathForFile(file)
  if (!localPath) {
    showToast(-1, $t('发生错误'))
    return
  }

  await applyPickedImage(file, localPath)
})

/** 只确认本地预览，不传 OSS；新图路径留给团队保存 */
function handleSave() {
  if (committedPreviewSrc.value !== previewSrc.value) {
    revokeBlob(committedPreviewSrc.value)
  }
  committedLocalPath.value = pendingLocalPath.value
  committedPreviewSrc.value = previewSrc.value
  if (pendingLocalPath.value) {
    picture.value = ''
    // 新图还没上传，先清掉旧 URL，避免创建团队时把其它团队的地址带上去
    pictureUrl.value = ''
  }
  if (!previewSrc.value) {
    pictureUrl.value = ''
    picture.value = ''
  }
  op.value?.hide()
}

/** 团队保存时才上传；按目标空间 ID 覆盖该空间唯一一张图，没选新图则返回空 */
async function commitWorkspaceImage(workspaceId: number) {
  if (!committedLocalPath.value) {
    return
  }

  const url = await globalThis.electronAPI.send('user:uploadWorkspaceImage', committedLocalPath.value, workspaceId)
  if (!url) {
    throw new Error('Upload workspace image failed')
  }

  pictureUrl.value = url
  picture.value = ''
  pendingLocalPath.value = ''
  committedLocalPath.value = ''
  return url
}

defineExpose({
  commitWorkspaceImage,
})

tryOnScopeDispose(revokeAllPreviews)
</script>

<template>
  <div class="icon-picker-trigger flex flex-col items-center gap-1" :style="{ cursor: disabled ? 'not-allowed' : 'pointer' }" @click="showPicker">
    <div class="relative">
      <SvgIcon v-if="(displayImageUrl || displayEmoji) && !disabled" name="base/rx_ic_delete" class="close-icon" @click="handleClearTrigger" />
      <div class="default-box">
        <div class="emoji-preview" :class="{ 'emoji-preview--compact': isCompactFallback && !displayImageUrl && !displayEmoji }">
          <img v-if="displayImageUrl" class="h-full w-full rounded-[4px] object-cover" draggable="false" :src="displayImageUrl">
          <template v-else-if="displayEmoji">
            {{ displayEmoji }}
          </template>
          <template v-else>
            {{ fallbackText }}
          </template>
        </div>
      </div>
    </div>
    <div class="choose-icon-desc">
      {{ $t('选择图标') }}
    </div>
  </div>

  <RyPopover ref="op" @hide="syncUploadDraftFromModel">
    <div @click.stop>
      <RxTabs v-model:value="activeTab" :tabs="tabs" only-tabs class="icon-picker-tabs" @update:value="onTabChange" />

      <div v-show="activeTab === 'emoji'" ref="emojiContainer" class="w-88 emoji-picker-panel" />

      <div v-show="activeTab === 'upload'" class="flex flex-col pa-3 gap-6">
        <div class="flex flex-col items-center gap-2.5">
          <div class="flex h-35 w-105 cursor-pointer items-center justify-center rounded-2 bg-[var(--colors-background-bg-example)]" @click="openImagePicker">
            <div v-if="previewSrc" class="flex flex-col items-center gap-3">
              <div class="tt-primary text-3.5 font-500 leading-normal">
                {{ $t('预览') }}
              </div>
              <div class="relative">
                <img class="h-18 w-18 rounded-1.5 border border-white object-cover shadow-sm" draggable="false" :src="previewSrc">
                <SvgIcon name="base/rx_ic_delete" class="absolute -top-1.5 -right-1.5 z-1 cursor-pointer rounded-full bg-white text-3.5  shadow-sm" color="var(--colors-icon-icon-secondary)"
                         @click="handleClearPreview"
                />
              </div>
            </div>
            <div v-else class="flex items-center gap-2.5">
              <SvgIcon name="base/rx_ic_image" size="16" color="var(--colors-icon-icon-inactive)" />
              <span class="tt-inactive text-3.5 font-500 leading-normal">{{ $t('上传图片') }}</span>
            </div>
          </div>
          <div class="tt-tertiary text-center text-3 leading-normal">
            {{ $t('建议使用正方形图片，大小不超过 1MB') }}
          </div>
        </div>
        <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-subtle)" />
        <div class="flex justify-end">
          <RxButton size="xxs" :label="$t('确认')" :disabled="!previewSrc && !pictureUrl" :on-click="handleSave" />
        </div>
      </div>
    </div>
  </RyPopover>
</template>

<style lang="scss" scoped>
.icon-picker-trigger {
  &:hover .close-icon {
    display: block;
  }
}

.close-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  font-size: 12px;
  display: none;
}

.icon-picker-tabs {
  :deep(.p-tablist-tab-list) {
    padding: 0 16px;
    gap: 16px;
  }
}

.emoji-picker-panel {
  :deep(em-emoji-picker) {
    height: 360px;
    max-height: 50vh;
    min-height: unset;
  }
}

.choose-icon-desc {
  color: var(--colors-text-text-tertiary, #575d60);
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.default-box {
  width: fit-content;
  display: flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--colors-border-border-base, #c7cdd1);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}

.emoji-preview {
  display: flex;
  width: 48px;
  height: 48px;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  border-radius: var(--radius-sm, 4px);
  background: var(--primitives-neutrals-100, #f0f3f5);
  color: var(--colors-text-text-tertiary, #8a9093);
  text-align: center;
  font-family: 'JetBrains Mono';
  font-size: 34px;
  font-weight: 700;
  line-height: 28px;

  &--compact {
    font-family: Inter, system-ui, sans-serif;
    font-size: 24px;
    font-weight: 600;
    line-height: 28px;
    white-space: nowrap;
    letter-spacing: -0.5px;
  }
}

[data-theme='dark'] {
  .emoji-preview {
    background: var(--primitives-neutrals-100, #293038);
    color: var(--colors-text-text-inactive, #c7cdd1);
  }
}
</style>
