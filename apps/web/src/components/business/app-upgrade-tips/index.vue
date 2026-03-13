<script setup lang="ts">
const props = defineProps<{
  newFeatureTips: Record<string, any>[]
}>()

const emit = defineEmits<{
  (e: 'skip'): void
}>()
const features = ref(props.newFeatureTips)
const page = ref(0)
const appUpgradeTips = ref<HTMLElement | null>(null)

const nextText = computed(() => {
  return page.value === features.value.length - 1 ? $t('完成') : $t('下一个')
})

const formatFeatures = computed(() => {
  return features.value.map((item, index) => {
    return {
      ...item,
      content: item.content.replace(
        /<video[^>]*>\s*<source\s+src="([^"]+)"[^>]*><\/video>/gi,
        (_: unknown, src: string) => `<roxy-video-player scale src="${src}" data-page="${index}" />`,
      ),
    }
  })
})

watch(page, () => {
  nextTick(() => {
    syncVideoPlayback()
  })
})

onMounted(() => {
  nextTick(() => {
    syncVideoPlayback()
  })
})

function syncVideoPlayback() {
  const container = appUpgradeTips.value
  if (!container)
    return

  const players = [...container.querySelectorAll('roxy-video-player')] as HTMLElement[]

  players.forEach((player) => {
    const pageIndex = Number((player as HTMLElement).dataset.page)
    const video = (player as any).shadowRoot?.querySelector('video') as HTMLVideoElement | null

    if (!video || Number.isNaN(pageIndex))
      return

    if (pageIndex === page.value) {
      video.play().catch(() => { })
    }
    else {
      video.pause()
    }
  })
}

async function handleSkip() {
  emit('skip')
}

function handleNext() {
  if (page.value === features.value.length - 1) {
    handleSkip()
  }
  page.value = Math.min(page.value + 1, features.value.length - 1)
  nextTick(() => {
    syncVideoPlayback()
  })
}

function handlePrev() {
  page.value = Math.max(page.value - 1, 0)
  nextTick(() => {
    syncVideoPlayback()
  })
}
</script>

<template>
  <div ref="appUpgradeTips" class="app-upgrade-tips">
    <template v-for="(item, index) in formatFeatures" :key="index">
      <div class="feature-content" :class="{ active: page === index }" v-html="item.content" />
    </template>

    <div v-if="formatFeatures.length > 1" class="indicator-list">
      <template v-for="(_, index) in formatFeatures" :key="index">
        <div class="indicator" :class="{ active: page === index }" @click="page = index" />
      </template>
    </div>

    <div class="flex items-center justify-between">
      <template v-if="formatFeatures.length > 1">
        <RxButton severity="secondary" outlined @click="handleSkip">
          {{ $t('跳过') }}
        </RxButton>

        <div class="flex items-center gap-2">
          <RxButton variant="text" severity="secondary" @click="handlePrev">
            {{ $t('上一个') }}
          </RxButton>
          <RxButton @click="handleNext">
            {{ nextText }} ({{ page + 1 }}/{{ formatFeatures.length }})
          </RxButton>
        </div>
      </template>
      <template v-else>
        <RxButton class="ml-auto mt-[6px]" @click="handleSkip">
          {{ $t('了解') }}
        </RxButton>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.feature-content {
  color: var(--colors-text-text-secondary, #34393d);
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: 20.8px;
  opacity: 0;
  height: 0;
  overflow: hidden;
  transition: opacity 0.25s;

  :deep(:is(img, video)) {
    width: 100%;
    border-radius: 8px;

    &::-webkit-media-controls-mute-button,
    &::-webkit-media-controls-volume-slider,
    &::-webkit-media-controls-volume-slider,
    &::-webkit-media-controls-toggle-closed-captions-button {
      display: none;
    }
  }

  :deep(:is(div[data-w-e-type='video'] + p:has(br))) {
    display: none;
  }

  &.active {
    opacity: 1;
    height: calc-size(auto, size);
  }
}

.indicator-list {
  width: 100%;
  display: flex;
  height: 6px;
  justify-content: center;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  margin: 16px 0;

  .indicator {
    flex: 1;
    height: 6px;
    border-radius: var(--radius-full, 9999px);
    background: var(--component-marquee-indicator, #e2e9ee);
    cursor: pointer;

    &.active {
      background: var(--component-marquee-indicator-active, #11a3fd);
    }
  }
}
</style>
