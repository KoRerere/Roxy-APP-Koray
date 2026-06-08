<script setup lang="ts">
import type { AttachmentInfo } from '../../types'

defineProps<{
  attachments: (AttachmentInfo & { preview?: string })[]
  onRemove?: (fileId: string) => void
  conversationType?: string
}>()

function formatFileName(name: string, maxLen = 10): string {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0)
    return name.length > maxLen ? `${name.slice(0, maxLen)}...` : name
  const base = name.slice(0, dotIndex)
  const ext = name.slice(dotIndex)
  if (base.length <= maxLen)
    return name
  return `${base.slice(0, maxLen)}.. ${ext}`
}

function isAttachmentUploadPending(att: AttachmentInfo) {
  if (att.uploadStatus === 'uploading')
    return true

  return att.source !== 'generated'
    && Boolean(att.preview)
    && !att.url
    && !att.localUrl
    && !att.remoteUrl
    && !att.fileUrl
}

function getAttachmentPreview(att: AttachmentInfo) {
  return att.preview || att.url || att.remoteUrl || att.fileUrl || att.localUrl || ''
}
</script>

<template>
  <template v-if="conversationType === 'automation'">
    <div
      v-for="att in attachments"
      :key="att.fileId"
      class="relative bg-[var(--colors-background-bg-block)] overflow-hidden p-2 flex items-center gap-2 rounded-2.5"
    >
      <div class="p-1 rounded-1.5 bg-[var(--colors-background-bg-brand)] flex items-center justify-center">
        <SvgIcon name="base/rx_ic_doc_article" size="16" color="var(--component-dropdown-icon-active)" />
      </div>
      <span class="text-3 text-[var(--colors-text-text-tertiary)] leading-4 font-[Inter] font-500">
        {{ formatFileName(att.fileName) }}
      </span>
      <SvgIcon v-if="onRemove" name="base/rx_ic_delete" size="16" color="var(--colors-icon-icon-primary)" class="relative z-20 cursor-pointer" @click="onRemove(att.fileId)" />
      <div v-if="isAttachmentUploadPending(att)" class="attachment-loading-overlay">
        <SvgIcon name="base/rx_ic_spin" size="16" color="#fff" class="attachment-loading-icon" />
        <span>{{ $t('上传中') }}</span>
      </div>
    </div>
  </template>

  <div v-else class="flex gap-2">
    <div v-for="att in attachments" :key="att.fileId" class="relative size-25 overflow-hidden rounded-2 border-1 border-solid border-[var(--colors-border-border-action)]">
      <img :src="getAttachmentPreview(att)" class="size-full object-cover">
      <div v-if="isAttachmentUploadPending(att)" class="attachment-loading-overlay">
        <SvgIcon name="base/rx_ic_spin" size="16" color="#fff" class="attachment-loading-icon" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.attachment-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgb(0 0 0 / 48%);
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  pointer-events: none;
}

.attachment-loading-icon {
  animation: attachment-loading-spin 1s linear infinite;
}

@keyframes attachment-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
