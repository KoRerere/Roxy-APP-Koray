<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { useResponseToast } from '/@/hooks/useResponseToast'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  src: string
  alt?: string
}>()

const attrs = useAttrs()
const [showContextMenu] = useContextMenu()
const [showToast, onlyErrorToast] = useResponseToast()

const imageContextMenu = computed<MenuItem[]>(() => [
  {
    label: $t('复制图片'),
    icon: 'base/rx_ic_copy',
    name: 'copyImage',
  } as MenuItem,
])

async function copyImage() {
  if (!props.src) {
    onlyErrorToast(-1, $t('复制失败，请重试'))
    return
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    onlyErrorToast(-1, $t('复制失败，请重试'))
    return
  }

  try {
    const response = await fetch(props.src)

    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.status}`)

    const blob = await response.blob()
    const supportsClipboardType = typeof ClipboardItem.supports === 'function'
      ? ClipboardItem.supports(blob.type)
      : blob.type === 'image/png'
    const clipboardType = supportsClipboardType ? blob.type : 'image/png'
    const clipboardBlob = clipboardType === blob.type ? blob : await convertBlobToPng(blob)

    await navigator.clipboard.write([
      new ClipboardItem({
        [clipboardType]: clipboardBlob,
      }),
    ])

    showToast(0, $t('复制成功'))
  }
  catch (error) {
    console.error('Failed to copy image:', error)
    onlyErrorToast(-1, $t('复制失败，请重试'))
  }
}

function onImageContextMenu(event: MouseEvent) {
  showContextMenu(event, {
    operation: imageContextMenu.value,
    operationHandler: async (operate: MenuItem & { name?: string }) => {
      if (operate.name === 'copyImage')
        await copyImage()
    },
  })
}

async function convertBlobToPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')

  if (!context)
    throw new Error('Canvas context is unavailable')

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((pngBlob) => {
      if (pngBlob) {
        resolve(pngBlob)
        return
      }

      reject(new Error('Failed to convert image to png'))
    }, 'image/png')
  })
}
</script>

<template>
  <img
    :src="src"
    :alt="alt"
    v-bind="attrs"
    @contextmenu.prevent="onImageContextMenu"
  >
</template>
