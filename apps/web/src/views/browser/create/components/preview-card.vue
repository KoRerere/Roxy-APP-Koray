<script setup lang="ts">
import { motion, AnimatePresence } from "motion-v";
import { filterInputsByNames } from '/@/utils';
import { useThemeStore } from '/@/stores/theme'
import type { SvgNames } from '/@/components/rx-icon';

interface Props {
  inputsGroup?: any[]
  showOverview?: boolean
  createCount?: number
  isBatch?: boolean
  onShuffle: () => void
}
const { inputsGroup = [], onShuffle, showOverview = true, isBatch = false } = defineProps<Props>()

const bannerMap = {
  macos: '/images/systeam/mac.webp',
  ios: '/images/systeam/ios.webp',
  android: '/images/systeam/android.webp',
  windows: '/images/systeam/windows.webp',
}

const themeStore = useThemeStore()
const collapsed = ref(false)
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

</script>

<template>
  <div class="flex flex-col items-start preview" :class="[!collapsed ? '' : 'hide']">
    <div class="flex flex-row-reverse items-center justify-between self-stretch select-none header">
      <SvgIcon class="shrink-0 ma-1 cursor-pointer" :class="{ 'rotate-180': !collapsed }" color="var(--colors-icon-primary)" name="base/rx_ic_fold_right" @click="collapsed = !collapsed" />
      <span v-if="!collapsed">{{ $t('概要') }}</span>
    </div>
    <div v-if="!collapsed && showOverview" class="relative flex flex-col pt-6 items-center overflow-hidden pointer-events-none select-none overview">
      <div class="flex items-center gap-3">
        <div v-if="isBatch" class="overview-count">1/{{ createCount }}</div>
        <div class="w-34 flex items-center justify-between relative">
          <div class="line"></div>
          <template v-for="item in systeam.icons" :key="item.icon">
            <div v-if="item.icon" class="relative icon">
              <img v-if="item.image" class="w-full h-full" :src="item.image" />
              <SvgIcon v-else class="shrink-0" :name="(item.icon as SvgNames)" color="#575D60" />
              <div v-if="item.subIcon || item.subImage" class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 scale-70 icon">
                <img v-if="item.subImage" class="w-full h-full" :src="item.subImage" />
                <SvgIcon v-else class="shrink-0" :name="(item.subIcon as SvgNames)" />
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
    <div v-if="!collapsed" class="w-full content">
      <div class="list">
        <div v-for="(item, key) in previewData" :key="key" class="flex items-start self-stretch py-2 px-3 gap-1 select-none">
          <div class="label">
            {{ item.label }}
          </div>
          <div class="value">
            {{ item.value }}
          </div>
        </div>
        <div class="h-6 w-full invisible" />
      </div>
    </div>
    <RxButton v-if="!collapsed" class="w-full" size="lg" :label="$t('一键随机指纹')" icon="base/rx_ic_shuffle" outlined @click="onShuffle" />
  </div>
</template>

<style lang="scss" scoped>
.preview {
  margin: 0 64px 12px 0;
  padding: 16px;
  gap: 12px;
  min-width: 375px;
  width: 375px;
  height: calc(100% - 12px);
  border-radius: 12px;
  border: 1px solid var(--colors-border-border-subtle);
  background: var(--colors-background-bg-overlay);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  transition: all 0.3s ease-in;

  &.hide {
    min-width: 56px;
    width: 56px;
    height: 56px;
  }
}

.header {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: normal;
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

.content {
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
