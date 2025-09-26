<script setup lang="ts">
import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
import { motion, AnimatePresence } from "motion-v";
import { $t } from '/@/locales';
import { useUserStore } from "/@/stores/user";
import { useDialog } from '/@/hooks/useDialog'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts';
import { filterInputsByNames } from '/@/utils';
import type { SvgNames } from '/@/components/rx-icon';
import PlayVideo from '/@/views/tutorial/components/play-video.vue'

interface Props {
  inputsGroup?: any[]
  showOverview?: boolean
  createCount?: number
  isBatch?: boolean
  onShuffle: () => void
}
const { inputsGroup = [], onShuffle, showOverview = true, isBatch = false } = defineProps<Props>()

const [showModal] = useDialog()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const { userPayInfo } = storeToRefs(useUserStore())

const bannerMap = {
  macos: '/images/systeam/mac.webp',
  ios: '/images/systeam/ios.webp',
  android: '/images/systeam/android.webp',
  windows: '/images/systeam/windows.webp',
}

const collapsed = defineModel<Boolean>('collapsed', { default: false })
const previewData = computed(() => getPreview(inputsGroup.flat()))

const systeam = computed(() => {
  const [os, proxy, account] = filterInputsByNames(inputsGroup[0], ['os', 'proxyInfoList', 'windowPlatformList'])
  const [aItem1, aItem2] = (account?.value || []).map((item: any) => ({
    image: item.platformIcon,
    icon: 'base/rx_ic_user_key'
  }))
  const _os = os?.value?.value.toLowerCase()

  return {
    os: _os,
    banner: bannerMap[_os as keyof typeof bannerMap],
    icons: [
      {
        icon: os?.value?.icon || 'base/rx_ic_plus',
      },
      {
        icon: proxy?.value?.length && `country-code/${proxy.value[0].lastCountry}`,
        fallback: 'base/rx_ic_earth',
      },
      {
        icon: aItem1?.icon || 'base/rx_ic_plus',
        image: aItem1?.image,
        subIcon: account?.value?.length > 2 ? 'base/rx_ic_more-h' : aItem2?.icon,
        subImage: account?.value?.length > 2 ? '' : aItem2?.image,
      },
    ]
  }
})

const variantsLeft = {
  visible: {
    opacity: 0.4,
    x: 0,
    transition: { duration: 0.5, ease: [0, 0.71, 0.2, 1.01] },
  },
  hidden: {
    opacity: 0,
    x: -60,
    transition: { duration: 0.5, ease: [0, 0.71, 0.2, 1.01] },
  },
}

const variantsCenter = {
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.5, ease: [0, 0.71, 0.2, 1.01] },
  },
  hidden: {
    opacity: 0,
    x: 0,
    y: 40,
    transition: { duration: 0.5, ease: [0, 0.71, 0.2, 1.01] },
  },
}

const variantsRight = {
  visible: {
    opacity: 0.4,
    x: 0,
    transition: { duration: 0.5, ease: [0, 0.71, 0.2, 1.01] },
  },
  hidden: {
    opacity: 0,
    x: 60,
    transition: { duration: 0.5, ease: [0, 0.71, 0.2, 1.01] },
  },
}

function getPreview(list: any[]) {
  return list.flatMap((item) => {
    if (item.preview)
      return [item]
    if (item.items?.length)
      return item.items.filter((subItem: any) => subItem.preview)
    return []
  }).map(({ options, value, preview }) => {
    const actualValue = value?.value ?? value
    const displayValue = options?.find((option: any) => option.value === actualValue)?.label ?? actualValue
    return {
      ...preview,
      value: displayValue,
    }
  })
}

function onHideTips() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => updateOnboardingTaskStatus({ createProfileVideoEntryStatus: true }),
    slots: {
      container: ({ hideModal }) => h(GuideModal, {
        title: $t('教程提示'),
        desc: $t('当您对 RoxyBrowser 的产品功能不熟悉或希望学习更多技巧时，可以随时通过右下方蓝色按钮找到"教程"入口。'),
        video: "/video/tour-hide-guide.mp4",
        onClose: hideModal,
        onConfirm: hideModal,
      })
    }
  })
}

//==============================
import { useTutorialStore } from '/@/stores/tutorial';
const { getVideoMaps } = useTutorialStore()
const videoData = ref()

onBeforeMount(() => {
  getVideoMaps()
    .then(data => {
      videoData.value = data?.create_profile
    })
})
</script>

<template>
  <div class="flex flex-col my-4 gap-2.5 preview" :class="[!collapsed ? '' : 'hide']">
    <PlayVideo v-if="videoData && !collapsed && !userPayInfo.onboardingTaskStatus?.createProfileVideoEntryStatus" :video-url="videoData?.videoUrl" :external-link="videoData?.externalLink"
      :autoplay="false">
      <template #default="{ onPlay }">
        <div class="flex items-center justify-start pa-3 gap-2.5 rounded-xl video" @click="onPlay">
          <div class="flex items-center pa-2 rounded-md video-icon">
            <SvgIcon name="base/rx_ic_play" color="var(--pattern-tutorial-video-bg-icon)"></SvgIcon>
          </div>
          <div class="flex-1 cursor-pointer">
            <div class="flex justify-between items-center">
              <span class="video-title">{{ $t('窗口教程') }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="onHideTips"></SvgIcon>
            </div>
            <div class="video-desc">{{ $t('了解窗口和窗口指纹') }}</div>
          </div>
        </div>
      </template>
    </PlayVideo>
    <div class="flex-1 flex flex-col items-start justify-start pa-4 gap-3 rounded-xl overflow-hidden content guide4">
      <div class="flex flex-row-reverse items-center justify-between self-stretch select-none header">
        <SvgIcon v-tooltip="!collapsed ? $t('收起') : $t('展开')" class="shrink-0 cursor-pointer" :name="!collapsed ? 'base/rx_ic_hide_preview' : 'base/rx_ic_show_preview'"
          color="var(--colors-icon-primary)" @click="collapsed = !collapsed" />
        <div v-if="!collapsed">{{ $t('概要') }}</div>
      </div>
      <div v-if="!collapsed" class="w-full infos">
        <div class="list">
          <div v-if="showOverview" class="relative flex flex-col mb-2 pt-6 items-center overflow-hidden pointer-events-none select-none overview">
            <div class="flex items-center gap-3">
              <div class="w-34 flex items-center justify-between relative">
                <div class="line"></div>
                <template v-for="item in systeam.icons" :key="item.icon">
                  <div v-if="item.icon" class="relative icon">
                    <img v-if="item.image" class="w-full h-full" :src="item.image" />
                    <SvgIcon v-else class="shrink-0" :name="(item.icon as SvgNames)" color="#7d8387" :fallback="item.fallback" />
                    <div v-if="item.subIcon || item.subImage" class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 scale-70 icon">
                      <img v-if="item.subImage" class="w-full h-full" :src="item.subImage" />
                      <SvgIcon v-else class="shrink-0" :name="(item.subIcon as SvgNames)" color="#7d8387" />
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="systeam.os" class="absolute top-20 left-1/2 -translate-x-1/2 flex gap-6">
              <AnimatePresence v-if="isBatch" :initial="false" mode="wait">
                <motion.div class="flex justify-end opacity-40 overview-banner" :key="systeam.os" :variants="variantsLeft" initial="hidden" animate="visible" exit="hidden">
                  <img :src="systeam.banner" class="block h-full object-contain" />
                </motion.div>
              </AnimatePresence>
              <AnimatePresence :initial="false" mode="wait">
                <motion.div class="overview-banner" :key="systeam.os" :variants="variantsCenter" initial="hidden" animate="visible" exit="hidden">
                  <img :src="systeam.banner" class="block h-full w-full object-contain">
                </motion.div>
              </AnimatePresence>
              <AnimatePresence v-if="isBatch" :initial="false" mode="wait">
                <motion.div class="flex justify-start opacity-40 overview-banner" :key="systeam.os" :variants="variantsRight" initial="hidden" animate="visible" exit="hidden">
                  <img :src="systeam.banner" class="block h-full object-contain" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div v-for="(item, key) in previewData" :key="key" class="flex items-start self-stretch py-1 px-3 gap-1 select-none">
            <div class="label">{{ item.label }}</div>
            <div class="value">{{ item.value }}</div>
          </div>
          <div class="h-6 w-full invisible"></div>
        </div>
      </div>
      <RxButton v-if="!collapsed" class="w-full" size="lg" :label="$t('一键随机指纹')" icon="base/rx_ic_shuffle" outlined @click="onShuffle" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preview {
  min-width: 375px;
  width: 375px;
  height: calc-size(auto, size);

  &.hide {
    min-width: 48px;
    width: 48px;
    height: 48px;
  }
}

.video {
  background: linear-gradient(90deg, var(--pattern-tutorial-video-bg-start) 0%, var(--pattern-tutorial-video-bg-end) 100%);

  &-icon {
    background: var(--pattern-tutorial-video-bg-play);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: normal;
  }
}

.content {
  border: 1px solid var(--colors-border-border-subtle);
  background: var(--colors-background-bg-overlay);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 600;
}

.overview {
  width: 100%;
  height: 180px;
  border-radius: 6px;
  background: linear-gradient(180deg, #ebf7ff 0%, #f6f6fd 100%);

  &-count {
    color: #575D60;
    font-size: 13px;
  }

  &-banner {
    width: 192px;
    height: 110px;
  }
}

.icon {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 0.5px solid #C7D1D6;
  background: #FFF;
  z-index: 1;
}

.line {
  position: absolute;
  width: 100%;
  height: 1px;
  background: #C7E3F2;
}

.infos {
  position: relative;
  flex: 1;
  overflow: hidden;
  word-break: break-all;

  &::after {
    content: ' ';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 44px;
    background: linear-gradient(180deg, transparent 0%, var(--colors-background-bg-overlay) 100%);
  }
}

.list {
  width: 100%;
  height: 100%;
  overflow-y: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.label {
  width: 120px;
  color: var(--pattern-editor-key, #79C0FF);
  font-family: 'DM Mono';
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -0.12px;
}

.value {
  flex: 1;
  color: var(--pattern-editor-value, #A5D6FF);
  font-family: 'DM Mono';
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -0.12px;
}
</style>
