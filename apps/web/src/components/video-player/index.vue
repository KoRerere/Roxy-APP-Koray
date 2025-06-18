<template>
  <div class="video-player" @mouseenter="hover = true" @mouseleave="hover = false">
    <div v-if="!isPlaying && !error" class="preview-wrapper">
      <img :src="cover" class="cover" alt="video cover" />
      <button class="play-btn" v-if="hover" @click="play">
        ▶
      </button>
    </div>

    <video v-else-if="!error" ref="videoRef" :src="src" class="video" autoplay muted playsinline @ended="reset"
      @error="handleError" />

    <div v-if="error" class="error-state">
      <p>Oops! We've lost this video.</p>
      <button @click="retry">🔄 Refresh</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

defineProps<{
  src: string
  cover: string
}>()

const hover = ref(false)
const isPlaying = ref(false)
const error = ref(false)
const videoRef = ref<HTMLVideoElement>()

function play() {
  isPlaying.value = true
  error.value = false
}

function reset() {
  isPlaying.value = false
  videoRef.value?.load()
}

function retry() {
  error.value = false
  isPlaying.value = true
  nextTick(() => {
    videoRef.value?.play().catch(() => {
      error.value = true
    })
  })
}

function handleError() {
  error.value = true
}
</script>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.preview-wrapper {
  position: relative;
}

.cover {
  width: 100%;
  display: block;
  object-fit: cover;
}

.play-btn {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.8);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 18px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.video {
  width: 100%;
  height: auto;
}

.error-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  color: #fff;
  background-color: #000;
}

.error-state button {
  margin-top: 8px;
  padding: 6px 12px;
  background: white;
  border: none;
  cursor: pointer;
}
</style>
