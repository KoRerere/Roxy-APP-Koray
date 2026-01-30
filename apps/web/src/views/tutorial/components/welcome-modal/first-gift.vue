<script setup lang="ts">
import type { UserRegisterGiftConfigListData } from '@roxy/backend-api'
import { FirstGiftType } from '/@/enums/pay'

const { data } = defineProps<{
  data: UserRegisterGiftConfigListData['data']
}>()

const list = computed(() => {
  const { static: staticData, dynamic, discount } = data
  return [
    {
      value: FirstGiftType.Static,
      img: staticData.imgUrl,
      text: $t('{ispCount} 条 {ispCountry} 静态住宅代理 IP\n+ {dcCount} 条 {dcCountry} 静态机房代理 IP', { ispCount: staticData.ispCount, dcCount: staticData.dcCount, ispCountry: staticData.ispCountry, dcCountry: staticData.dcCountry }),
      desc: $t('有效期 {day} 天，由 RoxyBrowser 精选', { day: staticData.day }),
      visible: staticData.enable,
    },
    {
      value: FirstGiftType.Dynamic,
      img: dynamic.imgUrl,
      text: $t('{count} 动态住宅代理 IP\n(可设置任意国家地区 {value}MB)', { count: dynamic.count, value: dynamic.value }),
      desc: $t('有效时长 {day} 天，由 {sponsor} 赞助', { day: dynamic.day, sponsor: '{sponsor}' }),
      visible: dynamic.enable,
    },
    {
      value: FirstGiftType.Discount,
      img: discount.imgUrl,
      text: $t('您的账号在 Roxy 中\n永久享受 {discount}% 折扣', { discount: discount.value }),
      desc: $t('在现有折扣基础上，额外 +{discount}% 折扣', { discount: discount.value }),
      visible: discount.enable,
    },
  ].filter(item => item.visible !== false)
})

const chooseValue = defineModel({ required: true })
</script>

<template>
  <div class="h-110 flex flex-col justify-center gap-9 px-13.5">
    <div class="title">
      {{ $t('🎁 RoxyBrowser 为您准备了一份礼物，快选一个吧！') }}
    </div>
    <div class="flex gap-3.5">
      <div v-for="item in list" :key="item.value" class="flex-1 flex flex-col gap-2.5">
        <label :for="item.value" class="h-60 flex flex-col items-center justify-between pa-4 pb-12 rounded-3 cursor-pointer select-none item" :class="{ checked: chooseValue === item.value }">
          <RadioButton v-model="chooseValue" class="!hidden" :input-id="item.value" :value="item.value" name="choose" />
          <div class="relative w-6 h-6 self-start rounded-full radio" />
          <img :src="item.img" class="block w-24 h-24">
          <div class="whitespace-pre-wrap text-center text">
            {{ item.text }}
          </div>
        </label>
        <i18n-t class="pl-2 desc" tag="div" :keypath="item.desc" scope="global">
          <template #sponsor>
            <span class="inline-flex items-center gap-1">
              <a class="link" href="https://rola-ip.co" target="_blank">rola-ip.co</a>
              <SvgIcon name="websites/rx_site_rolaip" size="12" />
            </span>
          </template>
        </i18n-t>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: normal;
}

.item {
  border: 1px solid var(--colors-border-border-subtle);
  background: var(--colors-background-bg-action);

  &.checked {
    border-color: var(--campaign-giftcard-border-giftcard-select);

    .radio {
      border-color: var(--campaign-giftcard-border-giftcard-select);

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        background: var(--campaign-giftcard-border-giftcard-select);
        border-radius: 50%;
      }
    }
  }
}

.radio {
  border: 2px solid var(--colors-border-border-subtle);
}

.text {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: normal;
}

.link {
  color: var(--colors-text-text-link);
}
</style>
