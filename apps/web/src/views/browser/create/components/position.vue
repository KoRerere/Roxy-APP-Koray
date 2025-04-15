<script setup lang="ts">
import { motion } from 'motion-v'
import { $t } from '/@/locales'

type Point = {
  x: number
  y: number
  pid: number
  [key: string]: any
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

const angleMap = {
  3: 'tr',
  6: 'tr',
  7: 'bl',
  8: 'bl',
  9: 'br',
}

const points = generateGridPoints(3, 3, CONTAINER_W, CONTAINER_H).map(item => ({ ...item, angle: angleMap[item.pid as keyof typeof angleMap] || 'tl' }))

watch(ratioPositon, () => {
  initPoints()
}, { immediate: true })

function initPoints() {
  if (ratioPositon.value) {
    const [rax, ray] = ratioPositon.value?.split(',')
    const point = points.find(item => {
      const { ratioX, ratioY } = getPointPosition(item)
      return Math.abs(ratioX - Number(rax)) < 0.0001 && Math.abs(ratioY - Number(ray)) < 0.0001
    })
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

function getPointPosition(point: Point) {
  const x = Math.min(point.x + PADDING, CONTAINER_W - RECT_W - PADDING)
  const y = Math.min(point.y + PADDING, CONTAINER_H - RECT_H - PADDING)
  const ratioX = point.x / CONTAINER_W
  const ratioY = point.y / CONTAINER_H
  return { x, y, ratioX, ratioY }
}

function handlePointClick(point: Point) {
  activeIndex.value = point.pid
  const { x: _x, y: _y, ratioX, ratioY } = getPointPosition(point)
  x.value = _x
  y.value = _y
  ratioPositon.value = `${ratioX},${ratioY},${point.angle}`
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

  &:hover {
    .point-mark:not(.active) {
      background: var(--Colors-border-border-inactive, #C7D1D6);
      box-shadow: 0px 0px 0px 2px var(--Colors-background-bg-page, #FFF), 0px 0px 0px 3px var(--Colors-border-border-subtle, #C7D1D6);
    }
  }

  &-mark {
    width: 6px;
    height: 6px;
    border-radius: 1px;
    background: #E9EEF2;
    box-shadow: 0px 0px 0px 2px var(--Colors-background-bg-page, #FFF), 0px 0px 0px 3px #E3E9EC;

    &.active {
      background: var(--Colors-background-bg-brand, #11A3FD);
      box-shadow: 0px 0px 0px 2px var(--Colors-background-bg-page, #FFF), 0px 0px 0px 3px rgba(17, 163, 253, 0.40);
    }
  }
}

.text {
  color: var(--Colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: normal;
}
</style>