<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { tempUploadOssFile } from '/@/_temp/renderer-upload-oss-file'

defineProps<{
  label: string
  highlight?: string
}>()

const modelValue = defineModel<string>()

const [showToast] = useResponseToast()
const { userInfo } = storeToRefs(useUserStore())
const previewPath = ref('')
const uploading = ref(false)

const { open, onChange } = useFileDialog({
  accept: 'image/png, image/jpeg, image/jpg',
  directory: false,
})

/** 释放 blob 预览 URL，避免重复选择或卸载后泄漏 */
function revokePreviewPath() {
  if (previewPath.value.startsWith('blob:'))
    URL.revokeObjectURL(previewPath.value)
  previewPath.value = ''
}

onUnmounted(revokePreviewPath)

function getFileExt(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot) : ''
}

onChange(async (files) => {
  if (!files?.length)
    return

  const file = files[0]!
  if (file.size > 4 * 1024 * 1024) {
    showToast(-1, $t('建议图片大小不超过4MB，支持 jpg、jpeg、png 等格式'))
    return
  }

  const userId = userInfo.value.id
  if (!userId)
    return

  revokePreviewPath()
  previewPath.value = URL.createObjectURL(file)
  uploading.value = true
  modelValue.value = ''

  try {
    const ext = getFileExt(file.name)
    const objectKey = `/groupdata/kyc/${userId}/${crypto.randomUUID()}${ext}`
    // TODO: 临时走渲染进程直连 OSS，后续切回主进程 IPC
    const ossUrl = await tempUploadOssFile({ objectKey, file })
    // const ossUrl = await globalThis.electronAPI.send('user:uploadOssFile', { localPath, objectKey })
    if (ossUrl)
      modelValue.value = ossUrl
  }
  catch (error) {
    revokePreviewPath()
    showToast(-1, error as string)
  }
  finally {
    uploading.value = false
  }
})

function handleClick() {
  if (uploading.value)
    return
  open()
}
</script>

<template>
  <div
    class="id-upload"
    :class="{ 'id-upload--filled': previewPath, 'id-upload--uploading': uploading }"
    role="button"
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    <img v-if="previewPath" :src="previewPath" class="id-upload__preview" alt="">
    <template v-else>
      <RxButton
        outlined
        severity="secondary"
        size="sm"
        icon="base/rx_ic_export"
        class="pointer-events-none"
      />
      <p class="id-upload__text">
        <template v-if="highlight">
          <span>{{ label }} </span>
          <span class="id-upload__highlight">{{ highlight }}</span>
        </template>
        <template v-else>
          {{ label }}
        </template>
      </p>
    </template>
    <div v-if="uploading" class="id-upload__loading">
      <RxSvgIcon name="base/rx_ic_progress_bar" class="id-upload__loading-icon" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.id-upload {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 192px;
  height: 120px;
  padding: 20px;
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  border-radius: 6px;
  background: var(--colors-background-bg-page, #fff);
  cursor: pointer;
  overflow: hidden;

  &:hover {
    .p-button {
      border-color: var(--colors-border-border-action-hover);
      color: var(--colors-text-text-primary-hover);
      background: var(--button-outlined-secondary-hover-background);
    }
  }

  &--filled {
    padding: 0;
  }

  &--uploading {
    pointer-events: none;
  }

  &__preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
  }

  &__text {
    margin: 0;
    color: var(--colors-text-text-secondary, #34393d);
    font-size: 12px;
    line-height: 18px;
    text-align: center;
  }

  &__highlight {
    font-weight: 600;
    color: var(--colors-text-text-secondary, #111213);
  }

  &__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 6px;
  }

  &__loading-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
