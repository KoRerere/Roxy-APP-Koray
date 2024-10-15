<script setup lang="ts">
import { getRandomInt } from '/@/utils'
import { defaultColors } from '/@/utils/constants'

defineProps({
  userName: String,
})

const emit = defineEmits(['change'])
const modelValue = defineModel<string>()
const previewUrl = ref(modelValue.value)

const color = defaultColors[getRandomInt(0, defaultColors.length - 1)]

async function uploadAvatar() {
  const localPath = await electronAPI.send('dialog:selectFile', [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'bmp'] }])
  if (localPath) {
    previewUrl.value = await electronAPI.send('util:toMediaPath', localPath)
    if (previewUrl.value) {
      try {
        modelValue.value = await electronAPI.send('user:uploadAvatar', localPath)
        emit('change')
      }
      catch (error) {
        console.log('🚀 ~ uploadAvatar ~ error:', error)
      }
    }
  }
}

async function removeAvatar() {
  previewUrl.value = ''
  modelValue.value = ''
  emit('change')
}
</script>

<template>
  <div class="upload-area">
    <img v-if="previewUrl" class="upload-area-avatar" :src="previewUrl">
    <div v-else class="upload-area-color" :style="{ backgroundColor: color }">
      {{ userName?.slice(0, 1) }}
    </div>
    <div class="upload-area-buttons">
      <RyButton v-if="previewUrl" outlined severity="secondary" size="small" icon="base/rx_ic_delete" label="Remove"
        @click="removeAvatar" />
      <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_export" label="Upload"
        @click="uploadAvatar" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.upload-area {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  height: 200px;
  border-radius: var(--radius-md, 6px);
  background: var(--Color-neutrals-100, #f0f3f5);

  &-avatar {
    width: 100px;
    aspect-ratio: 1;
    border-radius: 50%;
  }

  &-color {
    width: 100px;
    height: 100px;
    line-height: 100px;
    border-radius: 50%;
    text-align: center;
    color: #fff;
    font-family: 'JetBrains Mono';
    font-size: 52px;
    font-weight: 500;
  }

  &-buttons {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    gap: 8px;
  }
}
</style>
