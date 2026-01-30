<script setup lang="ts">
import currency from 'currency.js'
import { useThemeStore } from '/@/stores/theme'
import { useSimpleLocale } from '/@/stores/locale'

defineProps<{
  roxyGifts: {
    price: number
    staticDays: number
    ispCount: number
    country: string
    dynamicFlow: number
    dynamicDays: number
    isValid: boolean
  }
}>()

const { realTheme } = storeToRefs(useThemeStore())
const { currentLocale } = storeToRefs(useSimpleLocale())

const giftImgSrc = computed(() => {
  const suffix = currentLocale.value === 'ru' ? 'en' : currentLocale.value
  return `/images/campaing/gifts-card-${suffix}-${realTheme.value}.svg`
})
</script>

<template>
  <div class="h-110 flex items-center gap-9 px-24">
    <img class="block w-90" :src="giftImgSrc">
    <div class="flex flex-col gap-5">
      <div class="title">
        {{ $t('🎁 "配齐"计划：买窗口套餐，IP 免费领') }}
      </div>
      <div class="desc">
        {{ $t('限时活动：窗口套餐消费满 {amount} 一次，即可在以下选项中选择一项作为赠品，多买多送：', { amount: currency(roxyGifts.price).format() }) }}
      </div>
      <div class="desc">
        {{ $t('{country} 静态住宅代理 IP。每满 {amount} 赠送 {count} 条，不设上限。', { country: roxyGifts.country, amount: currency(roxyGifts.price).format(), count: roxyGifts.ispCount }) }}
      </div>
      <i18n-t class="desc" tag="div"
              :keypath="$t('动态住宅代理 IP（由合作伙伴 {link} 提供）。每满 {amount} 赠送 {value}GB，不设上限。', { link: '{link}', amount: currency(roxyGifts.price).format(), value: roxyGifts.dynamicFlow })" scope="global"
      >
        <template #link>
          <a class="link" href="https://rola-ip.co" target="_blank">rola-ip.co</a>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.desc {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 1.5;
}

.link {
  color: var(--colors-text-text-link);
}
</style>
