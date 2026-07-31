<script setup lang="tsx">
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import currency from 'currency.js'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { API } from '/@/api'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { usePay } from '/@/views/pay/wallet/hook'
import { PayWay } from '/@/enums/pay'
import { useProxyShopLabels } from '../utils/proxy-shop-labels'

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
const { showFreedomActivityModal } = useFreedomActivity()
const shopLabels = useProxyShopLabels()

const columns = [
  {
    title: $t('出口 IP'),
    key: 'outbound',
    render: ({ data }: any) => <OutboundIp country={data.lastCountry} city={data.lastCity} lastIp={data.lastIp} time={data.checkTime} />,
  },
  {
    title: $t('当前'),
    key: 'current',
    slot: 'current',
  },
  {
    title: $t('价格'),
    key: 'price',
    slot: 'price',
  },
]

const notes = [
  $t('1. 所有代理程序默认都是10Mbps。升级带宽必须支付差价。'),
  $t('2. 带宽升级仅支持美国、香港、日本和法国的IP使用。其他地区目前不支持。'),
  $t('3. 带宽不支持降级。'),
]

const proxyInfo = ref()
const periods = ref()
const periodValue = ref<any>({})
const loading = ref(false)

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/proxy/shop_dialog_bg.svg")' : 'url("/images/proxy/shop_dialog_bg_dark.svg")'
})

const totalAmount = computed(() => {
  return periodValue.value.bandwidthUpgradePrice
})

onBeforeMount(() => {
  getPeriodList()
})

async function getPeriodList() {
  loading.value = true
  const { code, data, msg } = await API.proxy.userGetProxyBandwidthUpgradePriceListList({ proxyId: dataList[0].id })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  const purchaseTimePrice = data.proxyBandwidthPriceList.map((item) => {
    return { label: `${item.bandwidthSpeed}Mbps`, value: item.bandwidthSpeed, ...item }
  })

  proxyInfo.value = data

  periods.value = purchaseTimePrice
  periodValue.value = purchaseTimePrice[0]
}

async function onPay() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <WalletPayModal
          amount={totalAmount.value}
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: any) {
    const { code, data, msg } = await API.proxy.userUpgradeProxyBandwidthSettlementCreate({
      payType,
      proxyId: dataList[0].id,
      bandwidthSpeed: periodValue.value.value,
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        showFreedomActivityModal()
        emit('close')
        emit('success')
      })
  }
}
</script>

<template>
  <div class="relative flex flex-col gap-9 pa-8 rounded-lg w-240 popup">
    <RxLoading v-model="loading" :opacity="0.9" />
    <div class="flex items-center justify-between">
      <span class="header">{{ $t('升级带宽') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-3 h-48">
      <div class="subtitle">
        {{ shopLabels.upgradeCountDesc(dataList.length) }}
      </div>
      <RyTable class="proxies" :columns="columns" :data-list="dataList" :show-table-header="false" :paginator="false" :show-actions="false">
        <template #current>
          <span>{{ proxyInfo?.currentBandwidthSpeed }}Mbps</span>
        </template>
        <template #price="{ data: row }">
          <div class="flex items-center gap-3">
            <span>{{ currency(row.proxyProviderDiscountPrice).format() }}/{{ $t('{day} 天', { day: 30 }) }}</span>
            <SvgIcon name="base/rx_ic_play" size="12" />
            <span class="color-[var(--colors-text-text-success)]">{{ currency(periodValue.bandwidthPrice).format() }}/{{ $t('{day} 天', { day: 30 }) }}</span>
          </div>
        </template>
      </RyTable>
    </div>
    <div class="flex items-center gap-6">
      <div class="w-40 text-right subtitle">
        {{ $t('升级带宽到:') }}
      </div>
      <div class="flex gap-4">
        <div v-for="item in periods" :key="item.value" class="px-5 py-2 cursor-pointer select-none period" :class="{ active: item.value === periodValue.value }" @click="periodValue = item">
          {{ item.label }}
        </div>
      </div>
    </div>
    <div class="flex gap-6">
      <div class="w-40 text-right subtitle">
        {{ $t('注意事项:') }}
      </div>
      <div class="flex flex-col max-w-150">
        <div v-for="item in notes" :key="item" class=" tt-tertiary text-3 leading-5">
          {{ item }}
        </div>
      </div>
    </div>
    <div class="separator" />
    <div class="flex items-center justify-end gap-6">
      <div class="flex flex-col items-end">
        <div class="flex items-center gap-3">
          <div class="tt-primary text-4 font-600">
            {{ $t('总价:') }}
          </div>
          <div class="tt-brand text-6 font-600">
            {{ currency(totalAmount).format() }}
          </div>
        </div>
        <div class="tt-tertiary text-3 leading-5">
          {{ $t('还剩 {day} 天到期', { day: proxyInfo?.remainingDays }) }}
        </div>
      </div>
      <RxButton size="lg" :label="$t('确认并支付')" @click="onPay" />
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
</style>
