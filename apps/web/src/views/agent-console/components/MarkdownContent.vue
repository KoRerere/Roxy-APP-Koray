<script setup lang="ts">
import { useResponseToast } from '/@/hooks/useResponseToast'
import { supportsApp4_0_0 } from '/@/utils/app-supports'
import { renderMarkdown } from '../utils/markdown'
import { registerAgentMarkdownCodeCopyElement } from './markdown/AgentMarkdownCodeCopyElement'
import { useWorkspaceStore } from '/@/stores/workspace'
import { fetchTaskWindowOptionsByDirIds } from '../task-window-options'
import {
  agentProfileLabelVersion,
  cacheAgentProfileLabels,
  getAgentProfileIdsFromPrompt,
  getUncachedAgentProfileIds,
} from '../profile-token-display'
import { registerAgentMarkdownTableCopyElement } from './markdown/AgentMarkdownTableCopyElement'
import { registerAgentMarkdownTokenElement } from './markdown/AgentMarkdownTokenElement'
import { observeUrlFavicons } from '../utils/urlFavicon'
import '../styles/markdown.scss'

const props = withDefaults(defineProps<{
  content: string
  preserveLineBreaks?: boolean
  variant?: 'default' | 'answer'
}>(), {
  preserveLineBreaks: false,
  variant: 'default',
})

registerAgentMarkdownTokenElement()
registerAgentMarkdownTableCopyElement()
registerAgentMarkdownCodeCopyElement()

const [, onlyErrorToast] = useResponseToast()
const workspaceStore = useWorkspaceStore()
const markdownRef = ref<HTMLElement | null>(null)
let stopObservingUrlFavicons = () => {}
const html = computed(() => renderMarkdown(props.content, {
  labelVersion: agentProfileLabelVersion.value,
  preserveLineBreaks: props.preserveLineBreaks,
}))

onMounted(() => {
  stopObservingUrlFavicons = observeUrlFavicons(markdownRef.value)
})

onBeforeUnmount(() => {
  stopObservingUrlFavicons()
})

watch(
  () => props.content,
  async (content) => {
    const missingIds = getUncachedAgentProfileIds(getAgentProfileIdsFromPrompt(content))
    if (!missingIds.length)
      return

    try {
      const options = await fetchTaskWindowOptionsByDirIds(
        missingIds,
        workspaceStore.currentWorkspace?.workspaceName,
      )
      cacheAgentProfileLabels(options.map(option => ({
        id: option.id,
        label: option.code || option.name || option.id,
      })))
    }
    catch (error) {
      console.error('Failed to load Agent profile token labels:', error)
    }
  },
  { immediate: true },
)

function handleMarkdownClick(event: MouseEvent) {
  if (!(event.target instanceof Element))
    return

  const link = event.target.closest<HTMLAnchorElement>('a[data-local-file-path]')
  const filePath = link?.dataset.localFilePath
  if (!link || !filePath || !globalThis.electronAPI || !supportsApp4_0_0())
    return

  event.preventDefault()
  globalThis.electronAPI.send('app:downloadLocalFile', {
    filePath,
    fileName: link.getAttribute('download') || link.textContent?.trim() || undefined,
  }).catch((error) => {
    console.error('Failed to download markdown local file:', error)
    onlyErrorToast(-1, getDownloadErrorMessage(error))
  })
}

function getDownloadErrorMessage(error: unknown) {
  if (isNodeError(error) && error.code === 'ENOENT')
    return $t('文件不存在或已被移动')

  return $t('下载失败')
}

function isNodeError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error
}
</script>

<template>
  <div
    ref="markdownRef"
    class="agent-markdown"
    :class="{ 'agent-markdown--answer': variant === 'answer' }"
    @click="handleMarkdownClick"
    v-html="html"
  />
</template>
