<script setup lang="tsx">
import currency from 'currency.js';
import { addDays, format } from "date-fns";
import { useDialog } from 'primevue/usedialog'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { RxAlert } from "/@/components/rx-alert";
import Duration from '/@/views/pay/subscribe/components/duration.vue'
import AdvancedFeat from '/@/views/pay/subscribe/components/advanced-feat.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import SubscribeModal from './components/subscribe-modal.vue'
import Profile from '/@/views/pay/subscribe/components/profile.vue'
import { tierCalculate, discountCalculate } from './util'
import { OrderType, PayWay, PurchaseType, PaySubOrderType } from '/@/enums/pay'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useUserStore } from '/@/stores/user';
import { type Plan } from './type'
import { useSimpleLocale } from '/@/stores/locale';

const { getOfficialWebsite } = useSimpleLocale()
const dialog = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing, planSuccess } = usePay()
const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())

const dataList = ref<Plan[]>()

const selectedPlan = ref()
const selectedCount = ref()
const selectedDuration = ref()

const subscribeOriginalPrice = computed(() => tierCalculate(dataList.value!, selectedCount.value).value)

const showAlert = computed(() => selectedCount.value && currency(selectedCount.value).add(userPayInfo.value.freeWindowCount).value < userPayInfo.value.useWindowCount)

const finalDiscount = computed(() => discountCalculate([userPayInfo.value?.discount, selectedDuration.value?.discount]))

const finalAmount = computed(() => currency(subscribeOriginalPrice.value).multiply(selectedDuration.value?.month ?? 1).multiply(finalDiscount.value).value)

const details = computed(() => {

  const profileCount = currency(selectedCount.value, { precision: 0, symbol: '' })
  const totalAmount = currency(subscribeOriginalPrice.value).multiply(finalDiscount.value).value
  const discountAmount = currency(subscribeOriginalPrice.value).subtract(totalAmount).value

  return [
    {
      title: $t('套餐详情'),
      items: [
        {
          label: $t('窗口数量'),
          value: profileCount.format()
        },
        {
          label: $t('每日可创建数'),
          value: profileCount.multiply(30).format()
        },
        {
          label: $t('每日可打开数'),
          value: profileCount.multiply(100).format()
        },
        {
          label: $t('订阅时长'),
          value: selectedDuration.value?.title
        },
        {
          label: $t('到期时间'),
          value: format(addDays(Date.now(), selectedDuration.value?.day ?? 30), 'yyyy/MM/dd')
        },
      ]
    },
    {
      items: [
        {
          label: $t('专属折扣'),
          value: `-${userPayInfo.value?.discount}%`,
          class: '!color-[#FC9D12]',
          visible: !!userPayInfo.value?.discount
        },
        {
          label: $t('订阅折扣'),
          value: `-${selectedDuration.value?.discount}%`,
          class: '!color-[#FC9D12]',
          visible: !!selectedDuration.value?.discount
        },
      ].filter(item => item.visible !== false)
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(subscribeOriginalPrice.value).format(),
          visible: totalAmount !== subscribeOriginalPrice.value,
          slot: 'oldprice'
        },
        {
          label: $t('实际价格'),
          value: currency(totalAmount).format(),
          diffValue: discountAmount,
          slot: 'price'
        },
      ].filter(item => item.visible !== false)
    }
  ].filter(item => item.items.length)
})

onBeforeMount(() => {
  getTierPricingList()
})

async function getTierPricingList() {
  try {
    const { code, data, msg } = await API.pay.userGetWindowPricingRulesListList()
    if (code === 0) {
      dataList.value = data.rows
      selectedPlan.value = dataList.value[0]
      selectedCount.value = selectedPlan.value.maxWindows
    } else {
      throw new Error(msg)
    }
  } catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

async function onSubscribe() {
  const { code, data, msg } = await API.pay.userGetSupportPayTypeList({ amount: String(finalAmount.value) })
  onlyErrorToast(code, msg)
  if (code !== 0) return

  dialog.open(SubscribeModal, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0'
      }
    },
    data: {
      props: {
        subscribeDuration: toRaw(selectedDuration.value),
        subscribeOriginalPrice: toRaw(subscribeOriginalPrice.value),
        supportPayWay: Object.values(data).flat()
      },
      onConfirm: async (params: { isAuto: boolean, payType: PayWay }) => {
        const { code, data, msg } = await API.pay.userPaySettlementCreate({
          purchaseMember: { profile: selectedCount.value },
          purchaseType: PurchaseType.Profile,
          subLevel: selectedPlan.value.subLevel,
          subscriptionMonths: selectedDuration.value.month,
          subOrderType: PaySubOrderType.Purchase,
          ...params,
          orderType: OrderType.Subscribe,
        })
        onlyErrorToast(code, msg)
        if (code === 0) {
          (params.payType === PayWay.Balance ? planSuccess() : openProcessing({ payType: params.payType, ...data }, OrderType.Subscribe))
            .then(() => {
              router.push({ name: 'browser-list' })
            })
        }
      },
    },
  })
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader class="border-0 border-b-0.5 border-solid border-[#C7CDD1]" :title="$route.meta.title" />
    <div class="rx-container">
      <div class="flex flex-1 items-start gap-15 px-19.5 pt-6 overflow-y-auto">
        <div class="flex-1">
          <Profile class="w-full" v-if="dataList?.length" :list="dataList" v-model:plan="selectedPlan"
            v-model:count="selectedCount"></Profile>
          <div class="py-8 border-0 border-t border-dashed border-[#C7CDD1]">
            <div class="title">{{ $t('订阅时长') }}</div>
            <Duration class="mt-4" v-model="selectedDuration" :price="subscribeOriginalPrice"></Duration>
          </div>
          <AdvancedFeat :plan="selectedPlan" class="py-8 border-0 border-t border-dashed border-[#C7CDD1]">
          </AdvancedFeat>
        </div>
        <div class="flex flex-col gap-3 w-88">
          <RxAlert v-if="showAlert" class="!w-full" type="warn" :content="$t('购买窗口数量少于当前窗口数')" :closable="false">
          </RxAlert>
          <Detail :list="details">
            <template #oldprice="{ item }">
              <div class="flex justify-between">
                <div class="details-label">{{ item.label }}</div>
                <div class="details-oldprice">{{ $t('{value}/月', { value: item.value }) }}</div>
              </div>
            </template>
            <template #price="{ item }">
              <div class="flex justify-between items-center">
                <div class="details-label">{{ item.label }}</div>
                <div>
                  <div class="details-price">
                    <span>{{ item.value }}</span>
                    <span class="details-price-unit">{{ $t('/月') }}</span>
                  </div>
                  <div v-if="item.diffValue > 0" class="details-diffprice">{{ $t('节省 {value}/月', {
                    value:
                      currency(item.diffValue).format()
                  }) }}</div>
                </div>
              </div>
            </template>
            <template #after>
              <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
                <RxButton size="lg" :label="$t('立即支付')" @click="onSubscribe"></RxButton>
                <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })"
                  scope="global">
                  <template #terms>
                    <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议')
                    }}</a>
                  </template>
                </i18n-t>
              </div>
            </template>
          </Detail>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  line-height: normal;
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
    color: var(--colors-text-text-tertiary, #8A9093);
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

    &-unit {
      font-size: 16px;
    }
  }

  &-diffprice {
    color: var(--Color-yellow-300, #FC9D12);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-tertiary, #8A9093);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  /* 150% */
  &-link {
    color: var(--Colors-Text-text-brand, #12A3FC);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
