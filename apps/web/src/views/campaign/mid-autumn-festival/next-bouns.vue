<script setup lang="ts">
import currency from 'currency.js'
import { useCampaignStore } from '/@/stores/campaign'
import { getImage } from '/@/utils/basic'

const { amount } = defineProps<{
  amount: number
}>()

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  return `url(${getImage('campaing/mid-autumn-festival/next_bouns_banner_bg.jpg')})`
})

const nextBouns = computed(() => {
  const { recharge_benefits } = currentActivity.value
  const next = recharge_benefits.find(item => item.amount > amount)
  const data = next || recharge_benefits[recharge_benefits.length - 1]

  const much = currency(data.amount).subtract(amount).format()

  return {
    bouns: currency(next ? data.amount : amount).multiply(data.discount).divide(100).format(),
    text: next
      ? $t('🎁 消费即抽奖｜再加 {much}，即享 {value} 加赠', { much, value: '{value}' })
      : $t('🎁 消费即抽奖｜当前即享 {value} 加赠', { value: '{value}' }),
  }
})
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival" class="w-full flex items-center justify-center py-2 px-3 rounded-1.5 bouns">
    <i18n-t class="color-white text-3.5 leading-4.5" tag="div" scope="global" :keypath="nextBouns.text">
      <template #value>
        <span class="color-[#FCC67E] font-700">{{ nextBouns.bouns }}</span>
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
