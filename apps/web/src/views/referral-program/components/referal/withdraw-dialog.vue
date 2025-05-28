<script setup lang="tsx">
import type { UserGetPromotionInfoListData } from '@roxy/backend-api';
import { API } from '/@/api';
import RxPaymentMethods from '/@/components/rx-payment-methods.vue'
import { PayWay } from '/@/enums/pay'
import { useResponseToast } from '/@/hooks/useResponseToast';
import { $t } from '/@/locales';
import currency from 'currency.js'
import { validateTRC20Address } from './utils'
import { useDialog } from '/@/hooks/useDialog';
import IdentityVerification from './identity-verification.vue';
import { ceilByStep } from '/@/views/pay/subscribe/util';
import type { InputNumberBlurEvent } from 'primevue/inputnumber';

const { promotionInfo, hideFn, onSuccess } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data'],
  hideFn: () => any,
  onSuccess: () => Promise<void>
}>()

const [showToast, onlyErrorToast] = useResponseToast();
const [showModal] = useDialog()

const form = ref({
  amount: promotionInfo.withdrawAmount, // 提现金额
  withdraw_method: PayWay.Balance, // 提现方式：Balance，USDT
  withdraw_address: '', // 提现地址：USDT才有，余额可以不用传
  ver_code: '', // 提现验证码：USDT才有，余额可以不用传
})
const withdrawAddressErrorText = ref('')

const paymentMethods = [PayWay.Balance, PayWay.USDT, PayWay.Card, PayWay.Alipay].map(item => ({ value: item }))
const disabledMethods = [PayWay.Card, PayWay.Alipay]

// 提现到非Roxy钱包, 金额需要大于50
const isAmountLessThan50 = computed(() => {
  return promotionInfo.withdrawAmount < 50 || form.value.amount < 50
})

const withdrawDisabled = computed(() => {

  switch (form.value.withdraw_method) {
    case PayWay.Balance:
      return promotionInfo.withdrawAmount <= 0 || form.value.amount <= 0
    case PayWay.USDT:
      return isAmountLessThan50.value || !form.value.withdraw_address.trim() || withdrawAddressErrorText.value.trim().length > 0
    default:
      return false
  }
})

/** 最低提现金额文本提示 */
const minWithdrawAmountText = computed(() => {
  if (form.value.withdraw_method === PayWay.Balance) {
    return $t('(最低 $1)')
  }
  return $t('(最低 $50)')
})

watch(() => form.value.withdraw_method, (val) => {
  handleWithdrawAmountChange(form.value.amount)
})

watch(() => form.value.withdraw_address, (val) => {
  if (val && form.value.withdraw_method === PayWay.USDT) {
    const { isValid, message } = validateTRC20Address(val)
    if (!isValid) {
      withdrawAddressErrorText.value = message
    } else {
      withdrawAddressErrorText.value = ''
    }
  }
})

async function handleConfirmWithdrawal() {
  await nextTick()
  if (withdrawDisabled.value) {
    return
  }
  if (form.value.withdraw_method === PayWay.Balance) {
    await handleWithdrawal()
  } else {
    await showIdentityVerificationModal()
  }
}

async function handleWithdrawal() {
  const { code, msg } = await API.base.userWithdrawCreate(form.value)
  if (code !== 0) {
    onlyErrorToast(code, msg)
    return code
  }
  showToast(code, $t('提现申请已递交，预计 5 个工作日内发放，您可以在提现记录中查询到账情况'))
  hideFn?.()
  onSuccess?.()
  return code
}


async function showIdentityVerificationModal() {
  const { code, msg } = await API.base.userWithdrawVerifyCodeList({ amount: form.value.amount.toString() })

  if (code !== 0) {
    onlyErrorToast(code, msg)
    return
  }
  showToast(0, $t('验证码已发送'))

  const handleOk = async (code: string) => {
    form.value.ver_code = code
    const resCode = await handleWithdrawal()
    if (resCode === 0) {
      dialogInstance.handleCancel()
    }
  }

  const dialogInstance = showModal({
    header: $t('请检查您的邮箱'),
    class: 'w-[382px]',
    slots: {
      default: () => <IdentityVerification onOk={handleOk} />,
      footer: undefined
    }
  })
}

function handleAmountQuickCheck(amount: number) {
  form.value.amount = Math.min(amount, promotionInfo.withdrawAmount)
}

function handleWithdrawAmountChange(amount: number) {
  if (amount && form.value.withdraw_method === PayWay.USDT) {
    console.log('handleWithdrawAmountChange', amount)
    const step = 50
    const tempValue = ceilByStep(currency(amount).value, step)
    const remainder = ~~promotionInfo.withdrawAmount % step
    nextTick(() => {
      form.value.amount = Math.min(Math.max(tempValue, 50), ~~promotionInfo.withdrawAmount - remainder)
    })
    console.log('form.value.amount', form.value.amount)
  }
}

function handleBlur(event: InputNumberBlurEvent) {
  const value = Number(event.value)
  handleWithdrawAmountChange(value)
}
</script>

<template>
  <div class="withdraw-dialog">
    <div class="row">
      <div class="label">{{ $t('可提现余额') }}</div>
      <div class="available-withdrawal-amount">${{ currency(promotionInfo.withdrawAmount) }}</div>
    </div>
    <div class="row">
      <div class="label">
        {{ $t('输入提现金额') }}
        <template v-if="minWithdrawAmountText">
          {{ minWithdrawAmountText }}
        </template>
      </div>
      <div class="withdrawal-input">
        <IconField>
          <InputIcon class="text-[14px]">$</InputIcon>
          <InputNumber v-model="form.amount" :minFractionDigits="0" :maxFractionDigits="5" :min="0"
            :max="promotionInfo.withdrawAmount" fluid :useGrouping="false" input-class="!w-[150px]"
            @blur="handleBlur" />
        </IconField>
        <template v-if="form.withdraw_method === PayWay.Balance">
          <RxButton size="xs" :label="$t('全部提现')" :disabled="!promotionInfo.withdrawAmount" outlined
            severity="secondary" @click="form.amount = promotionInfo.withdrawAmount" />
        </template>
        <template v-else>
          <rx-amount-quick-check :presets="[50, 100, 200, 300]" :disabled="isAmountLessThan50"
            @select="handleAmountQuickCheck($event)" />
        </template>
      </div>
    </div>
    <div class="row">
      <div class="label">{{ $t('提现到') }}</div>
      <div class="desc">
        {{ $t('目前仅支持提现至 Roxy 钱包及 USDT 地址，更多选项即将推出。') }}
      </div>
      <RxPaymentMethods v-model="form.withdraw_method" :methods="paymentMethods" :disabled-methods="disabledMethods" />
      <template v-if="form.withdraw_method === PayWay.USDT">
        <div class="usdt-info">
          <div class="label">{{ $t('您的 USDT 钱包地址') }}</div>
          <InputText v-model="form.withdraw_address" type="text" :placeholder="$t('USDT 钱包地址')" class="w-full" />
          <Message v-if="withdrawAddressErrorText" severity="error" size="small" variant="simple">{{
            withdrawAddressErrorText }}</Message>
          <div class="desc">
            {{ $t('提现到账时间：5 个工作日内') }}
          </div>
        </div>
      </template>
    </div>
    <RxButton size="lg" class="w-full" :label="$t('确认')" :disabled="withdrawDisabled"
      @click="handleConfirmWithdrawal" />
  </div>
</template>

<style lang="scss" scoped>
.withdraw-dialog {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  align-self: stretch;
  padding-top: 20px;

  .row {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .label {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .available-withdrawal-amount {
    color: var(--primitives-yellow-500, #FC9D12);
    font-family: Inter;
    font-size: 20px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .withdrawal-input {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;


  }

  .usdt-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 6px;
    align-self: stretch;

    .label {
      color: var(--colors-text-text-primary, #FAFAFA);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: normal;
    }
  }

  .desc {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }
}
</style>
