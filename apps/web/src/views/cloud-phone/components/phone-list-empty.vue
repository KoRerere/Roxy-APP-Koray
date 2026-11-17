<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useElementVisibility, useEventListener, usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'

const emit = defineEmits<{ (e: 'create'): void }>()
const { t: $t } = useI18n()

// TODO: 换成云手机介绍页的正式地址
const CLOUD_PHONE_INTRO_URL = 'https://faq.roxybrowser.com/'

const sectionRef = useTemplateRef<HTMLElement>('section')
const visualRef = useTemplateRef<HTMLElement>('visual')
const isVisible = useElementVisibility(sectionRef)
const documentVisibility = useDocumentVisibility()
const reducedMotion = usePreferredReducedMotion()
const isReduced = computed(() => reducedMotion.value === 'reduce')
const isPaused = computed(() => !isVisible.value || documentVisibility.value !== 'visible')

const videoModules = import.meta.glob<string>('/src/assets/videos/cloud-phone/*.mp4', {
  eager: true,
  query: '?url',
  import: 'default',
})
const videos = Object.keys(videoModules).sort().map(key => videoModules[key])

/* ---------------- 尺寸 ---------------- */

/** 空状态铺满表格区域剩余高度（从工具栏下方到表格容器底部） */
const fillHeight = ref<number>()
const tableWrapper = ref<HTMLElement | null>(null)
function measureFillHeight() {
  const section = sectionRef.value
  const wrapper = tableWrapper.value
  if (!section || !wrapper) {
    return
  }
  fillHeight.value = Math.max(Math.floor(wrapper.getBoundingClientRect().bottom - section.getBoundingClientRect().top), 420)
}
useResizeObserver(tableWrapper, measureFillHeight)
useEventListener(window, 'resize', measureFillHeight)

/**
 * 与工具栏、底部留出的间距
 */
const SECTION_PADDING_Y = 32
const STAGE_MAX_HEIGHT = 480
const stageStyle = computed(() => fillHeight.value
  ? { height: `${Math.min(fillHeight.value - SECTION_PADDING_Y * 2, STAGE_MAX_HEIGHT)}px` }
  : undefined)

const { height: visualHeight } = useElementSize(visualRef)

/** 手机屏幕宽高比，与视频素材一致 */
const SCREEN_ASPECT = 0.523
const BEZEL = 4
const PHONE_GAP = 10
const COLUMN_GAP = 28

const phoneHeight = computed(() => Math.max(Math.round(visualHeight.value * 0.66), 200))
const phoneWidth = computed(() => Math.round((phoneHeight.value - BEZEL * 2) * SCREEN_ASPECT + BEZEL * 2))
const loopLength = computed(() => videos.length * (phoneHeight.value + PHONE_GAP))
/** 列高约为容器的 1.8 倍，按此铺够 */
const copies = computed(() => Math.ceil(visualHeight.value * 1.8 / Math.max(loopLength.value, 1)) + 1)

/* ---------------- 动效：三列纵向慢速循环，相邻列反向错速 ---------------- */

const COLUMNS = [
  // offset：起始素材错开；reverse：素材倒序；phase：起始高度错开半台/四分之一台手机
  { speed: 20, dir: -1, offset: 0, reverse: false, phase: 0 },
  { speed: 25, dir: 1, offset: 2, reverse: true, phase: 0.5 },
  { speed: 16, dir: -1, offset: 1, reverse: false, phase: 0.25 },
]
const columns = computed(() => COLUMNS.map((column) => {
  const order = videos.map((_, k) => videos[(k + column.offset) % videos.length])
  if (column.reverse) {
    order.reverse()
  }
  return Array.from({ length: order.length * copies.value }, (_, k) => order[k % order.length])
}))

/** 每个视频从随机时间点开始播放，同一段素材同时出现时画面也不同 */
function onVideoLoaded(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video.duration) {
    video.currentTime = Math.random() * video.duration
  }
}

/*
 * 用 CSS 动画驱动滚动（在合成线程上运行，不受视频解码和主线程影响，更顺滑）。
 * 每列一个循环：从 0 移动到 -一组素材的高度；向下的列反向播放；负的 delay 让三列起始高度错开。
 */
const hoveredColumn = ref<number | null>(null)
const trackStyles = computed(() => {
  const step = phoneHeight.value + PHONE_GAP
  return COLUMNS.map(column => ({
    '--loop': `${loopLength.value}px`,
    'animationDuration': `${(loopLength.value / column.speed).toFixed(2)}s`,
    'animationDirection': column.dir < 0 ? 'normal' : 'reverse',
    'animationDelay': `-${(column.phase * step / column.speed).toFixed(2)}s`,
  }))
})

/* ---------------- 视频：只播放可见的；减少动态效果时显示静态画面 ---------------- */

let observer: IntersectionObserver | undefined
function observeVideos() {
  observer?.disconnect()
  if (!visualRef.value) {
    return
  }
  observer = new IntersectionObserver(entries => entries.forEach((entry) => {
    const video = entry.target as HTMLVideoElement
    if (entry.isIntersecting && !isPaused.value && !isReduced.value) {
      video.play().catch(() => {})
    }
    else {
      video.pause()
    }
  }), { root: tableWrapper.value })
  visualRef.value.querySelectorAll('video').forEach(video => observer!.observe(video))
}

function pauseVideos() {
  visualRef.value?.querySelectorAll('video').forEach(video => video.pause())
}

watch([isPaused, isReduced], ([paused, reduced]) => {
  if (paused || reduced) {
    pauseVideos()
  }
  else {
    observeVideos()
  }
})
watch([phoneHeight, copies], () => requestAnimationFrame(observeVideos))

onMounted(() => {
  tableWrapper.value = sectionRef.value?.closest<HTMLElement>('.table-wrapper') ?? null
  measureFillHeight()
  observeVideos()
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="w-full">
    <section
      ref="section"
      class="cloud-phone-empty relative w-full flex items-center justify-center bg-[var(--colors-background-bg-page)] px-6 py-8"
      :style="fillHeight ? { height: `${fillHeight}px` } : undefined"
      aria-labelledby="cloud-phone-empty-title"
    >
      <!-- 圆角边框容器：左侧文案 + 按钮，右侧手机阵列在框内裁切 -->
      <div
        class="cloud-phone-empty__box h-[clamp(380px,calc(100vh-360px),480px)] w-[85%] min-w-190 max-w-280 flex items-center gap-14 overflow-hidden rounded-3 pl-12"
        :class="{ 'is-paused': isPaused || isReduced }"
        :style="{ ...stageStyle, '--phone-w': `${phoneWidth}px`, '--phone-h': `${phoneHeight}px`, '--phone-gap': `${PHONE_GAP}px`, '--column-gap': `${COLUMN_GAP}px` }"
      >
        <!-- 左：文案与按钮，左对齐 -->
        <div class="max-w-100 w-[40%] flex shrink-0 flex-col items-start">
          <div class="cloud-phone-empty__icon size-16 flex shrink-0 items-center justify-center rounded-full">
            <RxSvgIcon name="base/rx_ic_cloud_phone" size="36" color="var(--colors-icon-icon-brand)" aria-hidden="true" />
          </div>

          <h2 id="cloud-phone-empty-title" class="m-0 mt-6 text-6 font-600 leading-8 tt-primary">
            {{ $t('创建你的第一台云手机') }}
          </h2>
          <p class="m-0 mt-3 text-3.5 font-400 leading-5 tt-secondary">
            {{ $t('创建第一台云手机，免费体验 30 分钟') }}
          </p>

          <div class="mt-8 flex items-center gap-5">
            <RxButton size="md" icon="base/rx_ic_plus" :label="$t('创建云手机')" @click="emit('create')" />
            <a :href="CLOUD_PHONE_INTRO_URL" target="_blank" rel="noopener noreferrer" class="cloud-phone-empty__link inline-flex items-center gap-1 text-3 font-500 leading-4 no-underline">
              {{ $t('了解云手机') }}
              <RxSvgIcon name="base/rx_ic_arrow_right" size="12" aria-hidden="true" />
            </a>
          </div>
        </div>

        <!-- 右：竖直的三列手机阵列，上下延伸到边框处 -->
        <div ref="visual" class="cloud-phone-empty__visual relative h-full min-w-0 flex-1 select-none" aria-hidden="true">
          <div class="absolute inset-0">
            <div class="cloud-phone-empty__scene absolute left-1/2 top-1/2 flex gap-[var(--column-gap)]">
              <div
                v-for="(column, columnIndex) in columns" :key="columnIndex"
                class="relative h-full w-[var(--phone-w)] shrink-0"
                @mouseenter="hoveredColumn = columnIndex" @mouseleave="hoveredColumn = null"
              >
                <div
                  class="cloud-phone-empty__track absolute left-0 top-0 flex flex-col gap-[var(--phone-gap)]"
                  :class="{ 'is-hovered': hoveredColumn === columnIndex }" :style="trackStyles[columnIndex]"
                >
                  <!-- 统一的手机外框：圆角机身 + 细描边 -->
                  <div v-for="(src, index) in column" :key="index" class="cloud-phone-empty__phone relative h-[var(--phone-h)] w-[var(--phone-w)] shrink-0 rounded-[18px] p-[3px]">
                    <div class="relative h-full w-full overflow-hidden rounded-[15px] bg-[var(--colors-background-bg-page)]">
                      <video
                        :src="src" muted loop playsinline preload="metadata" draggable="false"
                        class="pointer-events-none block h-full w-full object-cover"
                        @loadedmetadata="onVideoLoaded"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 边框容器：与页面卡片一致的细描边 + 轻阴影 */
.cloud-phone-empty__box {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-page);
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}

/* 滚动动画：匀速、无缝循环；悬停的列、页面不可见或减少动态效果时暂停 */
.cloud-phone-empty__track {
  animation: cloud-phone-column-scroll linear infinite;
  will-change: transform;
}

.cloud-phone-empty__track.is-hovered,
.is-paused .cloud-phone-empty__track {
  animation-play-state: paused;
}

@keyframes cloud-phone-column-scroll {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(0, calc(-1 * var(--loop)), 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-phone-empty__track {
    animation: none;
  }
}

/* 竖直排列的三列手机，居中，上下自然延伸到空状态区域边缘 */
.cloud-phone-empty__scene {
  height: 180%;
  opacity: 0.85;
  transform: translate(-50%, -50%);
}

/* 统一的手机外框 */
.cloud-phone-empty__phone {
  background: color-mix(in srgb, var(--colors-background-bg-page) 86%, #8a94a0);
  border: 1px solid var(--colors-border-border-inactive);
  box-shadow: 0 2px 6px rgba(16, 24, 40, 0.08);
}

.cloud-phone-empty__icon {
  background: color-mix(in srgb, var(--colors-icon-icon-brand) 12%, transparent);
}

.cloud-phone-empty__link {
  color: var(--colors-icon-icon-brand);
  transition: opacity 0.2s ease;
}

.cloud-phone-empty__link:hover {
  opacity: 0.8;
}
</style>
