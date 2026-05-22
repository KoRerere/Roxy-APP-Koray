<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { motion } from 'motion-v'
import { useThemeStore } from '/@/stores/theme'
import { useI18n } from 'vue-i18n'

const themeStore = useThemeStore()
const { locale } = useI18n()

const panelBgSrc = computed(() => {
  if (locale.value === 'zh-CN') {
    return themeStore.realTheme === 'dark' ? getImage('login/dark/agent/zh-CN/dark.png') : getImage('login/light/agent/zh-CN/light.png')
  }

  return themeStore.realTheme === 'dark' ? getImage('login/dark/agent/dark.png') : getImage('login/light/agent/light.png')
})

interface Category {
  /** v-for 稳定唯一 key */
  id: number
  img: string
  height: number
}

function getCategoryImageSrc(index: number) {
  if (locale.value === 'zh-CN') {
    return themeStore.realTheme === 'dark' ? getImage(`login/dark/agent/zh-CN/${index}.png`) : getImage(`login/light/agent/zh-CN/${index}.png`)
  }

  return themeStore.realTheme === 'dark'
    ? getImage(`login/dark/agent/${index}.png`)
    : getImage(`login/light/agent/${index}.png`)
}

const allCategories = computed(() =>
  [{
    height: 56,
  }, {
    height: locale.value === 'zh-CN' ? 56 : 94,
  }, {
    height: locale.value === 'zh-CN' ? 56 : 94,
  }, {
    height: 56,
  }].map((item, index) => ({ img: getCategoryImageSrc(index + 1), ...item })),
)

const INTRO_EASE = [0, 0.71, 0.2, 1.01] as const
const INTRO_DURATION = 1.2

/** ai-agent-body-item 入场时间轴（秒）：[开始动, 到达静止] */
const BODY_ITEM_ANIM_TIMINGS: ReadonlyArray<readonly [number, number]> = [
  [0.2, 1.2],
  [0.6, 1.6],
  [1, 2],
  [1.4, 2.4],
]

function getBodyItemTransition(index: number) {
  const [start, end] = BODY_ITEM_ANIM_TIMINGS[index] ?? BODY_ITEM_ANIM_TIMINGS.at(-1)!
  return { delay: start, duration: end - start, ease: INTRO_EASE }
}

const visibleCategories = ref<Category[]>([])
let nextUniqueId = 0
/** 主题切换或卸载时递增，丢弃未完成的 nextTick 填充 */
let sequenceToken = 0
/** 子项晚于父级挂载时递增，强制列表 motion 重挂载以重新播放入场动画 */
const bodyMotionKey = ref(0)

function createCategoryItem(item): Category {
  return { id: ++nextUniqueId, img: item.img, height: item.height }
}

function refillVisibleCategories() {
  sequenceToken++
  const token = sequenceToken
  visibleCategories.value = []
  nextUniqueId = 0

  nextTick(() => {
    if (token !== sequenceToken)
      return
    // 在 tick 内读取，避免与主题切换竞态时用到过期图片列表
    const imgs = allCategories.value
    visibleCategories.value = imgs.map(img => createCategoryItem(img))
    bodyMotionKey.value++
  })
}

onMounted(() => {
  refillVisibleCategories()
})

onUnmounted(() => {
  sequenceToken++
})

watch(allCategories, () => {
  refillVisibleCategories()
})
</script>

<template>
  <motion.div
    class="ai-agent-panel relative select-none"
    :initial="{ opacity: 0, y: 40 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: INTRO_DURATION, ease: INTRO_EASE }"
  >
    <img :src="panelBgSrc" alt="" class="ai-agent-panel__bg h-720px z-0" draggable="false">

    <div class="body absolute z-2 w-full left-0 pl-23 overflow-hidden" :class="locale === 'zh-CN' ? 'top-266px h-440px' : 'top-342px h-363px'">
      <motion.div
        :key="bodyMotionKey"
        class="ai-agent-body flex flex-col justify-end gap-5 h-400px"
      >
        <motion.div
          v-for="(category, index) in visibleCategories"
          :key="category.id"
          class="ai-agent-category ai-agent-body-item shrink-0"
          :initial="{ opacity: 0, y: 56, x: 0 }"
          :animate="{ opacity: 1, y: 0, x: 0 }"
          :transition="getBodyItemTransition(index)"
        >
          <img
            :src="category.img"
            class="ai-agent-category__title-img"
            :style="{ height: `${category.height}px` }"
            draggable="false"
          >
        </motion.div>
      </motion.div>
    </div>
  </motion.div>
</template>

<style lang="scss" scoped>
.ai-agent-panel {
  position: absolute;
  left: 110px;
  top: 220px;
}

.ai-agent-body {
  transform-origin: bottom center;
}

.ai-agent-body-item {
  transform-origin: bottom center;
}
</style>
