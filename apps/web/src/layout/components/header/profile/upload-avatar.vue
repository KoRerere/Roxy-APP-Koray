<script setup lang="ts">
const emit = defineEmits(['change'])
const modelValue = defineModel<string>()
const previewUrl = ref(modelValue.value)

async function uploadAvatar() {
  const localPath = await electronAPI.send('dialog:selectFile', [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'bmp'] }])

  previewUrl.value = await electronAPI.send('util:to-mediaPath', localPath)

  if (previewUrl.value) {
    try {
      const { url } = await electronAPI.send('user:uploadAvatar', localPath)
      modelValue.value = url
      emit('change')
    }
    catch (error) {
      console.log('🚀 ~ uploadAvatar ~ error:', error)
    }
  }
}
</script>

<template>
  <div class="upload-area">
    <img class="upload-area-avatar" :src="previewUrl || 'https://via.placeholder.com/64x64'">
    <div class="upload-area-buttons">
      <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_delete" label="Remove" />
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

  &-buttons {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    gap: 8px;
  }
}
</style>
