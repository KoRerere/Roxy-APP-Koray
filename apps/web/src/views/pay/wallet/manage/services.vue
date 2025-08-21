<script setup lang="tsx">
import AutoModal from '/@/views/pay/wallet/manage/components/auto-modal.vue';
import currency from 'currency.js'
import { format } from 'date-fns'
import { $t } from '/@/locales';
import { API } from '/@/api';
import { strConcat } from '/@/utils';
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user';
import { PayIdentity, SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay';
import { emitter } from '/@/utils/eventBus';
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useProxy } from '/@/views/agent/hooks'
import { ProxyExpireStatus } from '/@/enums/proxy';
import PrimeTips from '/@/views/pay/wallet/manage/components/prime-tips.vue';

const router = useRouter()
const [_, onlyErrorToast] = useResponseToast()
const { userPayInfo, identityInfo } = storeToRefs(useUserStore())
const [showModal] = RxUseDialog()
const { buyProxy } = useProxy()

const nextBillText = ref()
const isFree = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Free)
const isTrial = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Trial)
const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

const otherCards = computed(() => [
  {
    title: $t('代理'),
    used: userPayInfo.value.proxyExpireCount || userPayInfo.value.proxyUsingCount,
    text: userPayInfo.value.proxyExpireCount > 0 ? $t('即将过期') : $t('使用中'),
    addText: $t('购买'),
    textClass: userPayInfo.value.proxyExpireCount > 0 ? 'warning' : '',
    visibleJump: userPayInfo.value.proxyExpireCount > 0,
    addClick: () => {
      buyProxy(orderInfo => {
        router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo.orderNo } })
      })
    },
    jump: () => {
      router.push({ name: 'agent-list', query: { name: 'shop', expireStatus: ProxyExpireStatus.soon } })
    }
  },
  {
    title: $t('团队成员'),
    used: userPayInfo.value.useMemberCount,
    total: userPayInfo.value.maxMemberCount,
    text: $t('已使用'),
    addText: $t('新增'),
    addClick: () => onExpand('staff')
  },
  {
    title: $t('工作空间'),
    used: userPayInfo.value.useWorkspaceCount,
    total: userPayInfo.value.maxWorkspaceCount,
    text: $t('已使用'),
    addText: $t('新增'),
    addClick: () => onExpand('workspace')
  }
])
const planActions = computed(() => [
  {
    label: $t('启用自动续订'),
    visible: !isFree.value && !isTrial.value && !isExpired.value && !userPayInfo.value.isAuto,
    class: 'mx-auto ml-0',
    command: enableAutoRenew
  },
  {
    label: $t('购买套餐'),
    visible: isFree.value || isTrial.value || isExpired.value,
    command: () => {
      router.push({ name: 'subscribe-plan' })
    }
  },
  {
    label: $t('更改套餐'),
    visible: !isFree.value && !isTrial.value && !isExpired.value,
    props: {
      disabled: userPayInfo.value.autoRenewDowngrade
    },
    command: () => {
      router.push({ name: 'upgrade-plan' })
    }
  },
  {
    label: $t('续费'),
    visible: (!isFree.value && !isTrial.value && !userPayInfo.value.isAuto) || (isExpired.value && userPayInfo.value.isAuto),
    command: () => {
      if (userPayInfo.value.isAuto) {
        router.replace({ name: 'wallet', query: { name: 'billing' } })
        return
      }

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
    command: enableAutoRenew
  }
].filter(item => item.visible !== false))
const dailyCount = computed(() => {
  const profileCount = currency(userPayInfo.value.maxWindowCount, { symbol: '', precision: 0 })
  return {
    create: profileCount.multiply(30).format(),
    open: profileCount.multiply(100).format(),
  }
})
const planTextColor = computed(() => {
  return [SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value?.subLevel as SubLevelEnum)
    ? '#90AFC2'
    : 'linear-gradient(90deg, #12A3FC 0%, #DB54F9 100%)'
})
const identityMap = {
  [PayIdentity.old]: {
    gradient: ['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)'],
    color: 'var(--colors-text-text-primary)',
    extendBgColor: 'linear-gradient(270deg, var(--pattern-wallet-founding-bg-tint) 0%, var(--pattern-wallet-founding-bg-shade) 100%)',
  },
  [PayIdentity.invited]: {
    gradient: ['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)'],
    color: '#FFFFFF',
    extendBgColor: 'linear-gradient(270deg, var(--pattern-wallet-vip-bg-tint, #FFF) 0%, var(--pattern-wallet-vip-bg-shade, #A7AFD2) 100%)',
  },
  [PayIdentity.agent]: {
    gradient: ['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)'],
    color: '#FFFFFF',
    extendBgColor: '#FFFFFF',
  },
  [PayIdentity.new]: {
    gradient: ['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)'],
    color: '#FFFFFF',
    extendBgColor: '#FFFFFF',
  },
}

const identity = computed(() => {
  return {
    ...identityInfo.value,
    ...identityMap[userPayInfo.value.identity as keyof typeof identityMap],
  }
})
const grayGradient = ['var(--colors-border-border-subtle)', 'var(--colors-border-border-subtle)', 'var(--colors-border-border-subtle)']

onBeforeMount(() => {
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

function enableAutoRenew() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <AutoModal onClose={
        (needUpdate) => {
          if (needUpdate) {
            emitter.emit('updateAutoRenewList')
          }
          hideModal()
        }
      } />,
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
  <div class="flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <div class="title">{{ $t('服务') }}</div>
      <PrimeTips></PrimeTips>
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2.5">
        <AnimationBorder :border-width="(isFree || isExpired) ? 1 : 2" :animation-duration="12" class="rounded-xl" :gradient="(isFree || isExpired) ? grayGradient : identity.gradient">
          <div class="rounded overflow-hidden">
            <div class="relative flex flex-col justify-between overflow-hidden pa-4 h-55 rounded-xl overflow-hidden plan">
              <div class="flex justify-between items-center">
                <div class="plan-title">{{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}</div>
                <template v-if="userPayInfo?.subEndDate">
                  <div v-if="userPayInfo.isAuto" class="flex items-center gap-1 plan-expired">
                    <span>{{ $t('下次扣费: {value}', { value: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</span>
                    <SvgIcon v-if="nextBillText" v-tooltip="{ value: nextBillText, showDelay: 300, pt: { root: '!max-w-60' } }" size="14" name="base/rx_ic_info" color="#FC9D12"></SvgIcon>
                  </div>
                  <div v-else class="plan-expired">{{ $t('到期时间: {value}', {
                    value: format(userPayInfo.subEndDate, 'yyyy/MM/dd')
                  }) }}</div>
                </template>
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="plan-value">{{ $t('{count} 窗口', {
                  count: currency(userPayInfo?.maxWindowCount, { symbol: '', precision: 0 }).format()
                }) }}</div>
                <div class="plan-desc">{{ $t('每日可创建数: {create}; 每日可打开数: {open}', { create: dailyCount.create, open: dailyCount.open }) }}</div>
              </div>
              <div class="flex justify-between items-center gap-2.5">
                <div v-if="userPayInfo.isAuto" class="auto">{{ $t('自动续订') }}</div>
                <div class="flex-1 flex justify-end items-center gap-2.5">
                  <RxButton v-for="item in planActions" :key="item.label" v-bind="item.props" :class="item.class" outlined severity="secondary" :label="item.label" size="md" @click="item.command">
                  </RxButton>
                </div>
              </div>
            </div>
          </div>
        </AnimationBorder>
        <div v-if="identity.icon || userPayInfo.discount" class="flex items-center px-4 gap-3">
          <div v-if="identity.icon" class="flex items-center gap-0.5">
            <SvgIcon :name="(identity.icon as any)"></SvgIcon>
            <div class="identity-label" :style="{ color: identity.color }">{{ identity.text }}</div>
          </div>
          <i18n-t v-if="userPayInfo.discount" class="identity-value" tag="div" scope="global" :keypath="$t('永久享受 {discount} 订阅折扣', { discount: '{discount}' })">
            <template #discount>
              <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.discount }) }}</span>
            </template>
          </i18n-t>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="h-26 flex flex-col justify-between flex-1 pa-4 rounded-xl others" v-for="item in otherCards">
          <div class="flex justify-between items-center">
            <span class="others-title">{{ item.title }}</span>
            <span class="cursor-pointer others-add" @click="item.addClick">{{ strConcat('+ ', item.addText) }}</span>
          </div>
          <div class="flex items-baseline">
            <span class="others-used" :class="item.textClass">{{ item.used }}</span>
            <span class="others-total">{{ strConcat('/', item.total?.toString()) }}</span>
            <span class="ml-1.5 others-text">{{ item.text }}</span>
            <div v-if="item.visibleJump && item.jump" class="flex-1 flex justify-end">
              <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_arrow_right_2" @click="item.jump"></RxButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.plan {
  z-index: 1;

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--colors-background-bg-overlay) url('/images/payments/ripple_light.svg') no-repeat 118% -174px/380px 380px;
    z-index: -1;
  }

  &-title {
    font-family: "DingTalk JinBuTi";
    font-size: 20px;
    line-height: normal;
    background: v-bind(planTextColor);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-desc {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;
  }

  &-expired {
    color: var(--colors-text-text-secondary, #B2B6B8);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: normal;
  }

  &-value {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: "DingTalk JinBuTi", Inter, sans-serif;
    font-size: 32px;
    line-height: normal;
  }

  &-detail {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
  }
}

[data-theme="dark"] {
  .plan::after {
    background-image: url('/images/payments/ripple_dark.svg');
  }
}

.auto {
  color: var(--colors-text-text-primary);
  font-family: "DingTalk JinBuTi", Inter, sans-serif;
  font-size: 14px;
  line-height: 20px;
}

.identity {
  &-label {
    color: var(--colors-text-text-primary);
    font-family: "DingTalk JinBuTi";
    font-size: 12px;
    line-height: 16px;
  }

  &-value {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 16px;
  }

  &-discount {
    color: var(--colors-text-text-warning);
  }
}

.others {
  border: 0.5px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-overlay);

  &-title {
    color: var(--colors-text-text-primary);
    font-family: Archivo;
    font-size: 16px;
    font-weight: 700;
  }

  &-add {
    color: var(--colors-text-text-link);
    font-family: Inter;
    font-size: 12px;
  }

  &-used {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 32px;
    font-weight: 700;

    &.warning {
      color: var(--colors-text-text-warning);
    }
  }

  &-total {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 20px;
    font-weight: 700;
  }

  &-text {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
  }
}
</style>
