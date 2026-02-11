<script setup lang="ts">
import RxAvatar from '/@/components/rx-avatar'
import { useUserStore } from '/@/stores/user'
import { getRandomIntByRange } from '/@/utils'
import { defaultColors } from '/@/utils/constants'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useFileDialog } from '@vueuse/core'


const emit = defineEmits(['change'])

const { userInfo } = storeToRefs(useUserStore())
const [showToast] = useResponseToast()
const { open, onChange } = useFileDialog({
  accept: 'image/png, image/jpeg, image/jpg, image/bmp', // Set to accept only image files
  directory: false, // Select directories instead of files if set true
})

const modelValue = defineModel<string>()

const color = defaultColors[getRandomIntByRange(0, defaultColors.length - 1)]

onChange(async (files) => {
  if (!files?.length)
    return

  if (files[0]!.size > 2 * 1024 * 1024) {
    showToast(-1, $t('推荐尺寸为 64*64，最大不超过 2MB'))
    return
  }

  const localPath = await globalThis.electronAPI.getPathForFile(files[0]!)
  if (localPath) {
    const roxyPath = await globalThis.electronAPI.send('util:toMediaPath', localPath)

    if (roxyPath) {
      try {
        modelValue.value = await globalThis.electronAPI.send('user:uploadAvatar', localPath)
        emit('change')
      }
      catch (error) {
        showToast(-1, error as string)
      }
    }
  }
})

async function removeAvatar() {
  modelValue.value = ''
  emit('change')
}
</script>

<template>
  <div class="upload-area">
    <RxAvatar :avatar="userInfo.avatar" :name="userInfo.userName?.slice(0, 2)" :color="userInfo.avatarColor || color" :size="100" :font-size="52" />
    <div class="upload-area-buttons">
      <RxButton v-if="userInfo.avatar" outlined severity="secondary" size="sm" icon="base/rx_ic_delete" :label="$t('移除')" @click="removeAvatar" />
      <RxButton outlined severity="secondary" size="sm" icon="base/rx_ic_export" :label="$t('上传')" @click="open" />
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
