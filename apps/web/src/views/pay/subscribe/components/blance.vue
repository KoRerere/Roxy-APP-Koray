<script setup lang="ts">
import currency from 'currency.js';
import { RxAlert } from '/@/components/rx-alert/'
import { useUserStore } from '/@/stores/user';
import ChargeModal from '/@/views/pay/wallet/components/charge-modal.vue';
import { useDialog } from 'primevue/usedialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { API } from '/@/api';
import type { PayWay } from '/@/enums/pay';
import { $t } from '/@/locales';

const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()

interface Props {
  needPayAmount: number
}

const emit = defineEmits(['recharge:failed', 'recharge:success'])

const { needPayAmount } = defineProps<Props>()
const dialog = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const router = useRouter()

const warning = computed(() => needPayAmount && needPayAmount > userPayInfo.value.balance)

function onCharge() {
  dialog.open(ChargeModal, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0'
      }
    },
    data: {
      onConfirm: async (params: { payType: PayWay, rechargeAmount: number }) => {
        const { code, data, msg } = await API.pay.userRechargeSettlementCreate(params)
        onlyErrorToast(code, msg)
        if (code === 0) {
          openProcessing(data, 'silent')
            .then(getUserPayInfo)
            .then(() => {
              showToast(0, $t('您的钱包余额为: {value}', { value: currency(userPayInfo.value.balance).format() }))
              emit('recharge:success')
            })
            .catch(() => {
              showToast(1, $t('充值失败'))
              router.push({ name: 'wallet' })
              emit('recharge:failed')
            })
        }
      },
    },
  })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <RxAlert v-if="warning" class="w-full items-center py-2 px-3" type="warn" :closable="false">
      <template #content>
        <div class="w-full flex items-center justify-between">
          <div class="message">{{ $t('余额不足，无法完成此订单') }}</div>
          <RxButton size="xxs" severity="secondary" outlined icon="base/rx_ic_credit_card" :label="$t('充值金额')" @click="onCharge"></RxButton>
        </div>
      </template>
    </RxAlert>
    <div class="flex gap-2.5 items-center amount">
      <span>{{ $t('Roxy 钱包余额: ') }}</span>
      <span class="amount-value" :class="{ 'amount-warning': warning }">{{ currency(userPayInfo.balance).format() }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.message {
  color: var(--Color-neutrals-950, #0E1214);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
}

.amount {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 16px;
  line-height: 20px;

  &-value {
    color: var(--Colors-Text-text-primary, #171C1F);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;

    &.amount-warning {
      color: var(--Colors-Text-text-inactive, #A3A9AD);
    }
  }
}
</style>
