<script setup lang="ts">

import { useEventListener } from '@vueuse/core'

interface Props {
  src: string
  scale?: boolean
  fullscreen?: boolean
  autoplay?: boolean
}

const { scale = false, fullscreen = false, autoplay = true } = defineProps<Props>()

const videoPlayerRef = useTemplateRef('videoPlayer')
const videoRef = useTemplateRef('video')
const isMuted = ref(autoplay)
const isPlaying = ref(false)
const showControls = ref(!autoplay)
const duration = ref(0)
const currentTime = ref(0)
const isScale = ref(false)
const isPlayError = ref(false)
const isTryReLoading = ref(false)

const percentage = computed(() => {
  return `${(currentTime.value - 0) / (duration.value - 0) * 100}%`
})

function togglePlay() {
  const video = videoRef.value
  if (!video)
    return

  if (video.paused) {
    video.play()
  }
  else {
    video.pause()
  }
}

function onFullscreen() {
  videoRef.value?.requestFullscreen?.()
}

function toggleVolume() {
  const video = videoRef.value
  if (!video)
    return
  isMuted.value = !video.muted
  video.muted = isMuted.value
}

function updateTime() {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

function onPause() {
  isPlaying.value = false
  showControls.value = true
}

function onPlay() {
  isPlaying.value = true
  isPlayError.value = false
  isTryReLoading.value = false
}

function onLoadedMetadata() {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

function seek() {
  if (videoRef.value) {
    videoRef.value.currentTime = currentTime.value
  }
}

function handleMouseLeave() {
  if (isPlaying.value) {
    showControls.value = false
  }
}

let animation: Animation | undefined
let originalRect: DOMRect | undefined

function toggleScale() {
  const videoPlayer = videoPlayerRef.value
  if (!videoPlayer)
    return

  isScale.value = !isScale.value

  if (isScale.value) {
    // 进入全屏模式
    enterScale()
  }
  else {
    // 退出全屏模式
    exitScale()
  }
}

function enterScale() {
  const videoPlayer = videoPlayerRef.value
  if (!videoPlayer)
    return

  // 保存当前位置和尺寸
  originalRect = videoPlayer.getBoundingClientRect()

  // 计算目标尺寸（85vw宽度，保持16:9比例）
  const targetWidth = window.innerWidth * 0.85
  const targetHeight = targetWidth * (9 / 16)

  // 计算目标位置（屏幕中心）
  const targetLeft = (window.innerWidth - targetWidth) / 2
  const targetTop = (window.innerHeight - targetHeight) / 2

  // 设置初始状态
  videoPlayer.style.position = 'fixed'
  videoPlayer.style.zIndex = '1001' // 确保在mask之上
  videoPlayer.style.transformOrigin = 'top left'

  // 执行动画 - 直接动画到目标位置和尺寸
  animation = videoPlayer.animate([
    {
      left: `${originalRect.left}px`,
      top: `${originalRect.top}px`,
      width: `${originalRect.width}px`,
      height: `${originalRect.height}px`,
    },
    {
      left: `${targetLeft}px`,
      top: `${targetTop}px`,
      width: `${targetWidth}px`,
      height: `${targetHeight}px`,
    },
  ], {
    duration: 400,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    fill: 'forwards',
  })
}

function exitScale() {
  if (!originalRect)
    return

  const videoPlayer = videoPlayerRef.value
  if (!videoPlayer)
    return

  // 获取当前的计算样式
  const currentStyles = window.getComputedStyle(videoPlayer)
  const currentLeft = Number.parseFloat(currentStyles.left) || 0
  const currentTop = Number.parseFloat(currentStyles.top) || 0
  const currentWidth = Number.parseFloat(currentStyles.width) || originalRect.width
  const currentHeight = Number.parseFloat(currentStyles.height) || originalRect.height

  // 执行反向动画
  const reverseAnimation = videoPlayer.animate([
    {
      left: `${currentLeft}px`,
      top: `${currentTop}px`,
      width: `${currentWidth}px`,
      height: `${currentHeight}px`,
    },
    {
      left: `${originalRect.left}px`,
      top: `${originalRect.top}px`,
      width: `${originalRect.width}px`,
      height: `${originalRect.height}px`,
    },
  ], {
    duration: 400,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    fill: 'forwards',
  })

  reverseAnimation.onfinish = () => {
    // 恢复原始样式
    videoPlayer.style.position = ''
    videoPlayer.style.zIndex = ''
    videoPlayer.style.left = ''
    videoPlayer.style.top = ''
    videoPlayer.style.width = ''
    videoPlayer.style.height = ''
    videoPlayer.style.transform = ''
    videoPlayer.style.transformOrigin = ''

    animation = undefined
    originalRect = undefined
  }
}

function formatTime(time: number): string {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

// 剩余播放时间，格式为：0:15
const remainingTime = computed(() => {
  return formatTime(duration.value - currentTime.value)
})

function onPlayError() {
  isPlayError.value = true
  isTryReLoading.value = false
}

function reloadVideo() {
  isTryReLoading.value = true
  videoRef.value?.load()
  videoRef.value?.play().catch((err) => {
    console.error('Failed to replay:', err)
  })
}

// 监听空格键
useEventListener(document, 'keydown', (e) => {
  if (e.key === ' ') {
    togglePlay()
  }
})

// 监听窗口大小变化
useEventListener(window, 'resize', () => {
  if (isScale.value && originalRect) {
    // 如果在全屏状态下窗口大小发生变化，重新计算动画
    exitScale()
    // 延迟一帧后重新进入全屏，确保新的窗口尺寸已经生效
    nextTick(() => {
      isScale.value = true
      enterScale()
    })
  }
})
</script>

<template>
  <div ref="videoPlayer" class="video-player">
    <div class="video-centent" @mouseenter="showControls = true" @mouseleave="handleMouseLeave">
      <video ref="video" class="video" :src="src" :autoplay="autoplay" :muted="autoplay" loop @timeupdate="updateTime" @pause="onPause" @play="onPlay" @loadedmetadata="onLoadedMetadata"
             @click.stop.prevent="togglePlay" @error="onPlayError"
      />

      <!-- 剩余播放时间 -->
      <div v-if="!showControls && !isPlayError" class="remaining-time">
        {{ remainingTime }}
      </div>

      <!-- 控件 -->
      <div class="controls" :class="{ hide: !showControls || isPlayError }">
        <!-- 进度条 -->
        <input v-model="currentTime" type="range" min="0" :max="duration" step="any" @input="seek">

        <div class="control-tools">
          <!-- 播放/暂停按钮 -->
          <div :class="{ 'playing-btn': isPlaying }" class="control-btn" @click.stop="togglePlay">
            <roxy-svg-icon :name="isPlaying ? 'base/rx_ic_pause2' : 'base/rx_ic_play'" size="24" />
          </div>

          <div class="control-right">
            <!-- 时间显示 -->
            <div class="time-text">
              {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
            </div>
            <div class="control-btn" @click="toggleVolume">
              <roxy-svg-icon :name="isMuted ? 'base/rx_ic_mute' : 'base/rx_ic_sound'" size="24" />
            </div>

            <div v-if="fullscreen" class="control-btn" @click="onFullscreen">
              <roxy-svg-icon name="base/rx_ic_expand" size="24" />
            </div>

            <!-- 放大，新特性里面的视频用 -->
            <div v-if="scale" class="control-btn" @click="toggleScale">
              <roxy-svg-icon :name="isScale ? 'base/rx_ic_flod' : 'base/rx_ic_expand'" size="24" />
            </div>
          </div>
        </div>
      </div>

      <!-- 播放错误蒙层 -->
      <div v-if="isPlayError" class="play-error-mask">
        <div class="play-error-mask-content">
          <div class="play-error-mask-content-title">
            {{ $t('视频加载失败!') }}
          </div>
          <div class="play-error-mask-content-text">
            {{ $t('网络连接已断开。') }}
          </div>
          <div class="play-error-mask-content-btn" @click="reloadVideo">
            <roxy-svg-icon name="base/rx_ic_refresh" size="16" :class="{ loading: isTryReLoading }" />
            {{ isTryReLoading ? $t('加载中...') : $t('重试') }}
          </div>
        </div>
      </div>
    </div>
    <slot name="after" />
  </div>
</template>

<style lang="scss" scoped>
* {
  box-sizing: border-box;
}

roxy-svg-icon {
  display: inline-flex;
}

input[type='range'] {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  appearance: none;
  background: linear-gradient(
    to right,
    #fff 0%,
    #fff v-bind(percentage),
    rgba(255, 255, 255, 0.5) v-bind(percentage),
    rgba(234, 234, 234, 0.5) 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
  }
}

.video-player {
  width: 100%;
  transform-origin: center;
}

.video-centent {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.video {
  display: block;
  width: 100%;
}

.remaining-time {
  position: absolute;
  left: 16px;
  bottom: 18px;
  display: flex;
  padding: 2px 10px;
  align-items: flex-end;
  gap: 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
}

.controls {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  display: flex;
  gap: 8px;
  color: #fff;
  height: 72px;
  padding: 12px 20px;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  align-self: stretch;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 100%);
  transition: opacity 0.15s ease-in-out;

  &.hide {
    opacity: 0;
  }
}

.control-tools {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.control-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.control-btn {
  cursor: pointer;
  display: flex;
  padding: 6px;
  align-items: center;
  gap: 10px;
}

.playing-btn {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.2);
}

.time-text {
  color: #fff;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 24px;
  user-select: none;
}

.play-error-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
  aspect-ratio: 16/9;
  border-radius: 8px;
  background:
    linear-gradient(0deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.6) 100%),
    url(<path-to-image>) lightgray 0px -23.885px / 100.401% 124.178% no-repeat;

  .play-error-mask-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .play-error-mask-content-title {
    color: #fff;
    text-align: center;
    font-family: Inter;
    font-size: 24px;
  }

  .play-error-mask-content-text {
    color: #fff;
    text-align: center;
    font-family: Inter;
    font-size: 16px;
  }

  .play-error-mask-content-btn {
    display: flex;
    min-width: 88px;
    padding: 8px var(--spacing-2xl, 16px);
    justify-content: center;
    align-items: center;
    gap: var(--spacing-lg, 8px);
    border-radius: var(--radius-lg, 8px);
    border: 1px solid var(--colors-border-border-action, #c7d1d6);
    background: var(--colors-background-bg-action, #fff);
    /* shadow-sm */
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    cursor: pointer;
    color: #111213;
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-lg, 14px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);

    .loading {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
