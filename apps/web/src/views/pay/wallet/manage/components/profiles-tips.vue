<script setup lang="ts">
import currency from 'currency.js'
import { format } from 'date-fns'
import { useUserStore } from '/@/stores/user'
import { SubLevelEnum } from '/@/enums/pay'

const { userPayInfo } = storeToRefs(useUserStore())

const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

const profileCounts = computed(() => {
  const { freeWindowCount, purchasePermanentWindowCount, purchaseWindowCount } = userPayInfo.value
  return {
    free: currency(freeWindowCount).subtract(purchasePermanentWindowCount).value,
    purchasePermanent: purchasePermanentWindowCount,
    purchase: isExpired.value ? 0 : purchaseWindowCount,
  }
})

/** 计费窗口到期日；无付费窗口或无到期时间时显示暂无 */
const billedWindowEndDate = computed(() => {
  if (isExpired.value || !profileCounts.value.purchase || !userPayInfo.value.subEndDate) {
    return $t('暂无')
  }
  return format(userPayInfo.value.subEndDate, 'yyyy/MM/dd')
})

const expiredInfo = computed(() => {
  const permanently = $t('永久有效')

  return {
    free: $t('免费窗口: {count}, 到期时间: {endDate}', { count: profileCounts.value.free, endDate: permanently }),
    lifetime: $t('终身窗口: {count}, 到期时间: {endDate}', { count: profileCounts.value.purchasePermanent, endDate: permanently }),
    purchase: $t('计费窗口: {count}, 到期时间: {endDate}', { count: profileCounts.value.purchase, endDate: billedWindowEndDate.value }),
  }
})
</script>

<template>
  <div class="flex items-center gap-1.5">
    <RxTooltip class="flex items-center">
      <template #default>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
      </template>
      <template #content>
        <div class="tip">
          <div>{{ expiredInfo.free }}</div>
          <div>{{ expiredInfo.lifetime }}</div>
          <div>{{ expiredInfo.purchase }}</div>
        </div>
      </template>
    </RxTooltip>
  </div>
</template>

<style scoped>
.tip {
  color: #fff;
  font-size: 12px;
  line-height: 16px;
}
</style>
