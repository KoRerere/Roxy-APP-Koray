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
    ? `url('${getImage('campaing/new-user/new-user-card-dark1.svg')}')`
    : `url('${getImage('campaing/new-user/new-user-card-light1.svg')}')`
})
</script>

<template>
  <div v-if="visible" class="relative flex items-center justify-between gap-0.5 py-4 pl-30 pr-4 gap-3 rounded-1.5 overflow-hidden cursor-pointer content" @click="requestModal(true)">
    <i18n-t tag="div" class="tt-primary text-4.5 font-700 leading-7.5" scope="global"
            :keypath="$t('{bonus}福利，IP 低至 {value} /条，窗口订阅 {buy} 个月送 {gift} 个月', { bonus: '{bonus}', value: '{value}', buy: 3, gift: windowGiftMonths3 ?? 1 })"
    >
      <template #bonus>
        <span class="color-[#FF8A00]">{{ $t('新人专享') }}</span>
      </template>
      <template #value>
        <span class="color-[#FF8A00]">{{ datacenterPriceText }}</span>
      </template>
    </i18n-t>
    <RxButton class="buy-btn" severity="warn" icon="base/rx_ic_cart" :label="$t('立即购买')" size="md" />
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imageSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: left top;
}

.buy-btn {
  flex-shrink: 0;
  justify-content: center;
  background: #ff9f2e;
  white-space: nowrap;
  color: var(--component-dropdown-text-active) !important;

  &:hover {
    background: #ff8a00 !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  // 该档资格已用完：灰底灰边，压过 warn 的橙色描边和 hover
  &.is-used,
  &.is-used:hover,
  &.is-used:focus,
  &.is-used:active {
    background: var(--component-scrollbar-indicator, #c7d1d6) !important;
    border-color: var(--component-scrollbar-indicator, #c7d1d6) !important;
  }

  :deep(svg) {
    color: var(--component-dropdown-text-active) !important;
  }
}
</style>
