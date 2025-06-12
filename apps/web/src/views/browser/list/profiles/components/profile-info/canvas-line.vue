<template>
  <div :class="['flex flex-col items-center justify-center', containerClass]">
    <canvas id="canvas" ref="canvasRef" class="absolute z-0" :style="{ filter: isSafari ? `blur(${blur}px)` : undefined }"></canvas>
    <div :class="['relative z-10', customClass]">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { createNoise3D } from "simplex-noise"

interface Props {
  customClass?: string
  containerClass?: string
  colors?: string[]
  waveWidth?: number
  backgroundFill?: string
  blur?: number
  speed?: 'slow' | 'fast'
  waveOpacity?: number
  animate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  customClass: '',
  containerClass: '',
  colors: () => ["#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#22d3ee"],
  waveWidth: 50,
  backgroundFill: 'transparent',
  blur: 10,
  speed: 'fast',
  waveOpacity: 1,
  animate: true
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const w = ref(0)
const h = ref(0)
const nt = ref(0)
const animationId = ref<number | null>(null)
const isSafari = ref(false)
const noise = createNoise3D()

const getSpeed = () => props.speed === "slow" ? 0.008 : 0.009

const init = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  ctx.value = canvas.getContext("2d")
  if (!ctx.value) return

  // 设置固定尺寸 100*100
  const fixedWidth = 100
  const fixedHeight = 24
  const pixelRatio = 2

  // 设置显示尺寸
  canvas.style.width = `${fixedWidth}px`
  canvas.style.height = `${fixedHeight}px`

  // 设置实际渲染尺寸（乘以 pixelRatio）
  w.value = ctx.value.canvas.width = fixedWidth * pixelRatio
  h.value = ctx.value.canvas.height = fixedHeight * pixelRatio

  // 缩放上下文以匹配 pixelRatio
  ctx.value.scale(pixelRatio, pixelRatio)
  ctx.value.filter = `blur(${props.blur}px)`

  render()
}

const drawWave = (n: number) => {
  if (!ctx.value) return

  if (props.animate) {
    nt.value += getSpeed()
  }

  for (let i = 0; i < n; i++) {
    ctx.value.beginPath()
    ctx.value.lineWidth = props.waveWidth
    ctx.value.strokeStyle = props.colors[i % props.colors.length]

    for (let x = 0; x < w.value; x += 5) {
      const y = noise(x / 80, 0.4 * i, nt.value) * 4
      ctx.value.lineTo(x, y + h.value * 0.25)
    }

    ctx.value.stroke()
    ctx.value.closePath()
  }
}

const render = () => {
  if (!ctx.value) return

  // 清除画布，使用clearRect代替fillRect以支持透明背景
  ctx.value.clearRect(0, 0, w.value, h.value)

  // 如果需要特定的背景色（非透明），则进行填充
  if (props.backgroundFill !== "transparent") {
    ctx.value.fillStyle = props.backgroundFill
    ctx.value.globalAlpha = props.waveOpacity
    ctx.value.fillRect(0, 0, w.value, h.value)
  }

  // 设置波浪线的透明度
  ctx.value.globalAlpha = props.waveOpacity
  drawWave(5)

  if (props.animate) {
    animationId.value = requestAnimationFrame(render)
  }
}

// 生命周期钩子
onMounted(() => {
  isSafari.value = typeof window !== "undefined" &&
    navigator.userAgent.includes("Safari") &&
    !navigator.userAgent.includes("Chrome")

  init()
})

onBeforeUnmount(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
})

// 监听动画状态变化
watch(() => props.animate, (newValue) => {
  if (newValue && !animationId.value) {
    render()
  } else if (!newValue && animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }
})
</script>