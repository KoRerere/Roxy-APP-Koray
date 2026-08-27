<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useThemeStore } from '/@/stores/theme'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { useNewUserBenefitModal } from '/@/views/campaign/new-user/useNewUserBenefitModal'

const { isDarkTheme } = storeToRefs(useThemeStore())
const { visible, datacenterPriceText, windowGiftMonths3 } = storeToRefs(useNewUserBenefitStore())
const { requestModal } = useNewUserBenefitModal()

const imageSrc = computed(() => {
  return isDarkTheme.value
    ? `url('${getImage('campaing/new-user/new-user-card-dark.svg')}')`
    : `url('${getImage('campaing/new-user/new-user-card-light.svg')}')`
})
</script>

<template>
  <!-- 背景图不锁高度，三行文案才能靠 padding 撑开，避免贴边 -->
  <div v-if="visible" class="relative flex flex-col justify-center gap-0.5 py-3 px-4 rounded-1.5 overflow-hidden cursor-pointer content" @click="requestModal(true)">
    <i18n-t class="relative z-1 tt-primary text-3.75 font-600 leading-6" tag="div" scope="global" :keypath="$t('{bonus}福利', { bonus: '{bonus}' })">
      <template #bonus>
        <span class="color-[#FF8A00] mr-1">{{ $t('新人专享') }}</span>
      </template>
    </i18n-t>
    <i18n-t tag="div" scope="global" class="relative z-1 tt-secondary text-3.5 font-500 leading-5" :keypath="$t('IP 低至 {value} /条', { value: '{value}' })">
      <template #value>
        <span class="font-700 color-[#FF8A00]">{{ datacenterPriceText }}</span>
      </template>
    </i18n-t>
    <!-- 买赠月数以后端 windowGiftMonths['3'] 为准，缺省按活动规则 1 个月 -->
    <div class="relative z-1 tt-secondary text-3 font-500 leading-5">
      {{ $t('窗口订阅 {buy} 个月送 {gift} 个月', { buy: 3, gift: windowGiftMonths3 ?? 1 }) }}
    </div>
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
