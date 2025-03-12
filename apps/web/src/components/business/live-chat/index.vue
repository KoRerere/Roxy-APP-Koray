<script setup lang="ts">
import { useWidgetIsReady } from '@livechat/widget-vue'
import { emitter, type MittEvents } from '/@/utils/eventBus'

const isWidgetReady = useWidgetIsReady()
const visibility = ref<MittEvents['toggleChatVisible']>('hidden')


function toggleChatVisible() {
  visibility.value = visibility.value === 'maximized' ? 'hidden' : 'maximized'
  emitter.emit('toggleChatVisible', visibility.value)
}

onErrorCaptured((err) => {
  console.error('LiveChatWidget error', err)
})
</script>

<template>
  <div class="cursor-pointer" @click="toggleChatVisible">
    <slot v-if="isWidgetReady" />
  </div>
</template>

<style></style>