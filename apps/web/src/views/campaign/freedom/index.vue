<script setup lang="ts">
import { getImage, safeParseJSON } from '/@/utils/basic'
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
// import { useUserStore } from '/@/stores/user'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const [showModal] = useDialog()
// const { mixpanelTrack } = useUserStore()

const opened = ref(safeParseJSON(localStorage.getItem(localStorageKey)))

onMounted(() => {
  openModal()
})

function openModal(force = false) {
  if (!force && opened.value)
    return

  if (force) {
    // mixpanelTrack('easter_2026', { easter_entrance_type: 'App' })
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
  <div class="relative h-8.5 flex items-center justify-center rounded-1.5 select-none cursor-pointer overflow-hidden" @click="openModal(true)">
    <img v-if="collapsed" class="block h-full aspect-square" :src="getImage('campaing/freedom/palm_tree_icon.svg')">
    <template v-else>
      <div class="relative w-full px-3 z-1 text font-['DingTalk_JinBuTi']">
        {{ $t('五月自由季') }}
      </div>
      <img draggable="false" class="absolute inset-0 w-full h-full" :src="getImage('campaing/freedom/mid_bg.png')">
      <SvgIcon class="absolute w-8.5 h-8.5 right-1 -bottom-0.5" name="other/palm_tree" size="34" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.text {
  color: #111213;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}
</style>
