<script setup lang="ts">
import RxAvatar from '/@/components/rx-avatar'
import { getRandomInt } from '/@/utils'
import { defaultColors } from '/@/utils/constants'
import { useResponseToast } from '/@/hooks/useResponseToast'

defineProps({
  userName: String,
  avatarColor: String,
})

const emit = defineEmits(['change'])
const modelValue = defineModel<string>()
const previewUrl = ref(modelValue.value)
const [showToast] = useResponseToast()

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
        showToast(-1, error)
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
    <RxAvatar :avatar="previewUrl" :name="userName?.slice(0, 2)" :color="avatarColor || color" :size="100"
      :font-size="52" />
    <div class="upload-area-buttons">
      <RxButton v-if="previewUrl" outlined severity="secondary" size="sm" icon="base/rx_ic_delete" :label="$t('移除')"
        @click="removeAvatar" />
      <RxButton outlined severity="secondary" size="sm" icon="base/rx_ic_export" :label="$t('上传')"
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
  background: var(--colors-background-bg-block, #293038);

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
