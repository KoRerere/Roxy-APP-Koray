<script setup lang="ts">
import type { UserRegisterProxyProviderUserV2CreateData } from '@roxy/backend-api'
import { getImage } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'

/** 注册接口里的赠送内容，说明文案直接读 description */
type ProviderGiftInfo = NonNullable<UserRegisterProxyProviderUserV2CreateData['data']>['giftInfo']

const props = defineProps<{
  /** 赠送类型；coupon 展示折扣，其余按流量包展示 */
  giftType?: string
  /** 赠送内容，说明文案直接读 description */
  giftInfo?: ProviderGiftInfo
}>()

const emit = defineEmits<{
  /** 关闭弹窗 */
  close: []
  /** 领取并跳转 */
  claim: []
}>()

const { isDarkTheme } = storeToRefs(useThemeStore())

/** 优惠券奖励；其余结果（含缺省）展示流量包 */
const isCoupon = computed(() => props.giftType === 'coupon')

/** 顶部装饰背景随主题切换，透明区域露出弹窗底色 */
const headerBgSrc = computed(() => {
  const file = isDarkTheme.value ? 'proxy/rola-reg-dark.png' : 'proxy/rola-reg-light.png'
  return `url('${getImage(file)}')`
})

/** 优惠券与流量包使用不同图标 */
const iconSrc = computed(() => {
  const theme = isDarkTheme.value ? 'dark' : 'light'
  const name = isCoupon.value ? 'discount' : 'residential-ip'
  return getImage(`proxy/${name}-${theme}.svg`)
})

/** 奖励说明由接口按语言返回，空串不展示 */
const rewardText = computed(() => props.giftInfo?.description?.trim() ?? '')

/** 领取只通知外层收起弹窗，跳转由关闭流程统一处理 */
function onClaim() {
  emit('claim')
}
</script>

<template>
  <div class="reward-modal relative w-full overflow-hidden rounded-2 px-6 pb-6 pt-5">
    <SvgIcon class="absolute right-4 top-4 z-2 cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="onClaim" />

    <div class="relative z-1 px-4 pt-3 text-center text-5 font-700 leading-7 tt-primary">
      <template v-if="isCoupon">
        <div>{{ $t('恭喜获得专属折扣') }}</div>
      </template>
      <template v-else>
        <div>{{ $t('动态住宅代理 IP 流量已解锁') }}</div>
      </template>
    </div>

    <div class="relative z-1 mt-8 flex justify-center">
      <img class="block h-15 w-15" :src="iconSrc" alt="">
    </div>

    <div v-if="rewardText" class="relative z-1 mt-6 text-center text-3.75 font-600 leading-5 tt-primary">
      {{ rewardText }}
    </div>

    <RxButton class="relative z-1 mt-8 w-full" size="lg" :label="$t('领取并前往 Rola-IP')" @click="onClaim" />
  </div>
</template>

<style lang="scss" scoped>
.reward-modal {
  background-color: var(--colors-background-bg-overlay, #fff);
  background-image: v-bind(headerBgSrc);
  background-repeat: no-repeat;
  background-position: top center;
  background-size: 100% auto;
}
</style>
