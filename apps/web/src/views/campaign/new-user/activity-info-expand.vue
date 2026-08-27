<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useThemeStore } from '/@/stores/theme'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'

const { isDarkTheme } = storeToRefs(useThemeStore())
const { visible, datacenterPriceText, windowGiftMonths3 } = storeToRefs(useNewUserBenefitStore())

const imageSrc = computed(() => {
  return isDarkTheme.value
    ? `url('${getImage('campaing/new-user/new-user-card-dark.svg')}')`
    : `url('${getImage('campaing/new-user/new-user-card-light.svg')}')`
})
</script>

<template>
  <div v-if="visible" class="relative flex flex-col justify-center gap-1 py-3 px-4 rounded-1.5 overflow-hidden content">
    <i18n-t class="tt-primary text-4.5 font-600 leading-6" tag="div" scope="global" :keypath="$t('{bonus}福利', { bonus: '{bonus}' })">
      <template #bonus>
        <span class="color-[#FF8A00]">{{ $t('新人专享') }}</span>
      </template>
    </i18n-t>
    <i18n-t tag="div" scope="global" class="relative z-1 tt-secondary text-3.25 font-500 leading-4.5"
            :keypath="$t('静态 IP 低至 {value}，窗口买 {months} 送 {gift}', { value: '{value}', months: '{months}', gift: '{gift}' })"
    >
      <template #value>
        <span class="font-700 color-[#FF8A00]">{{ datacenterPriceText }}</span>
      </template>
      <template #months>
        <span class="font-700 color-[#FF8A00]">3</span>
      </template>
      <template #gift>
        <span class="font-700 color-[#FF8A00]">{{ windowGiftMonths3 }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imageSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: right bottom;
}
</style>
