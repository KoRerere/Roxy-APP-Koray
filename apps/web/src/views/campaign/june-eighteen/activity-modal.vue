<script setup lang="ts">
import currency from 'currency.js'
import { format } from 'date-fns'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { getImage } from '/@/utils/basic'

const emit = defineEmits(['close', 'confirm'])

const { currentLocale } = storeToRefs(useSimpleLocale())
const { currentActivity, maxBonus } = storeToRefs(useCampaignStore())
const { getActivityTotalRecharge } = useCampaignStore()

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en'].includes(currentLocale.value!) ? currentLocale.value : 'en'
  return getImage(`campaing/june-eighteen/banner_${suffix}.png`)
})

const topUpSeasonText = computed(() => {
  return currentActivity.value.recharge_benefits.map((item, index, array) => {
    const next = array[index + 1]
    if (!next)
      return $t('充值 {amount} 及以上送 {percentage}', { amount: currency(item.amount, { precision: 0 }).format(), percentage: `${item.discount}%` })

    return $t('充值 {start} - {end} 送 {percentage}', { start: currency(item.amount, { precision: 0 }).format(), end: currency(next.amount, { precision: 0 }).subtract(1).format(), percentage: `${item.discount}%` })
  }).join('\n')
})

function formatAmount(amount: number) {
  return currency(amount, { precision: 0 }).format()
}

function onConfirm() {
  emit('confirm')
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1.5 select-none">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="$emit('close')" />
    <div class="relative cursor-pointer" @click="onConfirm">
      <img draggable="false" class="block w-160 rounded-5" :src="imageSrc">
      <div class="absolute inset-0 flex flex-col items-start pa-6">
        <div class="flex w-full justify-between items-center">
          <div class="flex items-center py-1.5 px-4 gap-1.5 rounded-full top">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M9.9987 2.5C9.44314 4.72222 8.33203 6.52778 6.66536 7.91667C4.9987 9.30556 4.16536 10.8333 4.16536 12.5C4.16536 14.0471 4.77995 15.5308 5.87391 16.6248C6.96787 17.7188 8.4516 18.3333 9.9987 18.3333C11.5458 18.3333 13.0295 17.7188 14.1235 16.6248C15.2174 15.5308 15.832 14.0471 15.832 12.5C15.832 11.5985 15.5396 10.7212 14.9987 10C14.9987 10.5525 14.7792 11.0824 14.3885 11.4731C13.9978 11.8638 13.4679 12.0833 12.9154 12.0833C12.3628 12.0833 11.8329 11.8638 11.4422 11.4731C11.0515 11.0824 10.832 10.5525 10.832 10C10.832 8.33333 12.082 7.5 12.082 5.83333C12.082 4.72222 11.3876 3.61111 9.9987 2.5Z"
                fill="url(#paint0_linear_10828_87762)"
              />
              <defs>
                <linearGradient id="paint0_linear_10828_87762" x1="16.6654" y1="16.6667" x2="15.7803" y2="4.83946" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#9229F5" />
                  <stop offset="1" stop-color="#DF93EE" />
                </linearGradient>
              </defs>
            </svg>
            <span class="text-3 font-600 top-text">{{ $t('Roxy 史上力度最大充值活动') }}</span>
          </div>
          <div class="color-white text-3">
            {{ format(currentActivity.start_timestamp, 'yyyy.MM.dd') }} - {{ format(currentActivity.end_timestamp, 'yyyy.MM.dd') }}
          </div>
        </div>

        <div class="flex flex-col gap-2 text-9 font-700 leading-11 font-[Archivo] color-white mt-3.5">
          <div>{{ $t('Roxy 超级充值季') }}</div>
          <i18n-t tag="div" scope="global" :keypath="$t('单笔充值最高 {bonus}', { bonus: '{bonus}' })">
            <template #bonus>
              <span class="text-11 font-400 font-[DingTalk_JinBuTi] text">{{ $t('赠送 {value}', { value: `${maxBonus}%` }) }}</span>
            </template>
          </i18n-t>
        </div>

        <div class="text-white text-4 font-500 opacity-80 leading-normal mt-4">
          {{ $t('活动期间多充多送，新老用户均可参与') }}
        </div>
        <div class="flex flex-col mt-6">
          <i18n-t tag="div" scope="global" class="text-5 color-white font-500 leading-7.5 whitespace-pre-wrap"
                  :keypath="$t('充 {start} 起享赠送，充 {amount} 得 {value}', { start: formatAmount(10), amount: formatAmount(100), value: '{value}' })"
          >
            <template #value>
              <span class="font-bold text">{{ formatAmount(getActivityTotalRecharge(100)) }}</span>
            </template>
          </i18n-t>
          <i18n-t tag="div" scope="global" class="text-5 color-white font-500 leading-7.5" :keypath="$t('充 {amount} 得 {value}', { amount: formatAmount(1000), value: '{value}' })">
            <template #value>
              <span class="font-bold text">{{ formatAmount(getActivityTotalRecharge(1000)) }}</span>
            </template>
          </i18n-t>
        </div>

        <div class="!absolute left-6 bottom-6 flex items-center gap-5">
          <RxButton class="flex-row-reverse !border-none btn" size="lg" icon="base/rx_ic_chevron_right" :label="$t('立即充值')" />
          <div v-tooltip.top="{ value: topUpSeasonText, pt: { root: '!max-w-80' } }" class="flex items-center gap-1 color-white opacity-80 cursor-pointer">
            <SvgIcon name="base/rx_ic_info_line" />
            <span class="text-3 leading-4">{{ $t('活动详情') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.top {
  border: 1px solid #df93ee;
  background: linear-gradient(92deg, rgba(223, 147, 238, 0.2) -0.26%, rgba(146, 41, 245, 0.2) 99.74%);
  backdrop-filter: blur(16px);

  &-text {
    background: linear-gradient(92deg, #df93ee -0.26%, #9229f5 99.74%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.text {
  background: linear-gradient(97deg, #05caed 0%, #47d769 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.btn {
  background: linear-gradient(97deg, #05caed 0%, #47d769 100%);

  &:not(:disabled):hover {
    background: linear-gradient(97deg, #05caed 0%, #47d769 100%);
  }
}
</style>
