<script setup lang="ts">
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import currency from 'currency.js'
import { format } from 'date-fns'
import { API } from '/@/api'
import { OrderType, OrderTypeStr, PaymentStatus, PaymentStatusStr, PayWay, PurchaseType, SubLevelEnum, SubOrderType } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useEmitterEvent } from '/@/utils/eventBus'
import { useDialog } from '/@/hooks/useDialog'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { openProcessing } = usePay()
const [_, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()
const { showFreedomActivityModal } = useFreedomActivity()

const tableRef = useTemplateRef('rxtable')

const columns = [
  {
    title: $t('订单号'),
    key: 'orderNo',
    getText: (row: any) => row.orderNo || '--',
  },
  {
    title: $t('操作人'),
    key: 'operatorName',
  },
  {
    title: $t('类型'),
    key: 'orderType',
    getText: (row: any) => OrderTypeStr[row.orderType as keyof typeof OrderTypeStr],
  },
  {
    title: $t('金额'),
    key: 'actualAmount',
    slot: 'amount',
  },
  {
    title: $t('状态'),
    key: 'payStatus',
    slot: 'status',
  },
  {
    title: $t('详情'),
    key: 'detailStr',
    style: {
      width: '25%',
    },
  },
  {
    title: $t('日期'),
    key: 'createTime',
    getText: (row: any) => format(row.createTime, 'yyyy/MM/dd HH:mm:ss'),
  },
]

const detailMapStr = {
  [SubOrderType.Subscribe]: (data: any) => $t('{count} 窗口, {day} 天', { count: data.windowCount, day: data.day }),
  [SubOrderType.Upgrade]: (data: any) => $t('{oldCount} -> {newCount} 窗口', { oldCount: data.oldWindowCount, newCount: data.windowCount }),
  [SubOrderType.Auto]: () => $t('自动续订'),
  [SubOrderType.Extend]: (data: any) => $t('套餐延长 {day} 天', { day: data.day }),
  [SubOrderType.Workspace_Member]: (data: any) => {
    return [
      [data.workspace, $t('{workspace} 团队', { workspace: data.workspace })],
      [data.staff, $t('{member} 团队成员', { member: data.staff })],
    ].filter(([value]) => value > 0).map(([_, label]) => label).join(', ')
  },
  [SubOrderType.Downgrade]: (data: any) => $t('{oldCount} -> {newCount} 窗口', { oldCount: data.oldWindowCount, newCount: data.windowCount }),
  [SubOrderType.Proxy]: (data: any) => data.proxyContent,
}

const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

useEmitterEvent('updateBillList', () => {
  tableRef.value?.refresh()
})

async function tableRequest(params: any) {
  const data = await API.pay.userGetPurchaseRecordsInfoList(params)
  data.data.rows = data.data.rows.map(({ detail, ...item }) => {
    const detailStr = detail?.content || detailMapStr[detail?.subType as SubOrderType]?.(detail) || '--'
    return { detail, detailStr, ...item }
  })
  return data
}

async function tableFilters() {
  return [
    {
      type: 'multiple',
      name: 'orderType',
      value: [],
      placeholder: $t('全部类型'),
      options: [
        OrderType.Recharge,
        OrderType.PointsRecharge,
        OrderType.Subscribe,
        OrderType.Change,
        OrderType.Renew,
        OrderType.Purchase,
        OrderType.ProxyPurchase,
        OrderType.ProxyRefund,
        OrderType.ProxyRenew,
        OrderType.OfficialGift,
        OrderType.BandwidthUpgrade,
      ].map(item => ({ label: OrderTypeStr[item as keyof typeof OrderTypeStr], value: item })),
    },
    {
      type: 'date',
      name: 'date',
      placeholder: $t('全部时间'),
      formatValue: (input: any, _: any, formData: any) => {
        if (Array.isArray(input.value)) {
          const [startDate, endDate] = input.value
          Object.assign(formData, {
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate || startDate, 'yyyy-MM-dd'),
          })
        }
      },
    },
  ]
}

function onRepay(row: any) {
  if (row.payType === PayWay.Balance) {
    reAutoRenew(row)
  }
  else {
    onRecharge(row)
  }
}

async function onRecharge(row: any) {
  const { data, code, msg } = await API.pay.userGetPayLinkList({ orderNo: row.orderNo })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  const isPurchaseProxy = row.purchaseType === PurchaseType.Proxy

  openProcessing({ ...row, ...data }, isPurchaseProxy ? 'silent' : row.orderType)
    .finally(() => {
      if (isPurchaseProxy) {
        router.push({ name: 'agent-list', query: { name: 'shop' } })
      }
      else {
        tableRef.value?.refresh()
      }
    })
}

function reAutoRenew(row: any) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount: row.actualAmount,
        onClose: hideModal,
        onConfirm: async () => {
          const { code, msg } = await API.pay.userWalletSettlementCreate({ orderNo: row.orderNo })
          onlyErrorToast(code, msg)
          if (code !== 0)
            return
          openProcessing(row, row.orderType)
            .finally(() => {
              showFreedomActivityModal()
              tableRef.value?.refresh()
            })
        },
      }),
    },
  })
}

defineExpose({
  refresh: () => {
    tableRef.value?.refresh()
  },
})
</script>

<template>
  <RyTable ref="rxtable" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_coin.svg" :title="$t('暂无帐单记录')" :desc="$t('您的付款记录和订阅订单将在此显示')" />
    </template>
    <template #amount="{ data }">
      <div class="amount" :class="{
        gray: data.payStatus === PaymentStatus.Closed,
        inc: data.positiveNegativeShow,
      }"
      >
        {{ !data.showAmount ? '--' : currency(data.actualAmount, { symbol: data.positiveNegativeShow ? '+$' : '-$' }).format() }}
      </div>
    </template>
    <template #status="{ data }">
      <div class="flex items-center gap-2.5 status" :class="{ red: data.payStatus === PaymentStatus.Wait }">
        <div>{{ PaymentStatusStr[data.payStatus as keyof typeof PaymentStatusStr] || '--' }}</div>
        <RxButton v-if="data.payStatus === PaymentStatus.Wait" outlined severity="secondary" :label="$t('立即支付')" icon="base/rx_ic_credit_card" size="xxs" @click="onRepay(data)" />
        <RxButton v-if="data.payStatus === PaymentStatus.Closed && data.orderType === OrderType.Renew && isExpired && !!Number(data.isAuto)" outlined severity="secondary" :label="$t('购买套餐')"
                  icon="base/rx_ic_credit_card" size="xxs" @click="router.replace({ name: 'subscribe-plan' })"
        />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.amount {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;

  &.inc {
    color: var(--primitives-green-500, #1cc94d);
  }

  &.gray {
    color: var(--colors-text-text-inactive) !important;
  }
}

.status {
  color: var(--colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 12px;
  line-height: normal;

  &.red {
    color: var(--primitives-red-500, #f53838);
  }
}
</style>
