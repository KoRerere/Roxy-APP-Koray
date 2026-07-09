<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const scrollRef = useTemplateRef<HTMLElement>('scroll')
const showTopMask = ref(false)
const showBottomMask = ref(false)

function updateMask() {
  const el = scrollRef.value
  if (!el)
    return

  const { scrollTop, scrollHeight, clientHeight } = el

  const canScroll = scrollHeight > clientHeight + 1
  if (!canScroll) {
    showTopMask.value = false
    showBottomMask.value = false
    return
  }

  showTopMask.value = scrollTop > 0
  showBottomMask.value = scrollTop + clientHeight < scrollHeight - 1
}

function handleScroll() {
  updateMask()
}

let stopResizeObserver: (() => void) | undefined

onMounted(() => {
  updateMask()

  const el = scrollRef.value
  if (!el)
    return

  const ro = new ResizeObserver(() => updateMask())
  ro.observe(el)

  stopResizeObserver = () => ro.disconnect()
})

onScopeDispose(() => {
  stopResizeObserver?.()
})

defineExpose({
  updateMask,
})
</script>

<template>
  <div class="relative overflow-hidden">
    <div v-if="showTopMask" class="mask top-mask" />
    <div ref="scroll" class="overflow-y-auto scroll" v-bind="$attrs" @scroll="handleScroll">
      <slot />
    </div>
    <div v-if="showBottomMask" class="mask bottom-mask" />
  </div>
</template>

<style lang="scss" scoped>
.scroll::-webkit-scrollbar {
  display: none;
}

.mask {
  position: absolute;
  width: 100%;
  height: 30px;
  flex-shrink: 0;
  pointer-events: none;
  z-index: 10;

  &.top-mask {
    top: 0;
    background: linear-gradient(0deg, transparent 0%, var(--colors-background-bg-overlay) 100%);
  }

  &.bottom-mask {
    bottom: 0;
    background: linear-gradient(180deg, transparent 0%, var(--colors-background-bg-overlay) 100%);
  }
}
</style>
