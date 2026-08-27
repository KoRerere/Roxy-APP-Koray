<script setup lang="ts">
import { ProxyExpireStatus, ProxyOrderStatus } from '/@/enums'
import { useUserStore } from '/@/stores/user'
import { canUseLongRenewFirst } from '/@/views/agent/shop/utils/long-renew-first'
import type { UnwrapRowType, UserGetProxyListMergedListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetProxyListMergedListData>

const { data, showRenew = false, onRenew = () => { } } = defineProps<{
  data: Data
  showRenew?: boolean
  onRenew?: (data: any) => void
}>()

const { userPayInfo } = storeToRefs(useUserStore())

const ExpireStatusMap = {
  [ProxyExpireStatus.expired]: { text: $t('已过期'), color: 'var(--colors-text-text-inactive)' },
  [ProxyExpireStatus.using]: { text: $t('使用中'), color: 'var(--colors-text-text-success)' },
  [ProxyExpireStatus.soon]: { text: $t('即将过期'), color: 'var(--colors-text-text-warning)' },
}

const OrderStatusMap = {
  [ProxyOrderStatus.pending]: { text: $t('配置中, 预计 {time} 分钟内完成', { time: 2 }), color: 'var(--colors-text-text-primary)' },
  [ProxyOrderStatus.refunding]: { text: $t('退款中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
  [ProxyOrderStatus.changing]: { text: $t('更换中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
  [ProxyOrderStatus.refunded]: { text: $t('已退款'), color: 'var(--colors-text-text-inactive)' },
}

const status = computed(() => {
  return OrderStatusMap[data.orderStatus as keyof typeof OrderStatusMap] || ExpireStatusMap[data.proxyExpireStatus as keyof typeof ExpireStatusMap] || { text: '', color: '' }
})

const showTime = computed(() => {
  return data.proxyExpireStatus !== ProxyExpireStatus.expired && ![ProxyOrderStatus.pending, ProxyOrderStatus.refunded].includes(data.orderStatus!)
})

const isRenewable = computed(() => {
  return data.proxyExpireStatus === ProxyExpireStatus.soon && data.orderStatus === ProxyOrderStatus.done
})

/** 列表行有资格且未使用才可享；角标数字用账户最低长续档，与代理列表 / 右键特惠同一口径 */
const showLongRenewBadge = computed(() => {
  const off = Number(userPayInfo.value.proxyRenewMinDiscount ?? 0) || 0
  return canUseLongRenewFirst(data) && off > 0
})

const longRenewBadgeText = computed(() => {
  return $t('{discount}% Off', { discount: userPayInfo.value.proxyRenewMinDiscount })
})

const statusColor = computed(() => status.value.color)
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="flex flex-col gap-1">
      <div v-if="showTime" class="date">
        {{ data.isPermanent ? $t('永久') : data.expireDate || '--' }}
      </div>
      <div class="status">
        {{ status.text }}
      </div>
    </div>
    <div v-if="showRenew && isRenewable" class="relative shrink-0">
      <RxButton variant="outlined" size="xxs" icon="base/rx_ic_renew2" :label="$t('续费')" @click.stop="onRenew" />
      <span v-if="showLongRenewBadge" class="renew-discount">{{ longRenewBadgeText }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.date {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.status {
  color: v-bind(statusColor);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.renew-discount {
  position: absolute;
  top: -4px;
  right: 0;
  z-index: 1;
  transform: translate(20%, -50%);
  padding: 2px 8px;
  border-radius: 9999px;
  background: #fc9d12;
  color: #fff;
  font-family: 'DingTalk JinBuTi', sans-serif;
  font-size: 12px;
  line-height: normal;
  white-space: nowrap;
  pointer-events: none;
}
</style>
