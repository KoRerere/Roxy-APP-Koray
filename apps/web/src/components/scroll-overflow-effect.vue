<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

type OverflowEffectMode = 'indicator' | 'shadow' | 'opening' | 'mask'

interface Props {
  mode?: OverflowEffectMode
  light?: boolean
  shadowHeight?: number
  shadowOpacity?: number
  edgeThreshold?: number
  maskSize?: number
  width?: string
  aspectRatio?: string
  maxHeight?: string
  resizable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'opening',
  light: false,
  shadowHeight: 12,
  shadowOpacity: 0.5,
  edgeThreshold: 16,
  maskSize: 100,
  width: '36ch',
  aspectRatio: '3 / 4',
  maxHeight: 'calc(100vh - 2rem)',
  resizable: false,
})

const scrollerRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()

const topProgress = ref(0)
const bottomProgress = ref(1)
const hasOverflow = ref(false)

let resizeObserver: ResizeObserver | null = null
let rafId = 0

const shellStyle = computed(() => ({
  width: props.width,
  aspectRatio: props.aspectRatio,
  maxHeight: props.maxHeight,
}))

const scrollerStyle = computed(() => ({
  '--scroll-progress-top': `${topProgress.value}`,
  '--scroll-progress-bottom': `${bottomProgress.value}`,
  '--shadow-alpha': `${props.shadowOpacity}`,
  '--shadow-height': `${props.shadowHeight}px`,
  '--mask-top-size': `${topProgress.value * props.maskSize}px`,
  '--mask-bottom-size': `${(1 - bottomProgress.value) * props.maskSize}px`,
  // 仅在内容溢出（遮罩真正生效）时提升合成层；无溢出时释放，避免常驻空图层
  willChange: hasOverflow.value ? 'mask' : 'auto',
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function syncScrollState() {
  const scroller = scrollerRef.value

  if (!scroller)
    return

  const maxScroll = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
  hasOverflow.value = maxScroll > 0

  if (!hasOverflow.value) {
    topProgress.value = 0
    bottomProgress.value = 1
    return
  }

  const edgeThreshold = Math.max(props.edgeThreshold, 1)
  const scrollTop = scroller.scrollTop
  const remaining = maxScroll - scrollTop

  topProgress.value = clamp(scrollTop / edgeThreshold, 0, 1)
  bottomProgress.value = 1 - clamp(remaining / edgeThreshold, 0, 1)
}

function scheduleSync() {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(syncScrollState)
}

onMounted(async () => {
  await nextTick()
  scheduleSync()

  resizeObserver = new ResizeObserver(() => {
    scheduleSync()
  })

  if (scrollerRef.value)
    resizeObserver.observe(scrollerRef.value)

  if (contentRef.value)
    resizeObserver.observe(contentRef.value)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
})

watch(
  () => [props.edgeThreshold, props.maskSize, props.mode],
  () => {
    scheduleSync()
  },
)
</script>

<template>
  <div
    class="scroll-overflow-effect"
    :class="{
      'is-light': light,
      'is-resizable': resizable,
      'has-overflow': hasOverflow,
    }"
    :data-mode="mode"
  >
    <section
      ref="scrollerRef"
      class="scroll-overflow-effect__scroller"
      :style="scrollerStyle"
      @scroll.passive="scheduleSync"
    >
      <article ref="contentRef" class="scroll-overflow-effect__content">
        <div class="scroll-overflow-effect__indicator scroll-overflow-effect__indicator--top" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75 12 8.25l7.5 7.5" />
          </svg>
        </div>

        <div class="scroll-overflow-effect__body">
          <slot />
        </div>

        <div class="scroll-overflow-effect__indicator scroll-overflow-effect__indicator--bottom" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25 12 15.75 4.5 8.25" />
          </svg>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
.scroll-overflow-effect {
  --soe-bg: hsl(0 0% 10%);
  --soe-color: hsl(0 0% 85%);
  --soe-border: hsl(0 0% 20%);
  --soe-shadow: hsl(0 0% 0% / var(--shadow-alpha, 0.5));
  --soe-line: hsl(0 0% 95% / 0.16);
  overflow: hidden;
  // min-width: 240px;
  // min-height: 280px;
}

.scroll-overflow-effect.is-light {
  --soe-bg: hsl(0 0% 96%);
  --soe-color: hsl(0 0% 10%);
  --soe-border: hsl(0 0% 84%);
  --soe-shadow: hsl(0 0% 10% / var(--shadow-alpha, 0.18));
  --soe-line: hsl(0 0% 0% / 0.08);
}

.scroll-overflow-effect.is-resizable {
  resize: both;
}

.scroll-overflow-effect__scroller {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding-inline: 1rem;
  // border-radius: 16px;
  background: var(--soe-bg);
  color: var(--soe-color);
  box-shadow: 0 20px 40px -28px rgb(0 0 0 / 0.55);
  line-height: 1.7;
}

.scroll-overflow-effect__body :deep(p) {
  margin: 0;
}

.scroll-overflow-effect__body :deep(p + p) {
  margin-top: 1rem;
}

.scroll-overflow-effect__indicator {
  position: sticky;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: currentColor;
  pointer-events: none;
}

.scroll-overflow-effect__indicator svg {
  width: 22px;
  height: 22px;
}

.scroll-overflow-effect__indicator--top {
  top: 0;
}

.scroll-overflow-effect__indicator--bottom {
  bottom: 0;
}

.scroll-overflow-effect__indicator::before,
.scroll-overflow-effect__indicator::after {
  content: '';
  position: absolute;
  inset-inline: 0;
}

// [data-mode='indicator'] {
//   .scroll-overflow-effect__indicator {
//     height: 48px;
//     background: var(--soe-bg);
//   }

//   .scroll-overflow-effect__indicator::after {
//     inset-inline: -1rem;
//     background: var(--soe-bg);
//   }

//   .scroll-overflow-effect__indicator--top {
//     opacity: var(--scroll-progress-top);
//     border-bottom: 1px solid var(--soe-border);
//   }

//   .scroll-overflow-effect__indicator--bottom {
//     opacity: calc(1 - var(--scroll-progress-bottom));
//     border-top: 1px solid var(--soe-border);
//   }
// }

// [data-mode='shadow'] {
//   .scroll-overflow-effect__scroller {
//     padding: 0;
//     border: 1px solid var(--soe-border);
//     background: var(--soe-bg);
//   }

//   .scroll-overflow-effect__content {
//     min-height: auto;
//   }

//   .scroll-overflow-effect__body :deep(p) {
//     padding-inline: 1rem;
//   }

//   .scroll-overflow-effect__indicator {
//     height: 10px;
//   }

//   .scroll-overflow-effect__indicator svg {
//     display: none;
//   }

//   .scroll-overflow-effect__indicator::after {
//     height: var(--shadow-height);
//     background: var(--soe-shadow);
//   }

//   .scroll-overflow-effect__indicator--top {
//     transform-origin: 50% 0%;
//     scale: 1 var(--scroll-progress-top);
//   }

//   .scroll-overflow-effect__indicator--top::after {
//     top: 0;
//     mask: linear-gradient(white, transparent);
//   }

//   .scroll-overflow-effect__indicator--bottom {
//     transform-origin: 50% 100%;
//     scale: 1 calc(1 - var(--scroll-progress-bottom));
//   }

//   .scroll-overflow-effect__indicator--bottom::after {
//     bottom: 0;
//     mask: linear-gradient(transparent, white);
//   }
// }

// [data-mode='opening'] {
//   .scroll-overflow-effect__scroller {
//     padding: 0;
//     border-radius: 0;
//     background: transparent;
//     box-shadow: none;
//   }

//   .scroll-overflow-effect__content {
//     min-height: auto;
//   }

//   .scroll-overflow-effect__body :deep(p) {
//     padding-inline: 1rem;
//   }

//   .scroll-overflow-effect__indicator {
//     height: 10px;
//   }

//   .scroll-overflow-effect__indicator svg {
//     display: none;
//   }

//   .scroll-overflow-effect__indicator::after {
//     height: var(--shadow-height);
//     background: var(--soe-shadow);
//   }

//   .scroll-overflow-effect__indicator--top {
//     transform-origin: 50% 100%;
//     scale: 1 var(--scroll-progress-top);
//   }

//   .scroll-overflow-effect__indicator--top::after {
//     top: 0;
//     border-top: 1px solid var(--soe-border);
//     mask: linear-gradient(white, transparent);
//   }

//   .scroll-overflow-effect__indicator--bottom {
//     transform-origin: 50% 0%;
//     scale: 1 calc(1 - var(--scroll-progress-bottom));
//   }

//   .scroll-overflow-effect__indicator--bottom::after {
//     bottom: 0;
//     border-bottom: 1px solid var(--soe-border);
//     mask: linear-gradient(transparent, white);
//   }
// }

[data-mode='mask'] {
  // border-radius: 12px;
  // background: var(--soe-bg);

  .scroll-overflow-effect__scroller {
    padding: 0;
    // border-radius: 12px;
    background: transparent;
    mask:
      linear-gradient(white, transparent) 50% 0 / 100% var(--mask-top-size) no-repeat,
      linear-gradient(white, white) 50% 50% / 100% 100% no-repeat,
      linear-gradient(transparent, white) 50% 100% / 100% var(--mask-bottom-size) no-repeat;
    mask-composite: exclude;
  }

  .scroll-overflow-effect__body :deep(p) {
    padding-inline: 1rem;
  }

  .scroll-overflow-effect__indicator {
    display: none;
  }
}
</style>
