<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useElementVisibility, useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'

/**
 * 云手机空状态（视频墙版）
 * 上方：图标 + 标题 + 说明 + 按钮；下方：多行竖屏视频卡片横向无缝滚动，
 * 可左右拖动（松手带惯性），点击卡片放大播放。
 */
const emit = defineEmits<{ (e: 'create'): void }>()
const { t: $t } = useI18n()

// TODO: 换成云手机介绍页的正式地址
const CLOUD_PHONE_INTRO_URL = 'https://faq.roxybrowser.com/'

const videoModules = import.meta.glob<string>('/src/assets/videos/cloud-phone-wall/*.mp4', {
  eager: true,
  query: '?url',
  import: 'default',
})
const videos = Object.keys(videoModules).sort().map(key => videoModules[key])

/* ---------------- 配置 ---------------- */

const CONFIG = {
  speeds: [26, 22, 30], // 每行自动滚动速度 px/s
  dirs: [-1, 1, -1], // -1 向左，1 向右
  rowOffset: 3, // 每行起始错开几个素材
  friction: 0.92, // 松手后惯性衰减（每 16ms）
  videoAspect: 540 / 1176, // 素材宽高比
  cropY: 0.08, // 卡片里视频上下各裁掉的比例（去掉灵动岛/状态栏和底部评论栏）
  gap: 14,
  minCardH: 240,
  maxCardH: 620,
}

/* ---------------- 尺寸 ---------------- */

const wallRef = useTemplateRef<HTMLElement>('wall')
const { width: wallWidth, height: wallHeight } = useElementSize(wallRef)

/** 卡片按约 1.5 行铺满可用高度：顶部对齐，第二行下半部分被底边裁掉 */
const VISIBLE_ROWS = 1.5
const cardH = computed(() => {
  const h = (wallHeight.value - CONFIG.gap * Math.floor(VISIBLE_ROWS)) / VISIBLE_ROWS
  return Math.round(Math.min(Math.max(h, CONFIG.minCardH), CONFIG.maxCardH))
})
/** 固定两行：第一行完整，第二行被裁切 */
const rowCount = computed(() => 2)
/** 卡片比视频略宽，视频 object-cover 填满后上下各被裁掉 cropY */
const cardW = computed(() => Math.round(cardH.value * CONFIG.videoAspect / (1 - CONFIG.cropY * 2)))
const loopW = computed(() => videos.length * (cardW.value + CONFIG.gap))
/** 按宽度复制素材，保证宽屏也能无缝循环 */
const copies = computed(() => Math.ceil(wallWidth.value / Math.max(loopW.value, 1)) + 1)

const rows = computed(() => Array.from({ length: rowCount.value }, (_, r) => {
  const n = videos.length
  return Array.from({ length: n * copies.value }, (_, k) => videos[(k + r * CONFIG.rowOffset) % n])
}))

/* ---------------- 动画：自动滚动 + 拖拽惯性 ---------------- */

const sectionRef = useTemplateRef<HTMLElement>('section')
const isVisible = useElementVisibility(sectionRef)
const documentVisibility = useDocumentVisibility()
const reducedMotion = usePreferredReducedMotion()
const isReduced = computed(() => reducedMotion.value === 'reduce')
const isPaused = computed(() => !isVisible.value || documentVisibility.value !== 'visible')

const trackRefs = ref<HTMLElement[]>([])
/** 灯箱打开时暂停滚动 */
const lightbox = ref<{ src: string, time: number, from: DOMRect } | null>(null)
const autoOffsets = Array.from({ length: 3 }, () => -Math.random() * 600)
let drag = 0
let vel = 0
let dragging = false
let last = performance.now()
let raf = 0

/** 结果落在 [-L, 0) */
const wrap = (x: number, L: number) => ((x % L) + L) % L - L

function tick(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  if (!lightbox.value) {
    if (!dragging) {
      drag += vel
      vel *= CONFIG.friction ** (dt * 60)
      if (Math.abs(vel) < 0.01) {
        vel = 0
      }
    }
    const L = loopW.value
    trackRefs.value.forEach((track, i) => {
      if (!isPaused.value && !isReduced.value) {
        autoOffsets[i] += CONFIG.dirs[i] * CONFIG.speeds[i] * dt
      }
      if (L > 0) {
        track.style.transform = `translate3d(${wrap(autoOffsets[i] + drag, L).toFixed(2)}px,0,0)`
      }
    })
  }
  raf = requestAnimationFrame(tick)
}

let downX = 0
let lastX = 0
let lastT = 0
let moved = false
let pointerId: number | null = null
const grabbing = ref(false)

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  pointerId = e.pointerId
  downX = lastX = e.clientX
  lastT = performance.now()
  moved = false
  dragging = true
  vel = 0
}
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragging || e.pointerId !== pointerId) {
    return
  }
  const dx = e.clientX - lastX
  const t = performance.now()
  if (!moved && Math.abs(e.clientX - downX) > 5) {
    moved = true
    grabbing.value = true
  }
  if (moved) {
    drag += dx
    vel = dx / Math.max(t - lastT, 1) * 16
  }
  lastX = e.clientX
  lastT = t
})
useEventListener(window, 'pointerup', (e: PointerEvent) => {
  if (!dragging || e.pointerId !== pointerId) {
    return
  }
  dragging = false
  grabbing.value = false
  if (performance.now() - lastT > 80) {
    vel = 0 // 停住后再松手不甩
  }
  if (!moved) {
    const card = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('.phone-wall__card')
    if (card) {
      openLightbox(card)
    }
  }
})

/* ---------------- 视频：只播放可见区域 ---------------- */

let observer: IntersectionObserver | undefined
function observeVideos() {
  observer?.disconnect()
  if (!wallRef.value) {
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
  }), { root: wallRef.value, rootMargin: '0px 200px' })
  wallRef.value.querySelectorAll('video').forEach(video => observer!.observe(video))
}

watch([isPaused, isReduced], ([paused, reduced]) => {
  if (paused || reduced) {
    wallRef.value?.querySelectorAll('video').forEach(video => video.pause())
  }
  else {
    observeVideos()
  }
})
watch([rowCount, copies, cardH], () => nextTick(observeVideos))

/** 每个视频从随机时间点开始，同一素材同时出现时画面也不同 */
function onVideoLoaded(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video.duration) {
    video.currentTime = Math.random() * video.duration
  }
}

/* ---------------- 灯箱：从卡片位置放大到中央 ---------------- */

const lightboxOn = ref(false)
const lbMoveRef = useTemplateRef<HTMLElement>('lbMove')
let lbCard: HTMLElement | null = null

const lbFrame = computed(() => {
  const pad = Math.min(Math.max(window.innerWidth * 0.05, 16), 64) * 2
  const maxH = window.innerHeight - pad
  const h = Math.min(maxH, 720)
  return { width: Math.round(h * CONFIG.videoAspect), height: Math.round(h) }
})

function flipTo(rect: DOMRect) {
  const move = lbMoveRef.value
  if (!move) {
    return
  }
  const f = move.getBoundingClientRect()
  move.style.transform = `translate(${rect.left - f.left}px,${rect.top - f.top}px) scale(${rect.width / f.width},${rect.height / f.height})`
}

async function openLightbox(card: HTMLElement) {
  const video = card.querySelector('video')
  if (!video) {
    return
  }
  lbCard = card
  lightbox.value = { src: video.currentSrc || video.src, time: video.currentTime, from: card.getBoundingClientRect() }
  await nextTick()
  const move = lbMoveRef.value
  if (!move) {
    return
  }
  move.style.transition = 'none'
  flipTo(lightbox.value.from)
  move.getBoundingClientRect() // 强制回流
  requestAnimationFrame(() => {
    lightboxOn.value = true
    move.style.transition = ''
    move.style.transform = 'none'
  })
}

function onLightboxVideoLoaded(event: Event) {
  const video = event.target as HTMLVideoElement
  video.currentTime = lightbox.value?.time ?? 0
  video.muted = false
  video.play().catch(() => {
    video.muted = true
    video.play().catch(() => {})
  })
}

function closeLightbox() {
  if (!lightbox.value) {
    return
  }
  if (lbCard) {
    flipTo(lbCard.getBoundingClientRect())
  }
  lightboxOn.value = false
  setTimeout(() => {
    lightbox.value = null
    last = performance.now()
  }, 400)
}
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeLightbox()
  }
})

onMounted(() => {
  last = performance.now()
  raf = requestAnimationFrame(tick)
  nextTick(observeVideos)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
})
</script>

<template>
  <section
    ref="section"
    class="phone-wall flex flex-col items-center overflow-hidden bg-[var(--colors-background-bg-page)] pt-24"
    aria-labelledby="phone-wall-title"
  >
    <!-- 上：图标 + 文案 + 按钮，居中 -->
    <div class="flex shrink-0 flex-col items-center px-6 text-center">
      <div class="phone-wall__icon size-14 flex items-center justify-center rounded-full">
        <RxSvgIcon name="base/rx_ic_cloud_phone" size="30" color="var(--colors-icon-icon-brand)" aria-hidden="true" />
      </div>
      <h2 id="phone-wall-title" class="m-0 mt-5 text-6 font-600 leading-8 tt-primary">
        {{ $t('创建你的第一台云手机') }}
      </h2>
      <p class="m-0 mt-2 text-3.5 font-400 leading-5 tt-secondary">
        {{ $t('创建第一台云手机，免费体验 30 分钟') }}
      </p>
      <div class="mt-6 flex items-center gap-5">
        <RxButton size="md" icon="base/rx_ic_plus" :label="$t('创建云手机')" @click="emit('create')" />
        <a :href="CLOUD_PHONE_INTRO_URL" target="_blank" rel="noopener noreferrer" class="phone-wall__link inline-flex items-center gap-1 text-3 font-500 leading-4 no-underline">
          {{ $t('了解云手机') }}
          <RxSvgIcon name="base/rx_ic_arrow_right" size="12" aria-hidden="true" />
        </a>
      </div>
    </div>

    <!-- 下：横向滚动的视频墙，可左右拖动 -->
    <div
      ref="wall"
      class="phone-wall__wall relative mt-16 min-h-0 w-full flex-1 select-none"
      :class="{ 'is-grabbing': grabbing }"
      :style="{ '--card-w': `${cardW}px`, '--card-h': `${cardH}px`, '--gap': `${CONFIG.gap}px` }"
      @pointerdown="onPointerDown"
    >
      <div class="absolute inset-0 flex flex-col justify-start gap-[var(--gap)] overflow-hidden">
        <div v-for="(row, r) in rows" :key="`${r}-${rowCount}`" class="relative h-[var(--card-h)] shrink-0">
          <div :ref="el => { if (el) trackRefs[r] = el as HTMLElement }" class="absolute left-0 top-0 flex gap-[var(--gap)] will-change-transform">
            <div
              v-for="(src, k) in row" :key="k"
              class="phone-wall__card relative h-[var(--card-h)] w-[var(--card-w)] shrink-0 cursor-pointer overflow-hidden rounded-[14px]"
              role="button" :aria-label="`Video ${(k % videos.length) + 1}`"
            >
              <div class="phone-wall__media absolute inset-0">
                <video
                  :src="src" muted loop playsinline preload="metadata" draggable="false"
                  class="pointer-events-none block h-full w-full object-cover"
                  @loadedmetadata="onVideoLoaded"
                />
              </div>
              <div class="phone-wall__glyph absolute right-2 top-2 size-6 flex items-center justify-center rounded-full">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 灯箱 -->
    <Teleport to="body">
      <div
        v-if="lightbox" class="phone-wall__lb fixed inset-0 z-2000 flex items-center justify-center"
        :class="{ 'is-on': lightboxOn }" @click.self="closeLightbox"
      >
        <div ref="lbMove" class="phone-wall__lb-move">
          <div class="relative overflow-hidden rounded-4 bg-black" :style="{ width: `${lbFrame.width}px`, height: `${lbFrame.height}px` }">
            <video :src="lightbox.src" loop playsinline controls class="absolute inset-0 block h-full w-full object-contain" @loadedmetadata="onLightboxVideoLoaded" />
          </div>
        </div>
        <button class="phone-wall__lb-close absolute right-5 top-5 size-10 flex cursor-pointer items-center justify-center rounded-full" :aria-label="$t('关闭')" @click="closeLightbox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.phone-wall__icon {
  background: color-mix(in srgb, var(--colors-icon-icon-brand) 12%, transparent);
}

.phone-wall__link {
  color: var(--colors-icon-icon-brand);
  transition: opacity 0.2s ease;
}

.phone-wall__link:hover {
  opacity: 0.8;
}

/* 左右边缘淡出 */
.phone-wall__wall {
  touch-action: pan-y;
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 96px, #000 calc(100% - 96px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 96px, #000 calc(100% - 96px), transparent 100%);
}

.phone-wall__card {
  background: #141416;
  isolation: isolate;
  transform: translateZ(0);
}

.phone-wall__media {
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-wall__card:hover .phone-wall__media {
  transform: scale(1.06);
}

.phone-wall__glyph {
  background: rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(8px);
  pointer-events: none;
  opacity: 0;
  transform: scale(0.85);
  transition:
    opacity 0.3s ease,
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-wall__card:hover .phone-wall__glyph {
  opacity: 1;
  transform: none;
}

.is-grabbing,
.is-grabbing .phone-wall__card {
  cursor: grabbing;
}

.is-grabbing .phone-wall__card:hover .phone-wall__media {
  transform: none;
}

/* 灯箱 */
.phone-wall__lb {
  background: rgba(8, 8, 10, 0.9);
  backdrop-filter: blur(14px);
  opacity: 0;
  transition: opacity 0.32s;
}

.phone-wall__lb.is-on {
  opacity: 1;
}

.phone-wall__lb-move {
  transform-origin: 0 0;
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-wall__lb-close {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.phone-wall__lb-close:hover {
  background: rgba(255, 255, 255, 0.16);
}
</style>
