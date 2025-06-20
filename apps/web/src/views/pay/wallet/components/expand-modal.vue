<script setup lang="tsx">
import { $t } from '/@/locales'
import { PayWay } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user';
import { RxAlert } from '/@/components/rx-alert'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import currency from 'currency.js'
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import Blance from '/@/views/pay/subscribe/components/blance.vue'
import { API } from '/@/api';
import { debounce } from 'es-toolkit'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { discountCalculate } from '/@/views/pay/subscribe/util.ts';
import { useSimpleLocale } from '/@/stores/locale';
const dialogRef = inject<any>('dialogRef')
const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()

const { getOfficialWebsite } = useSimpleLocale()
const { userPayInfo } = storeToRefs(useUserStore())
const [_, onlyErrorToast] = useResponseToast()

const selectedPayway = ref()
const disabledMethods = ref<PayWay[]>([])
const loading = ref(false)
const min = 0
const max = 500

const buyList = ref([
  {
    key: 'staff',
    label: $t('团队成员'),
    value: 0,
    cost: 5
  },
  {
    key: 'workspace',
    label: $t('工作空间'),
    value: 0,
    cost: 10
  }
])

const supportPayWays = computed(() => {
  return Object.values(PayWay)
    .map((item: PayWay) => ({ value: item, discount: (item === PayWay.Balance && walletAmount.value) ? currency(walletAmount.value, { symbol: '-$' }).format() : 0 }))
})

const allAmount = computed(() => buyList.value.reduce((acc, item) => currency(item.value).multiply(item.cost).add(acc).value, 0))

const disabled = computed(() => !buyList.value.some(item => item.value > 0) || (loading.value || selectedPayway.value === PayWay.Balance && finalAmount.value > userPayInfo.value?.balance))

const allDiscount = computed(() => {
  const { discount, walletDiscount } = userPayInfo.value!
  return Object.fromEntries([
    ['discount', discount, true],
    ['walletDiscount', walletDiscount, selectedPayway.value === PayWay.Balance],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))
})

//钱包支付立减金额
const walletAmount = computed(() => {
  // 钱包暂不支持自动续费，所以需要减去 autoRenewAmount，让钱包显示正确的优惠金额
  const { walletDiscount, autoRenewDiscount, ...otherDiscount } = allDiscount.value
  const discount: number[] = Object.values({ ...otherDiscount, walletDiscount: userPayInfo.value.walletDiscount })
  const _amount = currency(allAmount.value).multiply(discountCalculate(discount)).value
  return currency(allAmount.value).multiply(discountCalculate(Object.values(otherDiscount))).subtract(_amount).value
})

const finalAmount = computed(() => currency(allAmount.value).multiply(discountCalculate(Object.values(allDiscount.value))).value)

const detail = computed(() => {
  const { discount, walletDiscount } = allDiscount.value

  const list = buyList.value.map(item => ({
    title: item.label,
    items: [
      {
        label: $t('数量'),
        value: item.value
      },
      {
        label: $t('单价'),
        value: currency(item.cost).format()
      }
    ]
  })).concat([
    {
      items: [
        {
          label: $t('专属折扣'),
          value: `-${discount}%`,
          class: '!color-[#FC9D12]',
          visible: !!discount
        },
        {
          label: $t('钱包支付优惠'),
          class: '!color-[#FC9D12]',
          value: currency(walletAmount.value, { symbol: '-$' }).format(),
          visible: !!walletDiscount
        },
      ].filter(item => item.visible !== false)
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(allAmount.value).format(),
          visible: allAmount.value !== finalAmount.value,
          slot: 'oldprice'
        },
        {
          label: $t('实际价格'),
          value: currency(finalAmount.value).format(),
          diffValue: currency(allAmount.value).subtract(finalAmount.value).value,
          slot: 'price'
        },
      ].filter(item => item.visible !== false)
    }
  ] as any[]).filter(item => item.items.length)

  return list
})

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
  buyList.value.forEach(item => {
    if (item.key === props.defaultType) {
      Reflect.set(item, 'value', 1)
    }
  })
  querySupportPayway()//部分地区不支持某些支付，初始化时查询一次
})

async function querySupportPayway() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetSupportPayTypeList({ amount: String(allAmount.value) })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0) return
  const supportPayway = Object.values(data).flat().concat(PayWay.Balance) as PayWay[]
  disabledMethods.value = Object.values(PayWay).filter(item => !supportPayway.includes(item))

  if (!supportPayway.includes(selectedPayway.value)) {
    selectedPayway.value = supportPayway[0] !== PayWay.Card ? PayWay.Balance : supportPayway[0]
  }
}

const delayQuery = debounce(querySupportPayway, 300)

function onUpdate(value: number, item: any) {
  nextTick(() => {
    if (!value) item.value = 0
    delayQuery()
  })
}

async function confirm() {
  await _onConfirm.value?.({
    payType: selectedPayway.value,
    ...Object.fromEntries(buyList.value.map(item => [item.key, item.value]))
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
  <div class="flex flex-col pl-8 pr-6 py-6 gap-6 popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('购买团队成员和工作空间') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)">
      </SvgIcon>
    </div>
    <div class="flex gap-6">
      <div class="flex-1 flex flex-col gap-8">
        <div class="flex flex-col gap-4">
          <RxAlert class="w-full" type="info" size="small" :title="$t('您当前拥有: {member} 团队成员, {workspace} 工作空间', { member: userPayInfo?.maxMemberCount, workspace: userPayInfo?.maxWorkspaceCount })"
            :closable="false"></RxAlert>
          <div>
            <div class="sub-title">{{ $t('请选择数量') }}</div>
            <div class="mt-2 desc">{{ $t('团队成员和工作空间购买后永久有效') }}</div>
          </div>
          <div class="flex flex-col gap-6">
            <div class="flex items-center gap-4" v-for="item in buyList" :key="item.label">
              <div class="w-28 label">{{ item.label }}</div>
              <RxStepInput class="!w-30" size="xs" v-model="item.value" :min="min" :max="max" @update:modelValue="onUpdate($event, item)" @change="delayQuery" />
              <div>{{ currency(item.cost).format() }} / {{ item.label }}</div>
            </div>
          </div>
        </div>
        <ItemBlock :title="$t('支付方式')">
          <RxPaymentMethods v-model="selectedPayway" :loading="loading" :methods="supportPayWays" :disabledMethods="disabledMethods"></RxPaymentMethods>
        </ItemBlock>
        <Blance v-if="selectedPayway === PayWay.Balance" :need-pay-amount="finalAmount" @recharge:failed="close(true)">
        </Blance>
      </div>
      <Detail class="w-80" :list="detail">
        <template #oldprice="{ item }">
          <div class="flex justify-between">
            <div class="details-label">{{ item.label }}</div>
            <div class="details-oldprice">{{ item.value }}</div>
          </div>
        </template>
        <template #price="{ item }">
          <div class="flex justify-between items-center">
            <div class="details-label">{{ item.label }}</div>
            <div>
              <div class="details-price">{{ item.value }}</div>
              <div v-if="item.diffValue > 0" class="details-diffprice">{{ $t('节省 {value}', {
                value:
                  currency(item.diffValue).format()
              }) }}</div>
            </div>
          </div>
        </template>
        <template #after>
          <div class="flex-1 flex flex-col justify-end gap-3">
            <RxButton :disabled="disabled" size="lg" :label="$t('确认付款')" @click="confirm"></RxButton>
            <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
              <template #terms>
                <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
              </template>
            </i18n-t>
          </div>
        </template>
      </Detail>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: clamp(960px, 72.5vw, 1024px);
}

.header {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 24px;
  font-weight: 600;
  line-height: 20px;
}

.sub-title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.label {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 14px;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: normal;
}

.total {
  color: var(--colors-text-text-secondary, #B2B6B8);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;

  &-price {
    color: #12A3FC;
    font-size: 20px;
    font-weight: 600;
  }
}

.details {
  &-label {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-oldprice {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 16px;
    line-height: 20px;
    text-decoration-line: line-through;
  }

  &-price {
    color: #12A3FC;
    text-align: right;
    font-family: Inter;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-diffprice {
    color: var(--primitives-yellow-500, #FC9D12);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  /* 150% */
  &-link {
    color: var(--colors-text-text-brand, #12A3FC);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
