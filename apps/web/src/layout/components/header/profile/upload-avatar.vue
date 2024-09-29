<script setup lang="ts">
const modelValue = defineModel<string>()

async function uploadAvatar() {
  const path = await electronAPI.send('dialog:selectFile', [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'bmp'] }])
  const previewUrl = await electronAPI.send('util:to-mediaPath', path)
  modelValue.value = previewUrl
  // const res = await electronAPI.send('user:uploadAvatar', path)
  // console.log('res', res)
}
</script>

<template>
  <div class="upload-area">
    <img class="upload-area-avatar" :src="modelValue || 'https://via.placeholder.com/64x64'">
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
