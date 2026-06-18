<script setup lang="tsx">
import currency from 'currency.js'
import { $t } from '/@/locales'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'

defineEmits(['close'])

const { currentLocale } = storeToRefs(useSimpleLocale())
const { currentActivity } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  const suffix = ['en', 'ru'].includes(currentLocale.value!) ? 'en' : 'zh-CN'
  return `/images/campaing/spring-festival/usage_diagram_${suffix}.png`
})
</script>

<template>
  <div class="w-120 flex flex-col gap-4 pa-6 pt-4">
    <div class="h-9 inline-flex items-center justify-between">
      <div class="title">
        {{ $t('Roxy 赠品规则') }}
      </div>
      <div class="flex items-center cursor-pointer" @click="$emit('close')">
        <SvgIcon name="base/rx_ic_delete" size="20" />
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <div class="font-700 desc">
        {{ $t('活动期间消费即可在以下选项中选择一项作为赠品：') }}
      </div>
      <div class="desc">
        <span class="font-700">{{ $t('选项一') }}：</span>
        <span>{{ $t('每消费 {amount} 可获得 {count} 个团队成员席位，上不封顶 ', { amount: currency(currentActivity.amount).format(), count: currentActivity.staff.count }) }}</span>
      </div>
      <div class="desc">
        <span class="font-700">{{ $t('选项二') }}：</span>
        <i18n-t :keypath="$t('获得订阅窗口数量、时长相等的兑换码，兑换码有效期 {day} 天（{text}）', { day: currentActivity.profile.expireDays, text: '{text}' })" scope="global">
          <template #text>
            <span class="font-700">
              {{ $t('兑换码仅限当前无生效中的订阅用户可用') }}
            </span>
          </template>
        </i18n-t>
      </div>
      <div class="font-700 desc">
        {{ $t('活动范围：窗口订阅（含续费）可参与二选一活动；升级套餐只可享受选项一优惠。') }}
      </div>
      <div class="desc">
        {{ $t('本活动最终解释权归 Roxy浏览器团队所有。') }}
      </div>
      <div class="flex flex-col gap-3 pt-2">
        <div class="font-700 desc">
          {{ $t('注：兑换码可在APP 右上角找到"兑换码"进行兑换') }}
        </div>
        <img class="block w-full rounded-2" :src="imageSrc">
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary, #111213);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-primary, #111213);
  font-size: 12px;
  line-height: normal;
}
</style>
