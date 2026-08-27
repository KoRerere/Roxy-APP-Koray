<script setup lang="ts">
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { getImage } from '/@/utils/basic'
import { useThemeStore } from '/@/stores/theme'

defineProps<{
  amount?: number
}>()

const { isDarkTheme } = storeToRefs(useThemeStore())
const { visible, datacenterPriceText, windowGiftMonths3 } = storeToRefs(useNewUserBenefitStore())

const imageSrc = computed(() => {
  return isDarkTheme.value
    ? `url('${getImage('campaing/new-user/new-user-card-dark.svg')}')`
    : `url('${getImage('campaing/new-user/new-user-card-light.svg')}')`
})
</script>

<template>
  <div v-if="visible" class="flex items-center justify-center gap-2.5 py-2 px-3 rounded-1.5 bouns">
    <i18n-t class="tt-primary text-3" tag="div" scope="global" :keypath="$t('{bonus}：静态 IP 低至 {value}，窗口买 {months} 送 {gift}', { bonus: '{bonus}', value: '{value}', months: '{months}', gift: '{gift}' })">
      <template #bonus>
        <span class="color-[#FF8A00] font-700">{{ $t('新人专享') }}</span>
      </template>
      <template #value>
        <span class="color-[#FF8A00] font-700">{{ datacenterPriceText }}</span>
      </template>
      <template #months>
        <span class="color-[#FF8A00] font-700">3</span>
      </template>
      <template #gift>
        <span class="color-[#FF8A00] font-700">{{ windowGiftMonths3 }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.bouns {
  background-image: v-bind(imageSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: top center;
}
</style>
