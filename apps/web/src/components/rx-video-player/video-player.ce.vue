<script setup lang="ts">
import { $t } from '/@/locales'
import { useEventListener } from '@vueuse/core'

interface Props {
  src: string
}

const props = defineProps<Props>()

const videoPlayerRef = useTemplateRef('videoPlayer')
const videoRef = useTemplateRef('video')
const isPlaying = ref(false)
const showControls = ref(false)
const duration = ref(0)
const currentTime = ref(0)
const isFullscreen = ref(false)
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
function toggleFullscreen() {
  const video = videoRef.value
  if (!video)
    return

  isFullscreen.value = !isFullscreen.value

  if (animation) {
    animation.reverse()
    return
  }

  if (isFullscreen.value) {
    const keyframe = {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '1000',
    }
    animation = videoPlayerRef.value?.animate([
      {
        ...keyframe,
        offset: 0,
      },
      {
        ...keyframe,
        width: '85vw',
        offset: 1,
      },
    ], {
      duration: 300,
      easing: 'ease-in-out',
      fill: 'forwards',
    })
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
  videoRef.value?.play().catch(err => {
    console.error('重新播放失败：', err);
  });
}

// 监听空格键
useEventListener(document, 'keydown', (e) => {
  if (e.key === ' ') {
    togglePlay()
  }
})
</script>

<template>
  <div ref="videoPlayer" class="video-player" @mouseenter="showControls = true" @mouseleave="handleMouseLeave">
    <video ref="video" class="video" :src="src" autoplay muted loop @timeupdate="updateTime" @pause="onPause" @play="onPlay" @loadedmetadata="onLoadedMetadata" @click="togglePlay"
      @error="onPlayError" />

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

          <!-- 全屏 -->
          <div class="control-btn" @click="toggleFullscreen">
            <roxy-svg-icon :name="isFullscreen ? 'base/rx_ic_flod' : 'base/rx_ic_expand'" size="24" />
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
          <roxy-svg-icon name="base/rx_ic_refresh" size="16" :class="{ 'loading': isTryReLoading }" />
          {{ isTryReLoading ? $t('加载中...') : $t('重试') }}
        </div>
      </div>
    </div>
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
  background: linear-gradient(to right,
      #fff 0%,
      #fff v-bind(percentage),
      rgba(255, 255, 255, 0.5) v-bind(percentage),
      rgba(234, 234, 234, 0.5) 100%);
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
  position: relative;
  width: 100%;
  transform-origin: center;
  border-radius: 8px;
  overflow: hidden;
  // 不知为何底部会空出6px，所以需要clip-path
  clip-path: inset(0 0 6px 0 round 0 0 8px 8px);
  margin-bottom: -6px;
}

.video {
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
  background: rgba(0, 0, 0, 0.80);
  color: #FFF;
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
}

.controls {
  position: absolute;
  bottom: 6px;
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
    color: #FFF;
    text-align: center;
    font-family: Inter;
    font-size: 24px;
  }

  .play-error-mask-content-text {
    color: #FFF;
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
    border: 1px solid var(--colors-border-border-action, #C7D1D6);
    background: var(--colors-background-bg-action, #FFF);
    /* shadow-sm */
    box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
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
