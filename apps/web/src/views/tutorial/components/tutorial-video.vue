<script setup lang="ts">
import RxButton from '/@/components/rx-button/index.vue'
import VideoModal from '/@/views/tutorial/components/video-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useTutorialStore } from '/@/stores/tutorial'
import type { UserGetGuideVideosByTypeListData } from '@roxy/backend-api'

type RxButtonProps = InstanceType<typeof RxButton>['$props']
interface Props extends /* @vue-ignore */ Omit<RxButtonProps, 'onClick' | 'type'> {
  videoType?: keyof UserGetGuideVideosByTypeListData['data']
  videoUrl?: string
  externalLink?: string
  autoplay?: boolean
}

defineOptions({ inheritAttrs: false })

const { videoType, videoUrl, externalLink, autoplay = true } = defineProps<Props>()

const attrs = useAttrs()
const [showModal] = useDialog()
const { getVideoMaps } = useTutorialStore()

async function openVideoModal() {
  const { videoUrl: video, externalLink: external } = videoType
    ? await getVideoMaps().then(data => data![videoType])
    : { videoUrl, externalLink }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-3000',
    },
    slots: {
      container: ({ hideModal }) => h(VideoModal, {
        video: video!,
        external: external!,
        autoplay,
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <slot :on-play="openVideoModal">
    <RxButton severity="secondary" size="md" icon="base/rx_ic_video_play" variant="text" :label="$t('观看视频')" v-bind="attrs" @click.stop="openVideoModal" />
  </slot>
</template>

<style scoped></style>
