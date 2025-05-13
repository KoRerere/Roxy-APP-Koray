<script setup lang="tsx">
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import currency from 'currency.js'
import { $t } from '/@/locales'
import { PayWay } from '/@/enums/pay'
import { ceilByStep } from '/@/views/pay/subscribe/util'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'
import { debounce } from 'es-toolkit'

const [_, onlyErrorToast] = useResponseToast()

const dialogRef = inject<any>('dialogRef')
const _onConfirm = ref()
const _onCancel = ref()

const payways = [PayWay.Card, PayWay.Alipay, PayWay.Wechat, PayWay.USDT]
  .map(item => ({ value: item }))

const selectedPayway = ref(PayWay.Card)
const disabledMethods = ref<PayWay[]>([])
const step = 10
const min = 10
const max = 10 ** 5
const amount = ref(10)
const loading = ref(false)

onMounted(() => {
  const { onConfirm, onCancel } = dialogRef.value.data
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
  querySupportPayway()//部分地区不支持某些支付，初始化时查询一次
})

async function querySupportPayway() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetSupportPayTypeList({ amount: String(amount.value) })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0) return
  const payway = Object.values(data).flat() as PayWay[]
  disabledMethods.value = Object.values(PayWay).filter(item => !payway.includes(item))

  if (!payway.includes(selectedPayway.value)) {
    selectedPayway.value = payway[0]
  }
}

const delayQuery = debounce(querySupportPayway, 300)

function onUpdate(value: number) {
  nextTick(() => {
    amount.value = Math.min(Math.max(ceilByStep(currency(value).value, step), min), max)
    delayQuery()
  })
}

function quickSelect(value: number) {
  amount.value = value
  delayQuery()
}

async function confirm() {
  await _onConfirm.value?.({
    payType: selectedPayway.value,
    rechargeAmount: amount.value
  })
  close(false)
}

function close(isCancel: boolean) {
  dialogRef.value.close()
  if (isCancel)
    _onCancel.value?.()
}

</script>

<template>
  <div class="flex flex-col pl-8 pr-6 py-6 gap-8 popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('Roxy 钱包充值') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)">
      </SvgIcon>
    </div>
    <div class="flex flex-col gap-4">
      <div class="sub-title">{{ $t('请输入充值金额') }}</div>
      <div class="flex items-center gap-2">
        <RxStep class="!w-35" size="sm" v-model="amount" :min="min" :max="max" :step="step" @update:modelValue="onUpdate" @change="delayQuery"></RxStep>
        <rx-amount-quick-check @select="quickSelect" />
      </div>
    </div>
    <ItemBlock :title="$t('支付方式')">
      <RxPaymentMethods :loading="loading" v-model="selectedPayway" :methods="payways" :disabledMethods="disabledMethods"></RxPaymentMethods>
    </ItemBlock>
    <div class="flex flex-col border-0 border-t-0.5 border-dashed border-[#C7CDD1]">
      <div class="py-6 flex justify-between items-center total">
        <span class="flex-1 total-label">{{ $t('总金额') }}</span>
        <span class="total-price">{{ currency(amount).format() }}</span>
      </div>
      <RxButton :disabled="loading" size="lg" :label="$t('确认付款')" @click="confirm"></RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 500px;
}

.header {
  color: #000;
  font-size: 24px;
  font-weight: 600;
  line-height: 20px;
}

.sub-title {
  color: #000;
  font-family: Inter;
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.preset {
  border: 0.5px solid var(--Component-Colors-Tag-border, #E4E8EB);
  background: var(--Component-Colors-Tag-bg, #F0F3F5);
  color: var(--Component-Colors-Tag-text, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.total {
  &-label {
    color: var(--Colors-Text-text-secondary, #171C1F);
    font-size: 16px;
    font-weight: 700;
    line-height: 20px;
  }

  &-price {
    color: var(--Color-blue-300, #12A3FC);
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }
}
</style>
