<script setup lang="ts">
import RxButton from '/@/components/rx-button/index.vue'
import VideoModal from '/@/views/tutorial/components/video-modal.vue';
import { useDialog } from '/@/hooks/useDialog'

type RxButtonProps = InstanceType<typeof RxButton>['$props']
interface PlayVideoProps extends /* @vue-ignore */ Omit<RxButtonProps, 'onClick' | 'type'> {
  type?: string
  videoUrl?: string
  externalLink?: string
  autoplay?: boolean
}

const { type, videoUrl, externalLink, autoplay = true } = defineProps<PlayVideoProps>()

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const [showModal] = useDialog()

function openVideoModal() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: "!bg-transparent !border-none !shadow-none",
      mask: 'z-20'
    },
    slots: {
      container: ({ hideModal }) => h(VideoModal, {
        video: videoUrl!,
        external: externalLink!,
        autoplay,
        onClose: hideModal
      })
    }
  })
}
</script>

<template>
  <slot :onPlay="openVideoModal">
    <RxButton severity="secondary" size="md" icon="base/rx_ic_video_play" variant="text" :label="$t('观看视频')" v-bind="attrs" @click.stop="openVideoModal" />
  </slot>
</template>

<style scoped></style>
