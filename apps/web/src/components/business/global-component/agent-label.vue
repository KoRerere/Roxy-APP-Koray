<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { computed, onMounted, onUnmounted, reactive, ref, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { AnimatePresence, motion } from 'motion-v'

const props = defineProps({
  count: { type: Number, default: 3 },
  interval: { type: Number, default: 2000 },
})

// AI 批量发布、AI 智能养号、AI 批量私信、AI 自动控评、AI 视频脚本、AI 竞品分析、AI 智能获客、AI 智能选品
const agentText = [
  $t('AI 批量发布'),
  $t('AI 智能养号'),
  $t('AI 批量私信'),
  $t('AI 自动控评'),
  $t('AI 视频脚本'),
  $t('AI 竞品分析'),
  $t('AI 智能获客'),
  $t('AI 智能选品'),
]

const defaultText = 'Roxy AI Agent'

const sequence = computed(() => [
  defaultText,
  ...agentText,
  defaultText,
])

const innerRef = useTemplateRef('innerRef')
const size = reactive(
  useElementSize(innerRef, { width: 0, height: 0 }, { box: 'border-box' }),
)

const currentIndex = ref(0)
let timer: NodeJS.Timeout | null = null

onMounted(() => {
  timer = setInterval(() => {
    if (currentIndex.value < sequence.value.length - 1) {
      currentIndex.value++
    }
    else {
      timer && clearInterval(timer)
    }
  }, props.interval)
})

onUnmounted(() => {
  timer && clearInterval(timer)
})
</script>

<template>
  <div class="agent-container">
    <motion.div class="agent-pill" :animate="{ width: size.width || 'auto' }" :transition="{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }">
      <div ref="innerRef" class="agent-inner">
        <img :src="getImage('mcp/roxyagent.svg')" alt="">
        <AnimatePresence mode="wait">
          <motion.span :key="currentIndex" :initial="{ y: 20, opacity: 0, filter: 'blur(4px)' }" :animate="{ y: 0, opacity: 1, filter: 'blur(0px)' }"
                       :exit="{ y: -20, opacity: 0, filter: 'blur(4px)' }" :transition="{ duration: 0.3 }" class="text-4"
          >
            {{ sequence[currentIndex] }}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  </div>
</template>

<style lang="scss" scoped>
.agent-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.agent-pill {
  border-radius: 9999px;
  background: linear-gradient(100deg, #3faaf6 0%, #f359dc 50%, #f28fb0 100%);
  box-shadow: inset 0px 0px 0px 2px rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.agent-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 8px;
  width: max-content;

  span {
    font-family: Archivo;
    font-weight: 600;
    color: #fff;
    display: block;
    margin: 0;
    white-space: nowrap;
  }
}
</style>
