<script setup lang="ts">
import { handleRichHtmlLinkClick, navigateByRichHtmlUrl } from '/@/utils/rich-html-link'

const props = withDefaults(defineProps<{
  newFeatureTips: Record<string, any>[]
  /** dismiss：了解/完成；upgrade：重启并更新 / 暂不更新 */
  actionMode?: 'dismiss' | 'upgrade'
  /** 版本提醒配置的标题和说明，显示在新特性正文上方 */
  remindCopy?: {
    title: string
    content: string
  }
}>(), {
  actionMode: 'dismiss',
  newFeatureTips: () => [],
})

const emit = defineEmits<{
  (e: 'skip'): void
  (e: 'upgrade'): void
}>()

const router = useRouter()

const features = ref(props.newFeatureTips)
const page = ref(0)
const appUpgradeTips = ref<HTMLElement | null>(null)

const isLastPage = computed(() => page.value === features.value.length - 1)

const nextText = computed(() => {
  if (!isLastPage.value)
    return $t('下一个')
  return props.actionMode === 'upgrade' ? $t('重启并更新') : $t('完成')
})

const singlePageLabel = computed(() => {
  return props.actionMode === 'upgrade' ? $t('重启并更新') : $t('了解')
})

const skipLabel = computed(() => {
  return props.actionMode === 'upgrade' ? $t('暂不更新') : $t('跳过')
})

const formatFeatures = computed(() => {
  return features.value.map((item, index) => {
    return {
      ...item,
      content: (item.content ?? '').replace(
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

function handlePrimaryAction() {
  if (props.actionMode === 'upgrade')
    emit('upgrade')
  else
    emit('skip')
}

function handleSkip() {
  emit('skip')
}

function handleNext() {
  if (isLastPage.value) {
    handlePrimaryAction()
    return
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

function onHtmlClick(e: MouseEvent) {
  handleRichHtmlLinkClick(e, {
    router,
    interceptBlankTarget: true,
    onNavigate(url) {
      navigateByRichHtmlUrl(router, url)
      handleSkip()
    },
  })
}
</script>

<template>
  <div ref="appUpgradeTips" class="app-upgrade-tips">
    <div v-if="props.remindCopy?.title || props.remindCopy?.content" class="mb-4 flex flex-col gap-1.5">
      <div v-if="props.remindCopy.title" class="tt-primary text-3.5 font-600 leading-5.5">
        {{ props.remindCopy.title }}
      </div>
      <div v-if="props.remindCopy.content" class="tt-secondary whitespace-pre-wrap text-3.25 leading-5">
        {{ props.remindCopy.content }}
      </div>
    </div>
    <template v-for="(item, index) in formatFeatures" :key="index">
      <div class="feature-content" :class="{ active: page === index }" @click="onHtmlClick" v-html="item.content" />
    </template>

    <div v-if="formatFeatures.length > 1" class="indicator-list">
      <template v-for="(_, index) in formatFeatures" :key="index">
        <div class="indicator" :class="{ active: page === index }" @click="page = index" />
      </template>
    </div>

    <div class="flex items-center justify-between">
      <template v-if="formatFeatures.length > 1">
        <RxButton severity="secondary" outlined @click="handleSkip">
          {{ skipLabel }}
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
      <template v-else-if="actionMode === 'upgrade'">
        <RxButton severity="secondary" outlined class="mt-[6px]" @click="handleSkip">
          {{ skipLabel }}
        </RxButton>
        <RxButton class="mt-[6px]" @click="handlePrimaryAction">
          {{ singlePageLabel }}
        </RxButton>
      </template>
      <template v-else>
        <RxButton class="ml-auto mt-[6px]" @click="handlePrimaryAction">
          {{ singlePageLabel }}
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
