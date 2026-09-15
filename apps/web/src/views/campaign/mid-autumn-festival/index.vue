<script setup lang="ts">
import { getImage, safeParseJSON } from '/@/utils/basic'
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const { isZh } = storeToRefs(useSimpleLocale())
const [showModal] = useDialog()

const opened = ref(safeParseJSON(localStorage.getItem(localStorageKey)))

const imgSrc = computed(() => isZh.value ? getImage('campaing/mid-autumn-festival/banner_icon_zh.png') : getImage('campaing/mid-autumn-festival/banner_icon_en.png'))

onMounted(() => {
  openModal()
})

function openModal(force = false) {
  if (!force && opened.value) {
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!border-none !shadow-none !rounded-3',
      mask: '!z-1100',
    },
    handleCancel: () => {
      localStorage.setItem(localStorageKey, JSON.stringify(true))
    },
    slots: {
      container: ({ handleCancel }) => h(ActivityModal, {
        onClose: handleCancel,
      }),
    },
  })
}
</script>

<template>
  <div class="relative h-10 flex items-center justify-center rounded-1.5 select-none cursor-pointer overflow-hidden" @click="openModal(true)">
    <img v-if="collapsed" class="block w-full aspect-square" :src="imgSrc">
    <template v-else>
      <div class="relative w-full z-1 pl-3 pr-2.5 flex items-center justify-between">
        <span class="color-white text-3.25 font-700 leading-4.5">{{ $t('月满人团圆, 中秋狂欢季') }}</span>
        <SvgIcon name="base/rx_ic_arrow_right_2" color="#ffffff" />
      </div>
      <img draggable="false" class="absolute inset-0 w-full h-full" :src="getImage('campaing/mid-autumn-festival/banner_bg_mini.png')">
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
