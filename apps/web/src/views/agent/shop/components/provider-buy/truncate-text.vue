<script setup lang="ts">
/**
 * 单行省略文本：文字放不下时显示「...」；鼠标移到所在选项上时，文字以跑马灯形式向左单向循环滚动，展示完整内容。
 * 悬停范围默认是父元素（整个选项），也可以在祖先元素上加 data-marquee-host 指定。
 */
const { text } = defineProps<{
  text?: string
}>()

/** 滚动速度（px/s），保证长短文案滚动节奏一致 */
const MARQUEE_SPEED = 34
/** 首尾两段文字之间的间隔（px） */
const MARQUEE_GAP = 32

const boxRef = useTemplateRef<HTMLElement>('boxRef')
const overflowed = ref(false)
const hovering = ref(false)
/** 文字完整宽度 */
const textWidth = ref(0)

const playing = computed(() => overflowed.value && hovering.value)
const marqueeStyle = computed(() => {
  // 每轮移动「一段文字 + 间隔」的距离，第二段文字正好接到第一段的位置，实现无缝循环
  const distance = textWidth.value + MARQUEE_GAP
  return {
    '--marquee-distance': `-${distance}px`,
    '--marquee-duration': `${distance / MARQUEE_SPEED}s`,
    '--marquee-gap': `${MARQUEE_GAP}px`,
  }
})

function measure() {
  const el = boxRef.value
  if (!el || playing.value) {
    return
  }
  textWidth.value = el.scrollWidth
  overflowed.value = el.scrollWidth > el.clientWidth + 1
}

let resizeObserver: ResizeObserver | undefined
let hostEl: HTMLElement | null = null
function onEnter() {
  measure()
  hovering.value = true
}
function onLeave() {
  hovering.value = false
}

watch(() => text, () => nextTick(measure), { flush: 'post' })

onMounted(() => {
  const el = boxRef.value
  if (!el) {
    return
  }
  measure()
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(el)
  hostEl = el.closest<HTMLElement>('[data-marquee-host]') ?? el.parentElement
  hostEl?.addEventListener('mouseenter', onEnter)
  hostEl?.addEventListener('mouseleave', onLeave)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  hostEl?.removeEventListener('mouseenter', onEnter)
  hostEl?.removeEventListener('mouseleave', onLeave)
})
</script>

<template>
  <span ref="boxRef" class="block min-w-0 overflow-hidden whitespace-nowrap" :class="playing ? '' : 'text-ellipsis'">
    <span :class="[$style.inner, playing && $style.playing]" :style="playing ? marqueeStyle : undefined">
      <slot>{{ text }}</slot>
      <!-- 循环滚动时追加一份副本，接在原文后面 -->
      <span v-if="playing" :class="$style.copy" aria-hidden="true"><slot>{{ text }}</slot></span>
    </span>
  </span>
</template>

<style lang="scss" module>
.inner {
  /* 继承外层的渐变文字（如「超高质量」），滚动时内层自己裁切出渐变 */
  background: inherit;
  -webkit-background-clip: inherit;
  background-clip: inherit;
}

.playing {
  display: inline-block;
  animation: marquee var(--marquee-duration) linear infinite;
}

.copy {
  padding-left: var(--marquee-gap);
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(var(--marquee-distance));
  }
}

@media (prefers-reduced-motion: reduce) {
  .playing {
    animation: none;
  }
}
</style>
