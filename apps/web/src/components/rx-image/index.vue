<script lang="ts" setup>
import { motion, AnimatePresence } from 'motion-v';

const props = defineProps<{
  src: string
  fileName?: string
  downloadLink?: string
}>()

const previewVisible = ref(false)
const overlayVisible = ref(false)

function showPreview() {
  overlayVisible.value = true
  previewVisible.value = true
}

function hiddenPreview() {
  previewVisible.value = false
  setTimeout(() => {
    overlayVisible.value = false
  }, 300)
}

async function download() {
  try {
    const response = await fetch(props.downloadLink || props.src)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = props.fileName || 'image.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 清理创建的 URL
    URL.revokeObjectURL(url)
  }
  catch (error) {
    console.error('Failed to download image:', error)
  }
}

</script>

<template>
  <div class="relative w-full h-full" v-bind="$attrs">
    <img :src="props.src" class="w-full h-full object-contain">

    <div class="absolute top-0 left-0 bottom-0 right-0 bg-transparent hover:bg-black/30 [&:hover_.overlay]:flex">
      <div class="justify-center items-center gap-12.5 h-full hidden overlay">
        <div class="flex flex-col items-center justify-center gap-1.5 text-white p-2.5 cursor-pointer"
          @click="showPreview">
          <SvgIcon name="base/rx_ic_eye" size="24" />
          <span class="font-500 text-3.5">{{ $t('预览') }}</span>
        </div>
        <div class="flex flex-col items-center justify-center gap-1.5 text-white p-2.5 cursor-pointer"
          @click="download">
          <SvgIcon name="base/rx_ic_download" size="24" />
          <span class="font-500 text-3.5">{{ $t('下载') }}</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div :class="['fixed top-0 left-0 w-full h-full z-50 flex justify-center items-center']" v-if="overlayVisible"
        @click="hiddenPreview">
        <AnimatePresence mode="wait">
          <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }"
            :transition="{ duration: 0.3 }" class="absolute top-0 left-0 w-full h-full bg-black/30 z-9"
            v-if="previewVisible" />
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div @click.stop :initial="{ scale: 0.8 }" :animate="{ scale: 1 }" :exit="{ scale: 0.8 }"
            :transition="{ duration: 0.3 }" class="relative z-10" v-if="previewVisible">
            <slot name="original">
              <img :src="src" />
            </slot>
          </motion.div>
        </AnimatePresence>
      </div>
    </Teleport>
  </div>
</template>
