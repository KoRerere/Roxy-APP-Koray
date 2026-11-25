<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useEventListener, usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'

/**
 * 云手机空状态
 * 整个空状态区域铺满一面手机轮廓墙（浅灰描边表示手机，不加外框），相邻列一上一下缓慢轮播；左侧文案 + 按钮叠在上面，
 * 用页面底色做从左到右的渐隐，保证文字可读。
 */
const emit = defineEmits<{ (e: 'create'): void }>()
const { t: $t } = useI18n()

// TODO: 换成云手机介绍页的正式地址
const CLOUD_PHONE_INTRO_URL = 'https://faq.roxybrowser.com/'

const sectionRef = useTemplateRef<HTMLElement>('section')
const boxRef = useTemplateRef<HTMLElement>('box')

/* ---------------- 尺寸：铺满表格区域剩余高度 ---------------- */

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

/* ---------------- 手机墙 ---------------- */

const PHONE_W = 180
const PHONE_H = 368
const PHONE_GAP = 18
const COLUMN_GAP = 18
/** 所有列统一的起始高度：进场时每一行都对齐成整齐的网格，轮播开始后才因一上一下自然错开 */
const GRID_TOP = 24
/**
 * 播放视频（Running）的手机：按 (2·行 + 列) % 3 === 0 斜向错落分布，
 * 每一列都有（包括文字后面的最左两列，会被渐隐遮罩压淡），左右、上下都不会挨在一起。
 */
function isVideoPhone(c: number, r: number) {
  return (r * 2 + c) % 3 === 0
}
/** 文字所在的最左两列不挂系统标签，避免和文案抢视线 */
const FIRST_LABEL_COLUMN = 2
/** 部分骨架手机挂系统标签（安卓图标 + 版本号），按伪随机挑选，文字所在的最左两列不放 */
const SYSTEM_VERSIONS = ['Android 12', 'Android 13', 'Android 14', 'Android 15']
function systemLabel(c: number, r: number) {
  if (c < FIRST_LABEL_COLUMN || (c * 7 + r * 3) % 4 !== 0) {
    return undefined
  }
  return SYSTEM_VERSIONS[(c * 3 + r * 5) % SYSTEM_VERSIONS.length]
}

/** 运行中的手机播放录屏视频，按出现顺序轮流分配素材 */
const videoModules = import.meta.glob<string>('/src/assets/videos/cloud-phone/*.mp4', {
  eager: true,
  query: '?url',
  import: 'default',
})
const videos = Object.keys(videoModules).sort().map(key => videoModules[key])

const { width: boxWidth, height: boxHeight } = useElementSize(boxRef)

/**
 * 进场动画：按行依次“贴”上手机，先填满第一行（从左到右），再第二行……
 * 全部贴完后才开始上下轮播。
 */
/**
 * 第一台出现前的等待（秒）
 */
const ENTER_BASE_DELAY = 0.1
/**
 * 相邻两台的间隔（秒）
 */
const ENTER_STEP = 0.08
/**
 * 手机很多时，所有手机贴完的最长用时（秒）
 */
const ENTER_MAX_SPREAD = 2
/**
 * 单台贴上去的动画时长（秒），与 CSS 一致
 */
const ENTER_DURATION = 0.76

/** 每列轮播速度 px/s：各列明显快慢不一（相邻列不会接近），滚动起来更有层次 */
const SPEEDS = [34, 52, 27, 44, 57, 30, 48, 38, 61, 25]

const documentVisibility = useDocumentVisibility()
const isPageHidden = computed(() => documentVisibility.value !== 'visible')
/** 进场动画是否已经结束：结束前不轮播、不播视频、不渲染屏幕外副本的内容、不开背景模糊 */
const entered = ref(false)

const layout = computed(() => {
  const step = PHONE_H + PHONE_GAP
  const count = Math.max(Math.ceil(boxWidth.value / (PHONE_W + COLUMN_GAP)) + 1, 6)
  /** 一组手机要盖住整列高度；渲染两组首尾相接，实现无缝循环 */
  // 取 3 的倍数：视频手机每 3 行一台，循环首尾相接时间隔也保持一致
  const rawRows = Math.max(Math.ceil((boxHeight.value + 260) / step) + 1, 3)
  const rows = Math.ceil(rawRows / 3) * 3

  /** 进场顺序：只给可见的手机排队，按行优先、行内从左到右 */
  const order = new Map<string, number>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < count; c++) {
      const top = GRID_TOP + r * step
      if (top < boxHeight.value && top + PHONE_H > 0) {
        order.set(`${c}-${r}`, order.size)
      }
    }
  }
  const interval = Math.min(ENTER_STEP, ENTER_MAX_SPREAD / Math.max(order.size - 1, 1))
  const lastDelay = ENTER_BASE_DELAY + Math.max(order.size - 1, 0) * interval
  return { step, count, rows, order, interval, lastDelay, total: lastDelay + ENTER_DURATION }
})

const columns = computed(() => {
  const { step, count, rows, order, interval, lastDelay } = layout.value
  const loop = rows * step
  return Array.from({ length: count }, (_, c) => {
    const speed = SPEEDS[c % SPEEDS.length]
    const reversed = c % 2 === 1
    /** 手机在墙里的横坐标（墙左侧 pl-3 = 12px） */
    const x = 12 + c * (PHONE_W + COLUMN_GAP)
    return {
      style: {
        'top': `${GRID_TOP}px`,
        '--loop': `${loop}px`,
        // 偶数列向上，奇数列向下
        'animationDuration': `${(loop / speed).toFixed(2)}s`,
        'animationDirection': reversed ? 'reverse' : 'normal',
      },
      phones: Array.from({ length: rows * 2 }, (_, r) => {
        const key = `${c}-${r % rows}`
        const isVideo = videos.length > 0 && isVideoPhone(c, r % rows)
        /** 轮播开始前，向上的列显示第一组、向下的列（反向动画停在终点）显示第二组 */
        const onStage = reversed ? r >= rows : r < rows
        /** 落点在屏幕上的纵坐标 */
        const y = GRID_TOP + (r % rows) * step
        return {
          // 标签文字：视频手机显示 Running，部分骨架手机显示系统版本
          tag: isVideo ? 'Running' : systemLabel(c, r % rows),
          onStage,
          video: isVideo ? videos[(c + (r % rows)) % videos.length] : undefined,
          // 骨架布局：0 列表 / 1 卡片 / 2 宫格 / 3 聊天 / 4 横幅列表 / 5 个人主页
          // 相邻（左右、上下）手机的布局一定不同
          layout: (c * 5 + (r % rows) * 2) % 6,
          // 每台手机的随机种子，用来微调骨架尺寸；两组副本相同，保证循环无缝
          seed: (c * 131 + (r % rows) * 71) % 997,
          style: {
            // 进场延迟：两组副本用同一延迟；看不到的手机放到最后
            'animationDelay': `${(order.has(key) ? ENTER_BASE_DELAY + order.get(key)! * interval : lastDelay).toFixed(3)}s`,
            // 从页面右下角外飞入：起点相对落点的位移；不在台面上的副本原地出现，避免划过屏幕
            '--from-x': onStage ? `${Math.round(boxWidth.value + 40 - x)}px` : '0px',
            '--from-y': onStage ? `${Math.round(boxHeight.value + 40 - y)}px` : '0px',
          },
        }
      }),
    }
  })
})

/** 由种子得到 [min, max] 之间稳定的伪随机数，用来让每台手机的骨架略有不同 */
function jitter(seed: number, i: number, min: number, max: number) {
  return min + ((seed * 37 + i * 53) % 101) / 100 * (max - min)
}

/**
 * 操作区背后的渐进式模糊：从左到右模糊半径依次减小，相邻层的作用区间互相重叠、过渡柔和。
 * 每层只在自己的区间内生效（mask），叠起来就是左边最糊、往右逐渐清晰。
 */
const BLUR_LAYERS = [
  { blur: 24, mask: 'linear-gradient(90deg, #000 0, #000 8%, transparent 18%)' },
  { blur: 14, mask: 'linear-gradient(90deg, transparent 2%, #000 10%, #000 16%, transparent 26%)' },
  { blur: 8, mask: 'linear-gradient(90deg, transparent 11%, #000 19%, #000 26%, transparent 35%)' },
  { blur: 4, mask: 'linear-gradient(90deg, transparent 21%, #000 29%, #000 35%, transparent 43%)' },
  { blur: 2, mask: 'linear-gradient(90deg, transparent 30%, #000 38%, transparent 51%)' },
]

/* ---------------- 视频：只播放屏幕内的，页面可见且允许动效时才播放 ---------------- */

const reducedMotion = usePreferredReducedMotion()

/** 每个视频从随机时间点开始，同一素材出现多次时画面也不同 */
function onVideoLoaded(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video.duration) {
    video.currentTime = Math.random() * video.duration
  }
}

/** 视频第一次真正开始出画面时再淡入，避免黑屏、跳帧直接闪出来 */
function onVideoPlaying(event: Event) {
  (event.target as HTMLVideoElement).classList.add('is-ready')
}

/**
 * 循环需要每列渲染两组手机，视频元素数量是屏幕上看到的两倍多；
 * 全部同时解码会和滚动抢资源导致卡顿，所以用 IntersectionObserver 只播放进入屏幕的视频。
 */
const onScreen = new WeakSet<HTMLVideoElement>()
let observer: IntersectionObserver | undefined

function canPlay() {
  return entered.value && !isPageHidden.value && reducedMotion.value !== 'reduce'
}

function applyVideo(video: HTMLVideoElement) {
  if (onScreen.has(video) && canPlay()) {
    video.play().catch(() => {})
  }
  else if (!video.paused) {
    video.pause()
  }
}

function observeVideos() {
  observer?.disconnect()
  if (!boxRef.value) {
    return
  }
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target as HTMLVideoElement
      if (entry.isIntersecting) {
        onScreen.add(video)
      }
      else {
        onScreen.delete(video)
      }
      applyVideo(video)
    })
  }, { root: boxRef.value, rootMargin: '80px 0px' })
  boxRef.value.querySelectorAll('video').forEach(video => observer!.observe(video))
}

function syncVideos() {
  boxRef.value?.querySelectorAll('video').forEach(applyVideo)
}

/** 全部手机贴完之后才开始轮播 */
let enterTimer: ReturnType<typeof setTimeout> | undefined
const stopEnterWatch = watch(boxHeight, (h) => {
  if (h <= 0) {
    return
  }
  stopEnterWatch()
  if (reducedMotion.value === 'reduce') {
    entered.value = true
    return
  }
  enterTimer = setTimeout(() => {
    entered.value = true
  }, layout.value.total * 1000)
})

onMounted(() => {
  tableWrapper.value = sectionRef.value?.closest<HTMLElement>('.table-wrapper') ?? null
  measureFillHeight()
})

watch([entered, isPageHidden, () => reducedMotion.value], syncVideos)
// 进场结束后屏幕外副本的视频才渲染，需要重新监听
watch([columns, entered], () => nextTick(observeVideos), { immediate: true })

onBeforeUnmount(() => {
  clearTimeout(enterTimer)
  observer?.disconnect()
})
</script>

<template>
  <div class="w-full">
    <section
      ref="section"
      class="relative w-full bg-[var(--colors-background-bg-page)]"
      :style="fillHeight ? { height: `${fillHeight}px` } : undefined"
      aria-labelledby="cloud-phone-empty-title"
    >
      <div
        ref="box"
        :class="{ 'is-entering': !entered }"
        class="cloud-phone-empty__box relative h-full min-h-105 w-full flex items-center overflow-hidden pl-26"
        :style="{ '--phone-w': `${PHONE_W}px`, '--phone-h': `${PHONE_H}px`, '--phone-gap': `${PHONE_GAP}px`, '--column-gap': `${COLUMN_GAP}px` }"
      >
        <!-- 背景：铺满卡片的示意手机墙 -->
        <div class="pointer-events-none absolute inset-0 flex select-none gap-[var(--column-gap)] pl-3" aria-hidden="true">
          <div v-for="(column, c) in (boxHeight > 0 ? columns : [])" :key="c" class="relative h-full w-[var(--phone-w)] shrink-0">
            <div
              class="cloud-phone-empty__track absolute left-0 flex flex-col gap-[var(--phone-gap)]"
              :class="{ 'is-paused': isPageHidden || !entered }" :style="column.style"
            >
              <div
                v-for="(phone, r) in column.phones" :key="r"
                class="cloud-phone-empty__phone relative h-[var(--phone-h)] w-[var(--phone-w)] shrink-0 rounded-[28px]"
                :class="{ 'is-offstage': !phone.onStage }"
                :style="phone.style"
              >
                <!-- 屏幕外的循环副本在进场结束前只保留外框，减少首屏渲染量 -->
                <template v-if="phone.onStage || entered">
                  <!-- 运行中：录屏视频盖在骨架上，真正开始播放后才淡入，加载期间看到的是骨架 -->
                  <video
                    v-if="phone.video"
                    :src="phone.video" muted loop playsinline :preload="entered ? 'metadata' : 'none'" draggable="false"
                    class="cloud-phone-empty__video absolute inset-0 z-1 block h-full w-full rounded-[24px] object-cover"
                    @loadedmetadata="onVideoLoaded" @playing="onVideoPlaying"
                  />
                  <!-- 简单骨架：6 种布局 + 每台手机的尺寸/位置略有随机，避免看起来千篇一律 -->
                  <div
                    class="absolute inset-0 overflow-hidden rounded-[24px] px-3.5"
                    :style="{ paddingTop: `${34 + jitter(phone.seed, 0, 0, 10)}px` }"
                  >
                    <!-- 状态栏：时间 + 信号 / Wi-Fi / 电池 -->
                    <div class="cloud-phone-empty__status absolute left-4.5 right-4 top-3.5 flex items-center justify-between">
                      <span class="text-2.25 font-600 leading-3">9:41</span>
                      <div class="flex items-center gap-1">
                        <svg width="13" height="9" viewBox="0 0 13 9" fill="currentColor"><rect x="0" y="6" width="2.2" height="3" rx=".6" /><rect x="3.4" y="4.2" width="2.2" height="4.8" rx=".6" /><rect x="6.8" y="2.2" width="2.2" height="6.8" rx=".6" /><rect x="10.2" y="0" width="2.2" height="9" rx=".6" /></svg>
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="currentColor"><path d="M6 1.2c1.9 0 3.6.7 4.9 1.9l.9-.95A8.4 8.4 0 0 0 6 0 8.4 8.4 0 0 0 .2 2.15l.9.95A7.1 7.1 0 0 1 6 1.2Zm0 2.5c1.2 0 2.3.45 3.1 1.2l.9-.95A5.6 5.6 0 0 0 6 2.5a5.6 5.6 0 0 0-4 1.45l.9.95A4.4 4.4 0 0 1 6 3.7Zm0 2.5c.5 0 .95.2 1.3.5L6 8.1 4.7 6.7c.35-.3.8-.5 1.3-.5Z" /></svg>
                        <svg width="20" height="9" viewBox="0 0 20 9" fill="none"><rect x=".5" y=".5" width="16" height="8" rx="2.2" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="11" height="5" rx="1.2" fill="currentColor" /><path d="M18 3v3c.6-.2 1-.8 1-1.5S18.6 3.2 18 3Z" fill="currentColor" opacity=".5" /></svg>
                      </div>
                    </div>
                    <!-- 0 列表：头像 + 两行字 -->
                    <template v-if="phone.layout === 0">
                      <div v-for="i in 3 + (phone.seed % 2)" :key="i" class="mb-3.5 flex items-center gap-2.5">
                        <div class="cloud-phone-empty__sk size-7 shrink-0 rounded-full" />
                        <div class="flex-1">
                          <div class="cloud-phone-empty__sk mb-1.5 h-2 rounded-1" :style="{ width: `${jitter(phone.seed, i, 40, 75)}%` }" />
                          <div class="cloud-phone-empty__sk h-1.5 rounded-1" :style="{ width: `${jitter(phone.seed, i + 7, 60, 95)}%` }" />
                        </div>
                      </div>
                    </template>
                    <!-- 1 卡片：大图 + 标题 -->
                    <template v-else-if="phone.layout === 1">
                      <div class="cloud-phone-empty__sk mb-3 rounded-3" :style="{ height: `${jitter(phone.seed, 1, 110, 170)}px` }" />
                      <div class="cloud-phone-empty__sk mb-2 h-2.5 rounded-1" :style="{ width: `${jitter(phone.seed, 2, 50, 80)}%` }" />
                      <div class="cloud-phone-empty__sk h-1.5 rounded-1" :style="{ width: `${jitter(phone.seed, 3, 65, 95)}%` }" />
                    </template>
                    <!-- 2 宫格：搜索框 + 两格商品 -->
                    <template v-else-if="phone.layout === 2">
                      <div class="cloud-phone-empty__sk mb-3 h-6 rounded-full" />
                      <div class="grid grid-cols-2 gap-2.5">
                        <div v-for="i in 2" :key="i">
                          <div class="cloud-phone-empty__sk aspect-square rounded-2" />
                          <div class="cloud-phone-empty__sk mt-1.5 h-1.5 rounded-1" :style="{ width: `${jitter(phone.seed, i, 55, 90)}%` }" />
                          <div class="cloud-phone-empty__sk mt-1 h-1.5 rounded-1" :style="{ width: `${jitter(phone.seed, i + 5, 30, 55)}%` }" />
                        </div>
                      </div>
                    </template>
                    <!-- 3 聊天：左右交替的气泡 -->
                    <template v-else-if="phone.layout === 3">
                      <div
                        v-for="i in 4" :key="i" class="cloud-phone-empty__sk mb-2.5 h-5 rounded-2.5"
                        :class="(i + phone.seed) % 2 ? 'mr-auto' : 'ml-auto'"
                        :style="{ width: `${jitter(phone.seed, i, 45, 75)}%` }"
                      />
                    </template>
                    <!-- 4 横幅 + 缩略图列表 -->
                    <template v-else-if="phone.layout === 4">
                      <div class="cloud-phone-empty__sk mb-3 rounded-2" :style="{ height: `${jitter(phone.seed, 1, 56, 84)}px` }" />
                      <div v-for="i in 2" :key="i" class="mb-3 flex gap-2.5">
                        <div class="cloud-phone-empty__sk size-10 shrink-0 rounded-2" />
                        <div class="flex-1 pt-1">
                          <div class="cloud-phone-empty__sk mb-1.5 h-2 rounded-1" :style="{ width: `${jitter(phone.seed, i, 55, 90)}%` }" />
                          <div class="cloud-phone-empty__sk h-1.5 rounded-1" :style="{ width: `${jitter(phone.seed, i + 3, 35, 65)}%` }" />
                        </div>
                      </div>
                    </template>
                    <!-- 5 个人主页：居中头像 + 三格相册 -->
                    <template v-else>
                      <div class="cloud-phone-empty__sk mx-auto mb-2.5 mt-2 size-12 rounded-full" />
                      <div class="cloud-phone-empty__sk mx-auto mb-1.5 h-2 rounded-1" :style="{ width: `${jitter(phone.seed, 1, 35, 55)}%` }" />
                      <div class="cloud-phone-empty__sk mx-auto mb-4 h-1.5 rounded-1" :style="{ width: `${jitter(phone.seed, 2, 25, 40)}%` }" />
                      <div class="grid grid-cols-3 gap-1">
                        <div v-for="i in 3 + 3 * (phone.seed % 2)" :key="i" class="cloud-phone-empty__sk aspect-square rounded-1" />
                      </div>
                    </template>
                  </div>
                  <div
                    v-if="phone.tag"
                    class="cloud-phone-empty__tag absolute left-1/2 flex items-center gap-1.25 whitespace-nowrap rounded-full px-3 py-0.75 text-2.75 font-500 leading-4 tt-secondary bottom-4.5 z-1 -translate-x-1/2"
                  >
                    <RxSvgIcon name="platforms/rx_os_android" size="18" class="cloud-phone-empty__android" aria-hidden="true" />{{ phone.tag }}
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作区背后的模糊 + 渐隐遮罩：都从左到右逐渐变弱 -->
        <div
          v-for="(layer, i) in (entered ? BLUR_LAYERS : [])" :key="i"
          class="cloud-phone-empty__blur pointer-events-none absolute inset-0" aria-hidden="true"
          :style="{ '--blur': `${layer.blur}px`, '--mask': layer.mask }"
        />
        <div class="cloud-phone-empty__fade pointer-events-none absolute inset-0" aria-hidden="true" />

        <!-- 前景：文案与按钮 -->
        <div class="cloud-phone-empty__intro relative z-1 max-w-100 w-[40%] flex shrink-0 flex-col items-start -translate-y-10">
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
      </div>
    </section>
  </div>
</template>

<style scoped>
.cloud-phone-empty__box {
  /* 动画曲线与时长，参考站内其他页面的动效规范 */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); /* 内容入场、指示条移动 */
  --ease-panel: cubic-bezier(0.22, 1, 0.36, 1); /* 面板入场 */
  --dur-enter: 760ms; /* 内容滚动入场（淡入 + 向上移动） */
  --dur-panel: 520ms; /* 面板入场 */
  --dur-quick: 200ms; /* 小交互 */
  --page: var(--colors-background-bg-page);
  background: var(--page);
}

.cloud-phone-empty__phone {
  background: var(--page);
  /* 粗而浅的机身边框 */
  border: 4px solid color-mix(in srgb, var(--colors-border-border-inactive) 35%, var(--page));
}

.cloud-phone-empty__video {
  /* 单独成层，避免滚动时和视频帧更新互相触发重绘 */
  transform: translateZ(0);
  opacity: 0;
  transition: opacity var(--dur-panel) var(--ease-panel);
}

/* 第一次真正出画面后淡入，之后暂停/继续都保持可见 */
.cloud-phone-empty__video.is-ready {
  opacity: 1;
}

.cloud-phone-empty__android {
  flex-shrink: 0;
}

.cloud-phone-empty__status {
  color: color-mix(in srgb, var(--colors-text-text-primary) 28%, transparent);
}

.cloud-phone-empty__sk {
  background: color-mix(in srgb, var(--colors-text-text-primary) 5%, transparent);
}

.cloud-phone-empty__tag {
  background: var(--page);
  border: 1px solid var(--colors-border-border-inactive);
}

/* 操作区背后：渐进式背景模糊，多层不同半径的模糊各自只作用于一段宽度，叠出左强右弱 */
.cloud-phone-empty__blur {
  animation: cloud-phone-fade-in var(--dur-panel) var(--ease-panel) both;
  backdrop-filter: blur(var(--blur)) saturate(1.3);
  -webkit-mask-image: var(--mask);
  mask-image: var(--mask);
}

/* 操作区背后：页面底色遮罩，从左到右越来越透明 */
.cloud-phone-empty__fade {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--page) 80%, transparent) 0,
    color-mix(in srgb, var(--page) 62%, transparent) 30%,
    color-mix(in srgb, var(--page) 25%, transparent) 50%,
    transparent 66%
  );
}

.cloud-phone-empty__icon {
  background: color-mix(in srgb, var(--colors-icon-icon-brand) 12%, transparent);
}

.cloud-phone-empty__link {
  color: var(--colors-icon-icon-brand);
  transition: opacity var(--dur-quick) var(--ease-out-expo);
}

.cloud-phone-empty__link:hover {
  opacity: 0.8;
}

/* 纵向无缝轮播：从 0 移到 -一组手机的高度；向下的列反向播放 */
.cloud-phone-empty__track {
  animation: cloud-phone-column-scroll linear infinite;
  will-change: transform;
}

.cloud-phone-empty__track.is-paused {
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

/* 进场：每台手机从页面右下角飞出，沿直线贴到自己的位置，落定时轻微回弹 */
.cloud-phone-empty__phone {
  animation: cloud-phone-stick var(--dur-enter) var(--ease-out-expo) both;
}

/* 只有起止两帧，整段走同一条缓动曲线：前段快速飞出、尾段长长地减速落定 */
@keyframes cloud-phone-stick {
  from {
    opacity: 0;
    transform: translate3d(var(--from-x), var(--from-y), 0) scale(0.7) rotate(12deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-phone-empty__phone {
    animation: none;
  }
}
@keyframes cloud-phone-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 性能：每台手机的布局和绘制互相隔离；进场时只给要飞入的手机开合成层，结束后释放 */
.cloud-phone-empty__phone {
  contain: layout paint style;
}

.is-entering .cloud-phone-empty__phone:not(.is-offstage) {
  will-change: transform, opacity;
}

/* 屏幕外的循环副本不需要进场动画 */
.cloud-phone-empty__phone.is-offstage {
  animation: none;
}
/* 左侧文案入场：淡入 + 向上移动（用独立的 translate 属性，不影响原有的 -translate-y-10） */
.cloud-phone-empty__intro {
  animation: cloud-phone-intro var(--dur-enter) var(--ease-out-expo) both;
}

@keyframes cloud-phone-intro {
  from {
    opacity: 0;
    translate: 0 16px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-phone-empty__intro {
    animation: none;
  }
}
</style>
