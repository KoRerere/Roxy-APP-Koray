<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { format, parse } from 'date-fns'
import { API } from '/@/api'

import { AutoRenewalPayStatus } from '/@/enums/pay'
import { strConcat } from '/@/utils'
import { useEmitterEvent } from '/@/utils/eventBus'
import type { SvgNames } from '/@/components/rx-icon'

type RenewRow = Awaited<ReturnType<typeof API.pay.userGetPendingPaymentListList>>['data']['rows'][number] & {
  proxyInfo: { lastIp: string, lastCountry: string, lastCity?: string, proxyType: string }
}

const router = useRouter()

const hasUnpaid = ref(false)
const loading = ref(false)
const rows = ref<RenewRow[]>([])

/** 拉取自动续费服务列表（不分页） */
async function getList() {
  loading.value = true
  try {
    const { code, data } = await API.pay.userGetPendingPaymentListList({ page_index: '1', page_size: '999' })
    if (code !== 0) {
      return
    }
    rows.value = (data?.rows || []) as RenewRow[]
    hasUnpaid.value = rows.value.some(item => item.status === AutoRenewalPayStatus.Fail)
  }
  finally {
    loading.value = false
  }
}

/** 是否为代理 IP 续费项（有 IP 信息） */
function isProxyRow(row: RenewRow) {
  return !!row.proxyInfo?.lastIp
}

/** 下次账单时间：后端为 yyyy-MM-dd HH:mm:ss，展示为 yyyy/MM/dd HH:mm:ss */
function formatDate(value?: string) {
  if (!value) {
    return '--'
  }
  const date = parse(value, 'yyyy-MM-dd HH:mm:ss', new Date())
  return Number.isNaN(date.getTime()) ? value : format(date, 'yyyy/MM/dd HH:mm:ss')
}

function toBilling() {
  router.replace({ name: 'wallet', query: { name: 'billing' } })
}

onMounted(getList)
useEmitterEvent('updateAutoRenewList', getList)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="tt-primary text-4 leading-5 font-600">
      {{ $t('自动续费服务') }}
    </div>
    <RxAlert v-if="hasUnpaid" class="w-full" type="warn">
      <template #title>
        <i18n-t tag="div" scope="global" :keypath="$t('您有一笔未支付的续订费用，{billing}。', { billing: '{billing}' })">
          <template #billing>
            <a class="cursor-pointer help-link" @click="toBilling">{{ $t('前往支付') }}</a>
          </template>
        </i18n-t>
      </template>
    </RxAlert>

    <div class="flex-1 min-h-50 flex flex-col rounded-2 overflow-hidden renew-table">
      <!-- 表头 -->
      <div class="flex items-center gap-2.5 pl-4 pr-3 py-2.5 text-3 leading-4 font-500 tt-primary renew-table-header">
        <div class="flex-1 min-w-0">
          {{ $t('服务详情') }}
        </div>
        <div class="shrink-0 w-35">
          {{ $t('续费价格') }}
        </div>
        <div class="shrink-0 w-37">
          {{ $t('下一次账单日期') }}
        </div>
      </div>

      <!-- 内容 -->
      <div v-if="loading && !rows.length" class="flex items-center justify-center h-30">
        <SvgIcon class="animate-spin" name="base/rx_ic_spin" size="20" color="var(--colors-icon-icon-note)" />
      </div>
      <CustomEmpty v-else-if="!rows.length" class="py-6" icon="rx_illustration_coin.svg" :desc="$t('您目前没有将服务设置为自动续费')" />
      <template v-else>
        <div v-for="(row, index) in rows" :key="index" class="flex items-center gap-2.5 pl-4 pr-3 py-3.5 renew-table-row">
          <div class="flex-1 min-w-0 flex items-center gap-1.5">
            <SvgIcon v-if="isProxyRow(row)" class="shrink-0" :name="(`country-code/${row.proxyInfo.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" size="16" />
            <SvgIcon v-else class="shrink-0" name="base/rx_ic_browser" size="16" color="var(--colors-icon-icon-brand, #11a3fd)" />
            <span class="truncate text-3.25 leading-4.5 font-500 tt-primary">{{ row.details }}</span>
            <RxTooltip v-if="isProxyRow(row)" class="shrink-0 flex">
              <template #default>
                <SvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
              </template>
              <template #content>
                <div class="flex flex-col gap-1 min-w-60">
                  <div class="flex items-center gap-2">
                    <SvgIcon :name="(`country-code/${row.proxyInfo.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" />
                    <div class="flex-1 proxy-text">
                      {{ row.proxyInfo.lastCountry }}{{ strConcat('/', row.proxyInfo.lastCity) }}
                    </div>
                    <div class="pl-6 proxy-type">
                      {{ row.proxyInfo.proxyType }}
                    </div>
                  </div>
                  <div class="pl-6 proxy-text">
                    {{ row.proxyInfo.lastIp }}
                  </div>
                </div>
              </template>
            </RxTooltip>
          </div>
          <div class="shrink-0 w-35 flex items-baseline gap-1 whitespace-nowrap">
            <span class="text-3.5 leading-5 font-600 tt-primary">{{ currency(row.amount).format() }}</span>
            <span class="text-3.25 leading-4.5 tt-tertiary">/ {{ $t('{day} 天', { day: row.days }) }}</span>
          </div>
          <div class="shrink-0 w-37 text-3.25 leading-4.5 tt-primary whitespace-nowrap">
            {{ formatDate(row.startTime) }}
          </div>
        </div>
      </template>
    </div>

    <i18n-t class="help" tag="div" scope="global" :keypath="$t('* 要查看所有交易记录，请访问{billing}。', { billing: '{billing}' })">
      <template #billing>
        <a class="cursor-pointer help-link" @click="toBilling">{{ $t('账单页面') }}</a>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.renew-table {
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  // 设计稿表格本身无底色，只有表头有底色
  background: transparent;

  &-header {
    background: var(--component-table-bg-header, #f1f5f8);
  }

  &-row {
    border-bottom: 1px solid var(--colors-border-divider, #e2e9ee);
  }
}

.proxy {
  &-text {
    color: var(--component-tooltip-text-primary);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  }

  &-type {
    color: var(--component-tooltip-text-secondary);
    font-size: 12px;
    line-height: 16px;
  }
}

.help {
  color: var(--colors-text-text-inactive);
  text-align: right;
  font-size: 12px;
  line-height: normal;

  &-link {
    color: var(--colors-text-text-link);
    text-decoration-line: underline;
    text-underline-position: from-font;
  }
}
</style>
