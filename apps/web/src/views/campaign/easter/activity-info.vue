<script setup lang="ts">
import { useUserStore } from '/@/stores/user'
import { formatDiscountOff } from '/@/utils/basic'

const { discount } = defineProps<{
  discount: number
  beyondDiscount: boolean
}>()

const { userPayInfo } = storeToRefs(useUserStore())
</script>

<template>
  <div v-if="userPayInfo.isEaster" class="relative flex flex-col pa-4 gap-3 rounded-2 select-none overflow-hidden content">
    <i18n-t v-if="beyondDiscount" class="text" tag="div" scope="global" :keypath="$t('您已有折扣已超 {discount}，系统将以您最优折扣进行计算', { discount: '{discount}' })">
      <template #discount>
        <span>{{ formatDiscountOff(discount) }}</span>
      </template>
    </i18n-t>
    <template v-else>
      <div class="flex items-center gap-2">
        <span class="title">{{ $t('限时专属复活蛋') }}</span>
        <SvgIcon v-tooltip="{ value: $t('不与其他折扣叠加'), delay: 300 }" class="cursor-pointer" name="base/rx_ic_info" color="#fafafa" />
      </div>
      <i18n-t class="w-46 whitespace-pre-wrap discount" tag="div" scope="global" :keypath="$t('全场消费立享 {discount} 优惠', { discount: '{discount}' })">
        <template #discount>
          <span class="discount-value">{{ formatDiscountOff(discount) }}</span>
        </template>
      </i18n-t>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: url('/images/campaing/easter/mid_banner.jpg');
  background-size: cover;
  background-repeat: no-repeat;
}

.title {
  color: #fafafa;
  font-family: 'DingTalk JinBuTi';
  font-size: 20px;
  font-weight: 700;
  line-height: normal;
}

.text {
  color: #fafafa;
  font-size: 12px;
  line-height: normal;
}

.discount {
  color: #fafafa;
  font-size: 16px;
  line-height: 21px;

  &-value {
    background: linear-gradient(180deg, #fdba74 0%, #ff9220 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-family: Inter;
    font-size: 18px;
    font-style: normal;
    font-weight: 700;
    line-height: 21px;
  }
}
</style>
