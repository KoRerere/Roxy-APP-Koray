<script setup lang="ts">
import Snow from '/@/views/campaign/new-year/snow.vue'
import { $t } from '/@/locales'
import { format } from 'date-fns'
import { useCampaignStore } from '/@/stores/campaign'
import { useSimpleLocale } from '/@/stores/locale'

const emit = defineEmits(['close', 'confirm'])

const { currentActivity } = storeToRefs(useCampaignStore())
const { currentLocale } = storeToRefs(useSimpleLocale())

const showSnow = ref(false)
const imageUrls = computed(() => `/images/campaing/new-year/modal-${currentLocale.value}.png`)

const period = computed(() => {
  const { start_timestamp, end_timestamp } = currentActivity.value
  return `${format(new Date(start_timestamp), 'yyyy/MM/dd')} - ${format(new Date(end_timestamp), 'yyyy/MM/dd')}`
})

function onSubscribe() {
  emit('confirm')
  onClose()
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="onClose" />
    <div class="relative">
      <Snow v-if="showSnow" class="absolute inset-0 z-2 pointer-events-none" />
      <img class="block w-140 rounded-5 image" :src="imageUrls" @load="showSnow = true">
      <div class="absolute top-6 right-6 text-3 font-500 text-white">
        {{ period }}
      </div>
      <RxButton class="!min-w-50 !absolute bottom-6 left-6 z-1 sub-btn" size="lg" @click="onSubscribe">
        <div class="flex items-center gap-2">
          <span>{{ $t('即刻订阅') }}</span>
          <SvgIcon name="base/rx_ic_arrow_right" />
        </div>
      </RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.image {
  background: radial-gradient(103.18% 69.92% at 50% 100%, #d00b00 0%, rgba(208, 11, 0, 0) 100%), #aa2424;
}

.sub-btn {
  background: #f39a3d;
  border-color: transparent;
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);

  &:not(:disabled):hover {
    background: #f18c22;
    border-color: transparent;
  }
}
</style>
