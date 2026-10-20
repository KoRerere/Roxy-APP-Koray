<script setup lang="ts">
import { useIntervalFn, usePreferredReducedMotion } from '@vueuse/core'
import { AnimatePresence, motion } from 'motion-v'
import { ref, watch } from 'vue'
import { easeOut } from './motion'

const { prefix, messages, active = true, prominent = false } = defineProps<{
  prefix: string
  messages: [string, string]
  active?: boolean
  prominent?: boolean
}>()

const preferredReducedMotion = usePreferredReducedMotion()
const activeIndex = ref(0)
const transition = { type: 'tween' as const, duration: 0.64, ease: easeOut }
const textClass = 'bg-gradient-to-b from-[#fbd99b] from-[30.17%] to-[#fcc67e] bg-clip-text text-transparent'

const { pause, resume } = useIntervalFn(() => {
  activeIndex.value = activeIndex.value === 0 ? 1 : 0
}, 3000, { immediate: false })

// 入场结束后再轮播；关闭时自动清理，减少动态效果模式下静态展示提醒。
watch(() => [active, preferredReducedMotion.value] as const, ([enabled, reducedMotion]) => {
  pause()
  activeIndex.value = 0
  if (enabled && reducedMotion !== 'reduce') {
    resume()
  }
}, { immediate: true })
</script>

<template>
  <motion.div class="flex flex-wrap items-center font-[Archivo] font-700" :class="prominent ? 'gap-x-3.75 text-12 leading-18' : 'gap-x-2.5 text-8 leading-12'" :layout="preferredReducedMotion !== 'reduce'" :transition="{ layout: transition }" role="heading" aria-level="2" :aria-label="`${prefix} · ${messages[activeIndex]}`" data-campaign-headline :data-active-index="activeIndex">
    <span class="shrink-0 whitespace-nowrap" :class="textClass" aria-hidden="true">{{ prefix }} ·</span>
    <span v-if="preferredReducedMotion === 'reduce'" :class="textClass" aria-hidden="true">{{ messages[0] }}</span>
    <!-- 隐形文字共同撑宽；进出共用缓出位移，始终从上方进入、下方退出。 -->
    <span v-else class="grid overflow-hidden max-w-full" aria-hidden="true">
      <span v-for="(message, index) in messages" :key="index" class="invisible col-start-1 row-start-1 whitespace-nowrap">
        {{ message }}
      </span>
      <AnimatePresence :initial="false">
        <motion.span :key="activeIndex" class="col-start-1 row-start-1 whitespace-nowrap" :class="textClass" :initial="{ y: '-100%' }" :animate="{ y: '0%' }" :exit="{ y: '100%' }" :transition="transition" data-headline-line :data-line-index="activeIndex">
          {{ messages[activeIndex] }}
        </motion.span>
      </AnimatePresence>
    </span>
  </motion.div>
</template>
