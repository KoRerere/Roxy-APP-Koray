<script setup lang="ts">
defineEmits(['close'])

const CID = useId()
const isRemind = ref(false)

onUnmounted(() => {
  if (isRemind.value) {
    localStorage.setItem('IPColseRemind', 'true')
  }
})
</script>

<template>
  <div class="w-114 flex flex-col gap-6 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('遇见问题？请联系我们') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="flex items-center gap-3 pa-4 rounded-1.5 content">
      <div class="w-13 aspect-square flex items-center justify-center rounded-full icon">
        <SvgIcon name="base/rx_ic_customer_support" size="26" color="#ffffff" />
      </div>
      <div class="flex-1 flex flex-col gap-1.5">
        <div class="tt-primary text-4 font-600 leading-6 font-[IBM_Plex_Sans_SC]">
          {{ $t('Roxy 在线客服') }}
        </div>
        <div class="tt-tertiary text-3 leading-4 font-[IBM_Plex_Sans_SC]">
          {{ $t('在线时间：{time}', { time: '09:00-22:00' }) }}
        </div>
      </div>
      <RxButton size="md" :label="$t('立即咨询')" @click="$showLiveChat" />
    </div>
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2 select-none cursor-pointer">
        <RxCheckbox v-model="isRemind" :input-id="CID" binary />
        <label :for="CID" class="tt-tertiary text-3 leading-4">{{ $t('不再提醒') }}</label>
      </div>
      <RxButton severity="secondary" variant="outlined" :label="$t('继续退出')" @click="$emit('close')" />
    </div>
  </div>
</template>

<style lang="scss" module></style>

<style lang="scss" scoped>
.content {
  background: var(--colors-background-bg-block, #f1f5f8);
}

.icon {
  background: linear-gradient(133deg, #77cafe 14.9%, #12a3fc 85.38%);
}
</style>
