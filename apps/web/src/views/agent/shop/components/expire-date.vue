<script setup lang="ts">
import type { UserGetUserBuyProxyListListData, UnwrapRowType } from '@roxy/backend-api';
import { ProxyExpireStatus, ProxyOrderStatus } from '/@/enums'
import { $t } from '/@/locales';
import { format } from 'date-fns'

type Data = UnwrapRowType<UserGetUserBuyProxyListListData>

const { data } = defineProps<{
  data: Data
}>()

const ExpireStatusMap = {
  [ProxyExpireStatus.expired]: { text: $t('已过期'), color: 'var(--colors-text-text-inactive)' },
  [ProxyExpireStatus.using]: { text: $t('使用中'), color: 'var(--colors-text-text-success)' },
  [ProxyExpireStatus.soon]: { text: $t('即将过期'), color: 'var(--colors-text-text-warning)' }
}

const OrderStatusMap = {
  [ProxyOrderStatus.pending]: { text: $t('配置中, 预计 {time} 分钟内完成', { time: 2 }), color: 'var(--colors-text-text-primary)' },
  [ProxyOrderStatus.refunding]: { text: $t('退款中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
  [ProxyOrderStatus.changing]: { text: $t('更换中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
  [ProxyOrderStatus.refunded]: { text: $t('已退款'), color: 'var(--colors-text-text-inactive)' },
}

const status = computed(() => {
  // 优先显示订单状态
  return OrderStatusMap[data.orderStatus as keyof typeof OrderStatusMap] || ExpireStatusMap[data.proxyExpireStatus as keyof typeof ExpireStatusMap] || { text: '', color: '' }
})

const showTime = computed(() => {
  return data.proxyExpireStatus !== ProxyExpireStatus.expired && ![ProxyOrderStatus.pending, ProxyOrderStatus.refunded].includes(data.orderStatus!)
})

const statusColor = computed(() => status.value.color)
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-if="showTime" class="date">{{ data.expireDate || '--' }}</div>
    <div class="status">{{ status.text }}</div>
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
</style>
