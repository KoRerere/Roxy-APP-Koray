<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useNewUserBenefitModal } from '/@/views/campaign/new-user/useNewUserBenefitModal'

const { collapsed = false } = defineProps<{
  collapsed?: boolean
}>()

const { requestModal, disposeAutoSchedule } = useNewUserBenefitModal()

const imageSrc = computed(() => getImage('campaing/new-user/new-user-nav.svg'))

onMounted(() => {
  requestModal()
})

onBeforeUnmount(() => {
  disposeAutoSchedule()
})
</script>

<template>
  <div class="cursor-pointer" @click="requestModal(true)">
    <div class="relative h-9 flex items-center justify-center rounded-1.5 select-none overflow-hidden">
      <img v-if="collapsed" class="block rounded aspect-ratio-1" :src="getImage('campaing/new-user/new-user-nav-single.svg')">
      <template v-else>
        <div class="relative w-full px-3 z-1 flex items-center gap-1.5">
          <SvgIcon name="base/rx_ic_gift2" color="#ffffff" />
          <span class="color-white font-[DingTalk_JinBuTi] text-3.25 leading-4.5">{{ $t('Roxy 新人尝鲜专区') }}</span>
        </div>
        <img draggable="false" class="absolute inset-0 h-full" :src="imageSrc">
      </template>
    </div>
  </div>
</template>
