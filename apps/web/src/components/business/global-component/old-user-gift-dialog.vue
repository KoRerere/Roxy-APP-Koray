<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales';
import SparklesText from './SparklesText.vue'
import { API } from "/@/api";
import { useUserStore } from '/@/stores/user';

const props = defineProps({
  hideFn: Function,
})

const userStore = useUserStore()

// 优惠信息
const giftInfo = computed(() => {
  const { userInfo } = userStore

  if (userInfo.identity === 'old') {
    return {
      name: $t('尊贵的创始用户'),
      count: 200,
      ratio: 40,
    }
  } else if (userInfo.identity === 'invited') {
    return {
      name: $t('尊贵的特邀用户'),
      count: 100,
      ratio: 20,
    }
  } else if (userInfo.identity === 'new') {
    return {
      name: $t('尊贵的 Roxy 用户'),
      count: 0,
      ratio: 0,
    }
  }
  return { name: '', count: 0, ratio: 0 }
})

function hide() {
  props.hideFn?.()
  API.pay.userUpdateGiftTipsList()
}
</script>

<template>
  <div class="container">
    <div class="box">
      <SparklesText :colors="{ first: '#9E7AFF', second: '#FE8BBB', third: '#7EC9FF' }" :sparkles-count="5"
        :cycleInterval="8" :randomOrder="true">
        <img src="/images/payments/gift_icon.svg" alt="" class="w-[60px] h-[73px]">
      </SparklesText>
    </div>
    <div class="desc">
      <div class="title">{{ giftInfo.name }}</div>
      <div>
        <div>{{ $t('感谢您与 RoxyBrowser 并肩同行。') }}</div>
        <div>{{ $t('您的信任与支持推动我们不断优化产品、完善功能，并在每一次成长中汲取宝贵经验。') }}</div>
      </div>
      <i18n-t v-if="giftInfo.count > 0 && giftInfo.ratio > 0" scope="global" tag="div" :keypath="$t('为此，我们为您准备了包含 {count}的订阅套餐，版本更新后自动生效，有效期至{date}，同时您的任何消费都可永久享受{ratio}的折扣。', {
        count: '{count}',
        date: '{date}',
        ratio: '{ratio}'
      })">
        <template #count>
          <span class="font-bold">
            {{ $t('{count} 个窗口', { count: giftInfo.count }) }}
          </span>
        </template>
        <template #date>
          <span class="font-bold">
            {{ $t('2025年4月25日23:59（UTC+8）') }}
          </span>
        </template>
        <template #ratio>
          <span class="font-bold">
            {{ $t('额外 {ratio}% ', { ratio: giftInfo.ratio }) }}
          </span>
        </template>
      </i18n-t>
      <i18n-t scope="global" tag="div"
        :keypath="$t('为最大程度保障您的使用权益，{date}创建的工作空间及增加的团队成员额度，我们已为您永久保留。更多权益详情可前往{center}查看。', { date: '{date}', center: '{center}' })">
        <template #date>
          <span class="font-bold">
            {{ $t('3月26日更新前') }}
          </span>
        </template>
        <template #center>
          <span class="font-bold">
            {{ $t('【费用中心】') }}
          </span>
        </template>
      </i18n-t>
      <i18n-t scope="global" tag="div"
        :keypath="$t('此外，我们的推广计划已全面升级，欢迎点击{plan}了解更多。未来，我们将持续提升产品性能与安全性，为您提供更稳定、高效的使用体验，助力业务发展，并全力守护您的隐私安全。', { plan: '{plan}' })">
        <template #plan>
          <span class="font-bold">
            {{ $t('【推广计划】') }}
          </span>
        </template>
      </i18n-t>
      <div>{{ $t('再次感谢您的支持，期待与您携手共进！') }}</div>
      <div class="font-bold">
        <div>{{ $t('RoxyBrowser 官方团队') }}</div>
        <div>{{ $t('2025年3月26日') }}</div>
      </div>
    </div>
    <RxButton class="w-full  flex-shrink-0" :label="$t('了解')" @click="hide" />
  </div>
</template>


<style lang="scss" scoped>
.container {
  display: flex;
  width: var(--width-xs, 404px);
  padding: 24px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-3xl, 20px);

  .box {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 152px;
    align-self: stretch;
    border-radius: 8px;
    background-image: url('/images/gift_bg.png');
    background-size: 100% 100%;
  }

  .desc {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
    overflow: auto;
    color: var(--Colors-Text-text-secondary, #575D61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 20px;

    .title {
      color: #000;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 700;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}
</style>