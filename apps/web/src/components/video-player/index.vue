<script setup lang="ts">
interface Props {
  src: string
}

const props = defineProps<Props>()

const videoPlayerRef = useTemplateRef('videoPlayer')
const videoRef = useTemplateRef('video')
const isPlaying = ref(false)
const showControls = ref(true)
const duration = ref(0)
const currentTime = ref(0)
const isFullscreen = ref(false)

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
</script>

<template>
  <div ref="videoPlayer" class="video-player" @mouseenter="showControls = true" @mouseleave="handleMouseLeave">
    <video ref="video" class="w-full" :src="src" autoplay muted loop @timeupdate="updateTime" @pause="onPause"
      @play="onPlay" @loadedmetadata="onLoadedMetadata" @click="togglePlay" />

    <!-- 控件 -->
    <div class="controls"
      :class="{ 'opacity-0': !showControls && isPlaying, 'opacity-100': showControls || !isPlaying }">
      <!-- 进度条 -->
      <input v-model="currentTime" type="range" min="0" :max="duration" step="0.1" @input="seek">

      <div class="w-full flex items-center justify-between space-x-4">
        <!-- 播放/暂停按钮 -->
        <button class="text-white" @click.stop="togglePlay">
          <span v-if="!isPlaying">⏵</span>
          <span v-else>⏸</span>
        </button>

        <div class="flex items-center space-x-4">
          <!-- 时间显示 -->
          <div class="text-sm min-w-[60px] text-right">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </div>

          <!-- 全屏 -->
          <button @click="toggleFullscreen">
            ⛶
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
}

.controls {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  display: flex;
  color: #fff;
  height: 72px;
  padding: 12px 20px 20px 20px;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  align-self: stretch;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 100%);
}
</style>
