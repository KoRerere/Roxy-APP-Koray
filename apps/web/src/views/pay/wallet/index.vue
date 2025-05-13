<script setup lang="tsx">
import ChargeModal from '/@/views/pay/wallet/components/charge-modal.vue';
import ManageModal from '/@/views/pay/wallet/components/manage-modal.vue'
import BillingList from '/@/views/pay/wallet/billing';
import currency from 'currency.js'
import { format } from 'date-fns'
import { $t } from '/@/locales';
import { API } from '/@/api';
import { strConcat } from '/@/utils';
import { useDialog } from 'primevue/usedialog'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user';
import { OrderType, PayWay, SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay';
import { emitter } from '/@/utils/eventBus';
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'

const router = useRouter()
const dialog = useDialog()
const { openProcessing } = usePay()
const [_, onlyErrorToast] = useResponseToast()
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const [showModal] = RxUseDialog()

const nextBillText = ref()

const other = computed(() => {
  return [
    {
      type: 'staff',
      title: $t('团队成员'),
      used: userPayInfo.value?.useMemberCount,
      total: userPayInfo.value?.maxMemberCount,
    },
    {
      type: 'workspace',
      title: $t('工作空间'),
      used: userPayInfo.value?.useWorkspaceCount,
      total: userPayInfo.value?.maxWorkspaceCount,
    }
  ]
})
const isFree = computed(() => [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.value.subLevel as SubLevelEnum))
const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)
const planActions = computed(() => [
  {
    label: $t('购买套餐'),
    visible: isFree.value || isExpired.value,
    command: () => {
      router.push({ name: 'subscribe-plan' })
    }
  },
  {
    label: $t('更改套餐'),
    visible: !isFree.value && !isExpired.value,
    props: {
      disabled: userPayInfo.value.autoRenewDowngrade
    },
    command: () => {
      router.push({ name: 'upgrade-plan' })
    }
  },
  {
    label: $t('续费'),
    visible: !isFree.value && !userPayInfo.value.isAuto,
    command: () => {
      emitter.emit('showRenewalDialog', {
        paySuccess: () => {
          emitter.emit('updateBillList')
        }
      })
    }
  },
  {
    label: $t('管理订阅'),
    visible: !!userPayInfo.value.isAuto,
    command: () => {
      showModal({
        showHeader: false,
        modal: true,
        blockScroll: true,
        innerDialog: true,
        pt: {
          content: '!pa-0'
        },
        slots: {
          container: ({ hideModal }) => <ManageModal onClose={hideModal} />,
        },
      })
    }
  }
].filter(item => item.visible !== false))
const infoValue = computed(() => {
  const profileCount = currency(userPayInfo.value.maxWindowCount, { symbol: '', precision: 0 })
  return $t('每日可创建数: {num1}\n每日可打开数: {num2}', { num1: profileCount.multiply(30).format(), num2: profileCount.multiply(100).format() })
})
const planBgColor = computed(() => {
  return [SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value?.subLevel as SubLevelEnum)
    ? '#90AFC2'
    : 'linear-gradient(90deg, #12A3FC 0%, #DB54F9 100%)'
})

onBeforeMount(() => {
  getUserPayInfo()
  getNextBillingDate()
})

async function getNextBillingDate() {
  if (!userPayInfo.value.autoRenewDowngrade) return
  const { code, data, msg } = await API.pay.userGetDowngradeSubscriptionInfoList()
  onlyErrorToast(code, msg)
  if (code !== 0) return
  nextBillText.value = $t('下个计费周期，套餐已更改：\n窗口数量：{count}\n计费金额：{amount}\n账单日期：{date}', {
    count: data.windowCount,
    amount: currency(data.amount).format(),
    date: format(data.windowStartDate, 'yyyy/MM/dd')
  })
}

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
          openProcessing(data, OrderType.Recharge)
            .finally(() => {
              emitter.emit('updateBillList')
            })
        }
      },
    },
  })
}

function onExpand(defaultType?: 'workspace' | 'staff') {
  emitter.emit('showExpandDialog', {
    defaultType,
    paySuccess: () => {
      emitter.emit('updateBillList')
    }
  })
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader class="border-0 border-b-0.5 border-solid border-[#C7CDD1]" :title="($route.meta.title as string)">
    </ViewsHeader>
    <div class="rx-container ml-0 h-auto">
      <div class="flex gap-2 px-6 pt-6">
        <div class="relative flex flex-col justify-between pa-4 w-110 h-63 rounded-xl border-1 border-solid border-[#C7CDD1] overflow-hidden balance">
          <div class="balance-title">{{ $t('Roxy 钱包余额') }}</div>
          <div>
            <div class="balance-balance">{{ currency(userPayInfo.balance).format() }}</div>
            <i18n-t class="mt-1.5 balance-desc" tag="div" :keypath="$t('参与 {invite} 获得奖励', { invite: '{invite}' })" scope="global">
              <template #invite>
                <span class="cursor-pointer balance-desc-link" @click="router.push({ name: 'referral-program' })">{{
                  $t('推广计划') }}</span>
              </template>
            </i18n-t>
          </div>
          <div class="flex justify-end">
            <RxButton :label="$t('充值')" size="md" @click="onCharge"></RxButton>
          </div>
        </div>
        <div class="flex flex-col justify-between pa-4 w-110 h-63 rounded-xl border-1 border-solid border-[#C7CDD1] overflow-hidden plan">
          <div class="flex justify-between items-center">
            <div class="plan-title">{{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}</div>
            <template v-if="userPayInfo?.subEndDate">
              <div v-if="userPayInfo.isAuto" class="flex items-center gap-1 plan-expired">
                <span>{{ $t('下次扣费: {value}', { value: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</span>
                <SvgIcon v-if="nextBillText" v-tooltip="{ value: nextBillText, showDelay: 300, pt: { root: '!max-w-60' } }" size="14" name="base/rx_ic_info" color="#FC9D12"></SvgIcon>
              </div>
              <div v-else class="plan-expired">{{ $t('到期时间: {value}', {
                value: format(userPayInfo.subEndDate,
                  'yyyy/MM/dd')
              }) }}</div>
            </template>
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="plan-value">{{ $t('{count} 窗口', {
              count: currency(userPayInfo?.maxWindowCount, {
                symbol: '',
                precision:
                  0
              }).format()
            }) }}</div>
            <div class="balance-desc" v-if="!!userPayInfo.isAuto">{{ $t('每月 {price} (自动续费)', {
              price:
                currency(userPayInfo.realAmount).format()
            }) }}</div>
          </div>
          <div class="flex justify-end items-center gap-2.5">
            <div class="flex-1">
              <span v-tooltip.top="{ value: infoValue, showDelay: 300 }" class="inline-flex items-center gap-1.5 cursor-pointer plan-detail">
                <span>{{ $t('详情') }}</span>
                <SvgIcon size="14" name="base/rx_ic_info" color="#C7CDD1"></SvgIcon>
              </span>
            </div>
            <RxButton v-for="item in planActions" :key="item.label" v-bind="item.props" outlined severity="secondary" :label="item.label" size="md" @click="item.command"></RxButton>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex flex-col flex-1 justify-between pa-4 min-w-55 max-w-90 rounded-xl border-1 border-solid border-[#C7CDD1] other" v-for="item in other" :key="item.type">
            <div class="flex justify-between items-center gap-6">
              <span class="other-title">{{ item.title }}</span>
              <span class="cursor-pointer other-more" @click="onExpand(item.type as 'workspace' | 'staff')">{{ $t('新增') }}</span>
            </div>
            <div>
              <span class="other-used">{{ item.used }}</span>
              <span class="other-total">{{ strConcat('/', item.total?.toString()) }} </span>
              <span class="ml-2 other-text">{{ $t('已使用') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <BillingList class="flex flex-col flex-1 mt-9 overflow-hidden"></BillingList>
  </div>
</template>

<style scoped lang="scss">
.balance {
  z-index: 1;

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/images/payments/blob_blur.svg') no-repeat -300px -370px/960px 620px;
    z-index: -2;
  }

  &-title {
    color: #000;
    font-family: Archivo, Inter;
    font-size: 20px;
    font-weight: 700;
    line-height: normal;
  }

  &-balance {
    color: #000;
    font-family: Inter;
    font-size: 40px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;

    &::first-letter {
      font-size: 32px;
    }
  }

  &-desc {
    color: var(--Colors-Text-text-tertiary, #7C8387);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;

    &-link {
      color: var(--Color-blue-300, #12A3FC);
      text-decoration-line: underline;
      text-decoration-style: solid;
      text-decoration-skip-ink: auto;
      text-decoration-thickness: auto;
      text-underline-offset: auto;
      text-underline-position: from-font;
    }
  }
}

.plan {
  background: url('/images/payments/ripple.svg') no-repeat 86px -174px/380px 380px;

  &-title {
    font-family: "DingTalk JinBuTi";
    font-size: 20px;
    line-height: normal;
    background: v-bind(planBgColor);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-expired {
    color: var(--Colors-Text-text-secondary, #575D61);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: normal;
  }

  &-value {
    color: var(--Colors-Text-text-primary, #171C1F);
    font-family: "DingTalk JinBuTi", Inter, sans-serif;
    font-size: 32px;
    line-height: normal;
  }

  &-detail {
    color: var(--Colors-Text-text-tertiary, #7C8387);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
  }
}

.other {
  &-title {
    color: #000;
    font-family: Archivo, Inter, sans-serif;
    font-size: 16px;
    font-weight: 700;
    line-height: normal;
  }

  &-more {
    color: var(--Color-blue-300, #12A3FC);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;
  }

  &-used {
    color: #000;
    font-family: Inter;
    font-size: 32px;
    font-weight: 700;
    line-height: normal;
  }

  &-total {
    color: #000;
    font-family: Inter;
    font-size: 20px;
    font-weight: 700;
    line-height: normal;
  }

  &-text {
    color: var(--Colors-Text-text-inactive, #A3A9AD);
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
  }
}
</style>
