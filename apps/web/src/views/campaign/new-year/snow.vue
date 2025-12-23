<script setup lang="ts">
import { getRandomIntByRange } from '/@/utils/basic'

interface Snowflake {
  /** 初始 X 位置 (0-1) */
  startX: number
  /** 当前 Y 进度 (0-1) */
  progress: number
  /** X 偏移量 */
  offsetX: number
  /** yoyo 时间点 (0.3-0.8) */
  yoyoTime: number
  /** 半径 */
  radius: number
  /** 下落速度 (每帧进度增量) */
  speed: number
  /** 透明度 */
  opacity: number
  /** 透明度档位 (用于批量绘制优化) */
  opacityLevel: number
}

const canvasRef = useTemplateRef('content')

const SNOWFLAKE_COUNT = 50
let animationId: number = 0
let snowflakes: Snowflake[] = []

onMounted(() => {
  initCanvas()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  snowflakes = []
})

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const rect = canvas.getBoundingClientRect()
  const width = rect.width
  const height = rect.height

  // 高 DPI 适配
  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)

  initSnowflakes()
  animate(ctx, width, height)
}

function initSnowflakes() {
  snowflakes = Array.from({ length: SNOWFLAKE_COUNT }, () => {
    const yoyoTime = getRandomIntByRange(30, 80) / 100
    const fallDuration = getRandomIntByRange(10, 30)
    // 速度 = 1 / (duration * 60fps)
    const speed = 1 / (fallDuration * 60)
    // 随机初始进度，模拟负延迟效果
    const initialProgress = Math.random()
    const opacity = Math.random() * 0.8 + 0.2

    return {
      startX: Math.random(),
      progress: initialProgress,
      offsetX: getRandomIntByRange(-10, 10) / 100,
      yoyoTime,
      radius: Math.random() * 4 + 1,
      speed,
      opacity,
      opacityLevel: Math.round(opacity * 10) / 10, // 量化为 10 个档位 (0.2, 0.3, ... 1.0)
    }
  })
    .toSorted((a, b) => a.opacityLevel - b.opacityLevel)// 按透明度档位排序，便于批量绘制
}

function animate(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)

  let currentOpacity = -1

  for (const flake of snowflakes) {
    // 只在透明度变化时切换样式并提交之前的路径
    if (flake.opacityLevel !== currentOpacity) {
      if (currentOpacity !== -1) {
        ctx.fill() // 提交上一批
      }
      ctx.beginPath()
      ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacityLevel})`
      currentOpacity = flake.opacityLevel
    }

    // 内联计算 X 位置
    const { startX, progress, offsetX, yoyoTime, radius } = flake
    const currentOffset = progress < yoyoTime
      ? offsetX * (progress / yoyoTime)
      : offsetX - (offsetX / 2) * ((progress - yoyoTime) / (1 - yoyoTime))
    const x = (startX + currentOffset) * width
    const y = progress * height

    // 直接添加到当前路径，不需要每次 beginPath
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)

    // 更新进度
    flake.progress += flake.speed

    // 循环回顶部
    if (flake.progress > 1) {
      flake.progress = 0
      flake.startX = Math.random()
    }
  }

  // 提交最后一批
  if (currentOpacity !== -1) {
    ctx.fill()
  }

  animationId = requestAnimationFrame(() => animate(ctx, width, height))
}
</script>

<template>
  <canvas ref="content" class="w-full h-full block bg-transparent snow" />
</template>

<style lang="scss" scoped>
.snow {
  mask-image: linear-gradient(to bottom, #fff 0%, #fff 70%, transparent 100%);
}
</style>
