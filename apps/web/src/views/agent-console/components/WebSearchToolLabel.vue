<script setup lang="ts">
import type { AgentToolCallProcessEvent } from '../types'
import { friendlyToolName } from '../toolName'
import { getWebSearchToolPresentation } from '../webSearchToolPresentation'
import { DEFAULT_FAVICON_ICON_NAME } from '../utils/urlFavicon'

const props = withDefaults(defineProps<{
  event: AgentToolCallProcessEvent
  highlight?: boolean
}>(), {
  highlight: false,
})

const presentation = computed(() => getWebSearchToolPresentation(props.event.input))
const label = computed(() => friendlyToolName(
  props.event.toolName,
  props.event.status,
  props.event.input,
  { finished: props.event.finished },
))
const urlPresentation = computed(() => {
  if (presentation.value?.action !== 'open_page' && presentation.value?.action !== 'find_in_page') {
    return undefined
  }
  return presentation.value
})
const urlLabel = computed(() => {
  if (!urlPresentation.value) {
    return undefined
  }
  const index = label.value.indexOf(urlPresentation.value.url)
  if (index < 0) {
    return undefined
  }
  return {
    before: label.value.slice(0, index),
    after: label.value.slice(index + urlPresentation.value.url.length),
  }
})
const faviconLoaded = ref(false)
const faviconFailed = ref(false)

watch(() => urlPresentation.value?.faviconUrl, () => {
  faviconLoaded.value = false
  faviconFailed.value = false
}, { immediate: true })
</script>

<template>
  <span
    v-if="urlPresentation && urlLabel"
    class="web-search-label"
    :class="{ 'process-running-text': highlight }"
  >
    {{ urlLabel.before }}<span class="web-search-url">
      <span v-if="urlPresentation.faviconUrl" class="web-search-favicon-slot">
        <SvgIcon
          class="web-search-favicon web-search-favicon--fallback"
          :class="{ 'web-search-favicon--hidden': faviconLoaded }"
          :name="DEFAULT_FAVICON_ICON_NAME"
          size="14"
          color="var(--color-text-tertiary)"
          aria-hidden="true"
        />
        <img
          v-if="!faviconFailed"
          class="web-search-favicon"
          :class="{ 'web-search-favicon--loaded': faviconLoaded }"
          :src="urlPresentation.faviconUrl"
          alt=""
          decoding="async"
          referrerpolicy="no-referrer"
          @error="faviconFailed = true"
          @load="faviconLoaded = true"
        >
      </span>
      <span class="web-search-url__text">{{ urlPresentation.url }}</span>
    </span>{{ urlLabel.after }}
  </span>
  <span v-else :class="{ 'process-running-text': highlight }">{{ label }}</span>
</template>

<style scoped>
.web-search-label,
.web-search-url {
  display: inline-flex;
  min-width: 0;
  align-items: center;
}

.web-search-label {
  gap: 4px;
}

.web-search-url {
  gap: 4px;
  overflow: hidden;
}

.web-search-favicon-slot {
  position: relative;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.web-search-favicon {
  position: absolute;
  inset: 0;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  opacity: 1;
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.web-search-favicon--fallback {
  color: var(--color-text-tertiary);
}

.web-search-favicon--hidden {
  opacity: 0;
  transform: scale(0.85);
}

.web-search-favicon--loaded {
  opacity: 1;
  transform: scale(1);
}

.web-search-url__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
