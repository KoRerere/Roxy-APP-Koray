<script setup lang="tsx">
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import currency from 'currency.js'
import { format, addDays } from 'date-fns'
import { $t } from '/@/locales'
import { API } from '/@/api';
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { usePay } from '/@/views/pay/wallet/hook'
import { PayWay } from '/@/enums/pay';
import { ProxyOrderType } from '/@/enums/proxy';

interface Props {
  data: any[]
}

const { data: dataList } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const themeStore = useThemeStore()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()

const periods = ref()
const periodValue = ref()
const columns = [
  {
    title: $t('出口 IP'),
    key: 'outbound',
    render: ({ data }: any) => <OutboundIp country={data.lastCountry} city={data.lastCity} lastIp={data.lastIp} time={data.checkTime} />,
  },
  {
    title: $t('服务商'),
    key: 'proxyProviderName',
  },
  {
    title: $t('到期时间'),
    key: 'expireDate',
    slot: 'expired',
  },
]

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/proxy/shop_dialog_bg.svg")' : 'url("/images/proxy/shop_dialog_bg_dark.svg")'
})

const totalAmount = computed(() => {
  const { proxyPrice } = periodValue.value || {}
  return currency(proxyPrice * dataList.length).value
})

onBeforeMount(() => {
  getPeriodList()
})

async function getPeriodList() {
  const { code, data, msg } = await API.proxy.userGetProxyPurchaseTimePriceList()
  onlyErrorToast(code, msg)
  if (code !== 0) return

  const purchaseTimePrice = data.map(item => {
    const day = item.proxyPurchaseMonths * 30
    return { label: $t('{day} 天', { day }), value: item.proxyPurchaseMonths, day, ...item }
  })

  periods.value = purchaseTimePrice
  periodValue.value = purchaseTimePrice[0]
}

async function onPay() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <WalletPayModal
        amount={totalAmount.value}
        onClose={hideModal}
        onConfirm={onConfirm}
      />,
    },
  })

  async function onConfirm({ payType }: any) {
    const renewIdList = dataList.map(item => item.id)
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      payType,
      renewIdList,
      orderType: ProxyOrderType.Renew,
      subscriptionMonths: periodValue.value.value,
    })
    onlyErrorToast(code, msg)
    if (code !== 0) return
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        emit('close')
        emit('success')
      })
  }
}

</script>

<template>
  <div class="flex flex-col gap-9 pa-8 rounded-lg w-240 popup">
    <div class="flex items-center justify-between">
      <span class="header">{{ $t('续费代理 IP') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-3 h-76">
      <div class="subtitle">{{ $t('您将要续费 {count} 个代理 IP:', { count: dataList.length }) }}</div>
      <RyTable class="proxies" :columns="columns" :data-list="dataList" :show-table-header="false" :paginator="false" :show-actions="false">
        <template #expired="{ data }">
          <div class="flex items-center gap-3">
            <span>{{ format(new Date(data.expireDate), "yyyy/MM/dd") }}</span>
            <SvgIcon name="base/rx_ic_play" size="12"></SvgIcon>
            <span class="color-[var(--colors-text-text-success)]">{{ format(addDays(new Date(data.expireDate), periodValue?.day ?? 0), 'yyyy/MM/dd') }}</span>
          </div>
        </template>
      </RyTable>
    </div>
    <div class="flex items-center gap-6">
      <div class="w-40 text-right subtitle">{{ $t('续费时长:') }}</div>
      <div class="flex gap-4">
        <div v-for="item in periods" :key="item.value" class="px-5 py-2 cursor-pointer select-none period" :class="{ active: item.value === periodValue.value }" @click="periodValue = item">
          {{ item.label }}
        </div>
      </div>
    </div>
    <div class="separator"></div>
    <div class="flex items-center justify-end">
      <div class="mr-3 price-label">{{ $t('总价:') }}</div>
      <div class="mr-6 price-value">{{ currency(totalAmount).format() }}</div>
      <RxButton size="lg" :label="$t('确认并支付')" @click="onPay"></RxButton>
    </div>
  </div>
</template>



<style lang="scss" scoped>
.popup {
  background-color: var(--colors-background-bg-page);
  background-image: v-bind(bgSrc);
  background-size: 100% auto;
  background-repeat: no-repeat;
  background-position: 0 0;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: 30px;
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.proxies {
  border-radius: 6px;
  border: 0.5px solid var(--colors-border-border-subtle);
  overflow: hidden;
}

.period {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  color: var(--colors-text-text-primary);
  font-size: 16px;
  line-height: 24px;

  &.active {
    border-color: var(--colors-border-border-brand);
    color: var(--colors-text-text-brand);
  }
}

.separator {
  border-bottom: 1px solid var(--colors-border-divider);
}

.price {
  &-label {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }

  &-value {
    color: var(--colors-text-text-brand);
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }
}
</style>
