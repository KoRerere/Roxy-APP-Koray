<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { format } from 'date-fns'
import { API } from '/@/api'

import { AutoRenewalPayStatus } from '/@/enums/pay'
import { strConcat } from '/@/utils'
import { emitter } from '/@/utils/eventBus'
import type { SvgNames } from '/@/components/rx-icon'

const router = useRouter()

const hasUnpaid = ref(false)
const tableRef = useTemplateRef('autorenew')
const columns = [
  {
    title: $t('服务详情'),
    key: 'details',
    slot: 'details',
  },
  {
    title: $t('续费价格'),
    key: 'amount',
    slot: 'amount',
  },
  {
    title: $t('下一次账单日期'),
    key: 'startTime',
    getText: (row: any) => row.startTime || '--',
  },
]

async function tableRequest(params: any) {
  const data = await API.pay.userGetPendingPaymentListList({ ...params, page_size: 999 })
  hasUnpaid.value = data.data.rows.some(item => item.status === AutoRenewalPayStatus.Fail)
  return data
}

function toBilling() {
  router.replace({ name: 'wallet', query: { name: 'billing' } })
}

onMounted(() => {
  emitter.on('updateAutoRenewList', () => {
    tableRef.value?.refresh()
  })
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="title">
      {{ $t('自动续订服务') }}
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
    <div class="flex-1 overflow-hidden rounded-xl list">
      <RyTable ref="autorenew" class="autorenew-table" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false" :show-table-header="false" :paginator="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_coin.svg" :desc="$t('您目前没有将服务设置为自动续订')" />
        </template>
        <template #details="{ data }">
          <div class="flex items-center gap-1">
            <div class="text-14px text-[var(--colors-text-text-primary)]">
              {{ data.details }}
            </div>
            <RxTooltip v-if="data.proxyInfo.lastIp">
              <template #default>
                <SvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
              </template>
              <template #content>
                <div class="flex flex-col gap-1 min-w-60">
                  <div class="flex items-center gap-2">
                    <SvgIcon :name="(`country-code/${data.proxyInfo.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" />
                    <div class="flex-1 proxy-text">
                      {{ data.proxyInfo.lastCountry }}{{ strConcat('/', data.proxyInfo.lastCity) }}
                    </div>
                    <div class="pl-6 proxy-type">
                      {{ data.proxyInfo.proxyType }}
                    </div>
                  </div>
                  <div class="pl-6 proxy-text">
                    {{ data.proxyInfo.lastIp }}
                  </div>
                </div>
              </template>
            </RxTooltip>
          </div>
        </template>
        <template #amount="{ data }">
          <div class="flex items-baseline gap-0.5">
            <span class="price">{{ currency(data.amount).format() }}</span>
            <span>/</span>
            <span class="days">{{ $t('{day} 天', { day: data.days }) }}</span>
          </div>
        </template>
      </RyTable>
    </div>
    <i18n-t class="help" tag="div" scope="global" :keypath="$t('* 要查看所有交易记录，请访问{billing}。', { billing: '{billing}' })">
      <template #billing>
        <a class="cursor-pointer help-link" @click="toBilling">{{ $t('账单页面') }}</a>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.autorenew-table {
  // border-bottom: 1px solid var(--colors-border-border-inactive, #E2E9EE);
  --datatable-header-cell-background: #fff;
  --datatable-header-cell-border-color: var(--colors-border-border-inactive, #e2e9ee);

  :deep(.table-wrapper) {
    border-top: none;
  }
}
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.list {
  border: 1px solid var(--colors-border-border-inactive);
}

.price {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
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

.days {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 20px;
}

.help {
  color: var(--colors-text-text-inactive);
  text-align: right;
  font-family: Inter;
  font-size: 12px;
  line-height: normal;

  &-link {
    color: var(--colors-text-text-link);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>

<style lang="scss">
[data-theme='dark'] {
  .autorenew-table {
    .p-datatable-header-cell {
      background: #000 !important;
    }
  }
}
</style>
