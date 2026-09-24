<script setup lang="ts">
import { useEventListener, useMutationObserver, useResizeObserver } from '@vueuse/core'

defineOptions({
  inheritAttrs: false,
})

const { showScrollbar = false } = defineProps<{
  /** 为 true 时显示滚动条；默认隐藏，避免短列表也露出轨道 */
  showScrollbar?: boolean
}>()

// 根节点只负责限高和遮罩定位；class/padding 落到滚动层，避免 pb 把底部遮罩挤到内容区外
const scrollRef = useTemplateRef<HTMLElement>('scroll')
const showTopMask = ref(false)
const showBottomMask = ref(false)

/** 根据滚动位置更新上下边缘遮罩 */
function updateMask() {
  const el = scrollRef.value
  if (!el) {
    return
  }

  const { scrollTop, scrollHeight, clientHeight } = el
  const canScroll = scrollHeight > clientHeight + 1
  showTopMask.value = canScroll && scrollTop > 0
  showBottomMask.value = canScroll && scrollTop + clientHeight < scrollHeight - 1
}

useEventListener(scrollRef, 'scroll', updateMask, { passive: true })
useResizeObserver(scrollRef, updateMask)
useMutationObserver(scrollRef, updateMask, { childList: true, subtree: true })

/** 滚到内容底部，露出新展开的表单 */
function scrollToBottom() {
  const el = scrollRef.value
  if (!el) {
    return
  }
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

defineExpose({
  updateMask,
  scrollToBottom,
})
</script>

<template>
  <div class="relative min-h-0 flex flex-col">
    <div ref="scroll" class="min-h-0 grow overflow-y-auto" :class="{ 'hide-scrollbar': !showScrollbar }" v-bind="$attrs">
      <slot />
    </div>
    <div
      v-show="showTopMask"
      class="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--colors-background-bg-overlay)] to-transparent"
    />
    <div
      v-show="showBottomMask"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[var(--colors-background-bg-overlay)] to-transparent"
    />
  </div>
</template>

<style lang="scss" scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  scrollbar-width: none;
}
</style>
