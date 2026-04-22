<script setup lang="ts">
import { computed, watch } from 'vue'
import StatusDialog from '~/components/status-dialog.vue'
import Unsupported from '~/components/unsupported.vue'
import Video from '~/components/video.vue'
import { getClient } from '~/runtime/client'
import { useVideoStore } from '~/store'

const client = getClient()
const videoStore = useVideoStore()

const supported = computed(() => client.supported)
const volume = computed(() => {
  const numberParam = Number.parseFloat(new URL(location.href).searchParams.get('volume') || '1.0')
  return Math.max(0.0, Math.min(Number.isNaN(numberParam) ? 100 : numberParam * 100, 100))
})

watch(
  volume,
  (nextVolume) => {
    if (new URL(location.href).searchParams.has('volume')) {
      videoStore.setVolume(nextVolume)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div id="roxy-cloud-browser">
    <Unsupported v-if="!supported" />
    <template v-else>
      <main class="roxy-cloud-browser-main">
        <div class="video-container">
          <Video />
        </div>
      </main>
      <StatusDialog />
    </template>
  </div>
</template>

<style lang="scss">
  #roxy-cloud-browser {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 100vw;
  max-height: 100vh;
  flex-direction: row;
  display: flex;

  .roxy-cloud-browser-main {
    max-width: 100%;
    flex-grow: 1;
    display: flex;

    .video-container {
      background: #000;
      max-width: 100%;
      flex-grow: 1;
      display: flex;
    }
  }
}

@media only screen and (max-width: 1024px) {
  html,
  body {
    overflow-y: auto !important;
    width: auto !important;
    height: auto !important;
  }

  body > p {
    display: none;
  }

  #roxy-cloud-browser {
    position: relative;
    max-height: initial !important;

    .roxy-cloud-browser-main {
      height: 100vh;
    }
  }
}
</style>
