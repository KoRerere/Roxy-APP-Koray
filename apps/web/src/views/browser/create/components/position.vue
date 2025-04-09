<script setup lang="ts">
import { motion } from 'motion-v'
import { $t } from '/@/locales'

type Point = {
  x: number
  y: number
  pid: number
}

const ratioPositon = defineModel<string>('modelValue')

const PADDING = 4
const RECT_W = 70
const RECT_H = 40
const CONTAINER_W = 228
const CONTAINER_H = 140

const x = ref(PADDING)
const y = ref(PADDING)
const activeIndex = ref(0)

const pointsStr = [$t('左上'), $t('中上'), $t('右上'), $t('左中'), $t('中间'), $t('右中'), $t('左下'), $t('中下'), $t('右下')]

const points = generateGridPoints(3, 3, CONTAINER_W, CONTAINER_H)

onBeforeMount(() => {
  initPoints()
})

function initPoints() {
  if (ratioPositon.value) {
    const [rax, ray] = ratioPositon.value?.split(',')
    const _x = Number(rax) * CONTAINER_W
    const _y = Number(ray) * CONTAINER_H
    const point = points.find(item => Math.floor(item.x - _x) === 0 && Math.floor(item.y - _y) === 0)
    if (point) {
      handlePointClick(point)
    }
  }
}

function generateGridPoints(rows: number = 3, cols: number = 3, containerWidth: number = 200, containerHeight: number = 200) {
  const points: Point[] = [];
  const cellWidth = containerWidth / (cols - 1);
  const cellHeight = containerHeight / (rows - 1);
  let pid = 0

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pid++
      points.push({
        x: col * cellWidth,
        y: row * cellHeight,
        pid
      })
    }
  }
  return points
}

function handlePointClick(point: Point) {
  activeIndex.value = point.pid
  x.value = Math.min(point.x + PADDING, CONTAINER_W - RECT_W - PADDING)
  y.value = Math.min(point.y + PADDING, CONTAINER_H - RECT_H - PADDING)

  const ratioX = (x.value - PADDING) / CONTAINER_W
  const ratioY = (y.value - PADDING) / CONTAINER_H

  ratioPositon.value = `${ratioX},${ratioY}`
}
</script>

<template>
  <div>
    <div class="box" :style="{ width: CONTAINER_W + 'px', height: CONTAINER_H + 'px' }">
      <div class="point" v-for="point in points" :key="point.pid" :style="{ left: point.x + 'px', top: point.y + 'px' }" @click="handlePointClick(point)">
        <div class="point-mark" :class="{ 'active': activeIndex === point.pid }"></div>
      </div>
      <motion.div class="relative z-10" :style="{ width: RECT_W + 'px', height: RECT_H + 'px' }" :animate="{ x, y }" :transition="{ duration: 0.35, ease: [0, 0.71, 0.2, 1.01], }">
        <img :style="{ width: RECT_W + 'px', height: RECT_H + 'px' }" src="/images/mini_browser.svg">
      </motion.div>
    </div>
    <div class="mt-4 text">{{ $t('窗口从{position}开始', { position: pointsStr[activeIndex - 1] }) }}</div>
  </div>
</template>

<style scoped lang="scss">
.box {
  position: relative;
  flex-shrink: 0;
  border: 1px dashed var(--Colors-border-border-subtle, #C7D1D6);
  background: var(--Colors-background-bg-block, #F1F5F8);

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    height: 100%;
    border-left: 1px dashed var(--Colors-border-border-subtle, #C7D1D6);
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 100%;
    border-top: 1px dashed var(--Colors-border-border-subtle, #C7D1D6);
  }
}

.point {
  position: absolute;
  transform: translate(-50%, -50%);
  flex-shrink: 0;
  padding: 12px;
  cursor: pointer;
  z-index: 1;

  &-mark {
    width: 6px;
    height: 6px;
    border-radius: 1px;
    background: var(--Colors-border-border-inactive, #C7D1D6);
    box-shadow: 0px 0px 0px 2px var(--Colors-background-bg-page, #FFF), 0px 0px 0px 3px var(--Colors-border-border-subtle, #C7D1D6);

    &.active {
      background: var(--Colors-background-bg-brand, #11A3FD);
      box-shadow: 0px 0px 0px 1px var(--Colors-background-bg-page, #FFF), 0px 0px 0px 3px var(--Colors-border-border-brand, #11A3FD);
    }
  }
}

.text {
  color: var(--Colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: normal;
}
</style>