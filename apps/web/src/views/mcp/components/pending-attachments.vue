<script setup lang="ts">
import type { AttachmentInfo } from '/@/views/mcp/types'

defineProps<{
  attachments: (AttachmentInfo & { preview?: string })[]
  onRemove?: (fileId: string) => void
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
</script>

<template>
  <div
    v-for="att in attachments" :key="att.fileId"
    class="relative bg-[var(--colors-background-bg-block)] overflow-hidden p-2 flex items-center gap-2 rounded-2.5"
  >
    <div class="p-1 rounded-1.5 bg-[var(--colors-background-bg-brand)] flex items-center justify-center">
      <SvgIcon name="base/rx_ic_doc_article" size="16" color="var(--component-dropdown-icon-active)" />
    </div>
    <span class="text-3 text-[var(--colors-text-text-tertiary)] leading-4 font-[Inter] font-500">
      {{ formatFileName(att.fileName) }}
    </span>
    <SvgIcon v-if="onRemove" name="base/rx_ic_delete" size="16" color="var(--colors-icon-icon-primary)" class="cursor-pointer" @click="onRemove(att.fileId)" />
  </div>
</template>
