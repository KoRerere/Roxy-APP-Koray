<script setup lang="tsx">
import AutoModal from '/@/views/pay/wallet/manage/components/auto-modal.vue'
import Identity from '/@/views/pay/wallet/manage/identity.vue'
import currency from 'currency.js'
import { format } from 'date-fns'

import { API } from '/@/api'
import { strConcat } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { PayIdentity, SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useProxy } from '/@/views/agent/hooks'
import { ProxyExpireStatus } from '/@/enums/proxy'
import PrimeTips from '/@/views/pay/wallet/manage/components/prime-tips.vue'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { BUSINESS_CODE } from '/@/constants/business-code'
import { useBuyPoints } from '/@/views/mcp/components/buyPointes'

const router = useRouter()
const [showModal] = RxUseDialog()
const [_, onlyErrorToast] = useResponseToast()
const { isOwner } = storeToRefs(useRoleStore())
const { userPayInfo, identityInfo } = storeToRefs(useUserStore())
const { buyProxy } = useProxy()
const { handleBusinessCode } = useHandleBusinessCode()
const { buyPoints } = useBuyPoints()

const nextBillText = ref()
const isFree = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Free)
const isTrial = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Trial)
const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)
const isPremiumPartner = computed(() => identityInfo.value.identity === PayIdentity.agent && isOwner.value)
const usedWindowCount = computed(() => userPayInfo.value.useWindowCount)
const otherCards = computed(() => [
  {
    title: $t('代理 IP'),
    used: userPayInfo.value.proxyExpireCount || userPayInfo.value.proxyUsingCount,
    text: $t('IPs'),
    extraText: userPayInfo.value.proxyExpireCount > 0 ? $t('即将过期') : '',
    addText: $t('购买'),
    extraTextClass: userPayInfo.value.proxyExpireCount > 0 ? 'warning' : '',
    textClass: userPayInfo.value.proxyExpireCount > 0 ? 'warning' : '',
    visibleJump: userPayInfo.value.proxyExpireCount > 0,
    addClick: () => {
      buyProxy().then((orderInfo) => {
        router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
      })
    },
    jump: () => {
      router.push({ name: 'agent-list', query: { name: 'shop', expireStatus: ProxyExpireStatus.soon } })
    },
  },
  {
    title: $t('团队成员'),
    used: userPayInfo.value.useMemberCount,
    total: userPayInfo.value.maxMemberCount,
    text: $t('已使用'),
    addText: $t('新增'),
    addClick: () => onExpand('staff'),
  },
  {
    title: $t('团队'),
    used: userPayInfo.value.useWorkspaceCount,
    total: userPayInfo.value.maxWorkspaceCount,
    text: $t('已使用'),
    addText: $t('新增'),
    addClick: () => onExpand('workspace'),
  },
  {
    title: $t('AI Agent 积分'),
    used: userPayInfo.value.points,
    text: $t('积分'),
    addText: $t('购买'),
    addClick: buyPoints,
  },
])

const planActions = computed(() => {
  return [
    {
      label: $t('启用自动续订'),
      visible: !isFree.value && !isTrial.value && !isExpired.value && !userPayInfo.value.isAuto,
      class: 'mx-auto ml-0',
      command: enableAutoRenew,
    },
    {
      label: $t('购买套餐'),
      visible: isFree.value || isTrial.value || isExpired.value,
      command: () => {
        router.push({ name: 'subscribe-plan' })
      },
    },
    {
      label: $t('更改套餐'),
      visible: !isFree.value && !isTrial.value && !isExpired.value,
      props: {
        disabled: userPayInfo.value.autoRenewDowngrade,
      },
      command: () => {
        router.push({ name: 'upgrade-plan' })
      },
    },
    {
      label: $t('续费'),
      visible: (!isFree.value && !isTrial.value && !userPayInfo.value.isAuto) || (isExpired.value && userPayInfo.value.isAuto),
      severity: 'info',
      outlined: false,
      class: 'renew-btn',
      command: () => {
        if (userPayInfo.value.isAuto) {
          router.replace({ name: 'wallet', query: { name: 'billing' } })
          return
        }

        emitter.emit('showRenewalDialog', {
          paySuccess: () => {
            emitter.emit('updateBillList')
          },
        })
      },
    },
    {
      label: $t('管理订阅'),
      visible: !!userPayInfo.value.isAuto,
      command: enableAutoRenew,
    },
  ].filter(item => item.visible !== false && !isPremiumPartner.value)// 高级合作伙伴享受特殊订阅
})

const planTextColor = computed(() => {
  return [SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value?.subLevel as SubLevelEnum)
    ? '#90AFC2'
    : 'linear-gradient(90deg, #12A3FC 0%, #DB54F9 100%)'
})
const freeOrExpired = computed(() => {
  // return true
  return isFree.value || isExpired.value
})

const animationGradient = computed(() => {
  const freeBg = 'var(--pattern-wallet-free-bg)'
  return (freeOrExpired.value)
    // no linear-gradient for free or expired
    ? [freeBg, freeBg, freeBg]
    : ['#2CB8FE 14.71%', '#EC51F7 111.53%', '#EC51F7 111.53%']
})

const subscribeInfo = computed(() => {
  const profileCount = currency(userPayInfo.value.maxWindowCount, { symbol: '', precision: 0 })
  const create = isPremiumPartner.value ? $t('无限用量') : profileCount.multiply(30).format()
  const open = isPremiumPartner.value ? $t('无限用量') : profileCount.multiply(100).format()

  return {
    expireTime: isPremiumPartner.value ? $t('永久免费') : $t('到期时间: {value}', { value: format(userPayInfo.value.subEndDate, 'yyyy/MM/dd') }),
    profileCount: isPremiumPartner.value ? $t('无限窗口') : $t('{count} 窗口', { count: profileCount.format() }),
    // number type
    profileNumber: isPremiumPartner.value ? Infinity : profileCount.value,
    profileCreate: create,
    profileOpen: open,
  }
})

onBeforeMount(() => {
  getNextBillingDate()
})

async function getNextBillingDate() {
  if (!userPayInfo.value.autoRenewDowngrade)
    return

  const { code, data, msg } = await API.pay.userGetDowngradeSubscriptionInfoList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  nextBillText.value = $t('下个计费周期，套餐已更改：\n窗口数量：{count}\n计费金额：{amount}\n账单日期：{date}', {
    count: data.windowCount,
    amount: currency(data.amount).format(),
    date: format(data.windowStartDate, 'yyyy/MM/dd'),
  })
}

function enableAutoRenew() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <AutoModal onClose={
          (needUpdate) => {
            if (needUpdate) {
              emitter.emit('updateAutoRenewList')
            }
            hideModal()
          }
        }
        />
      ),
    },
  })
}

function onExpand(defaultType?: 'workspace' | 'staff') {
  emitter.emit('showExpandDialog', {
    defaultType,
    paySuccess: () => {
      emitter.emit('updateBillList')
    },
  })
}

/**
 * 始终展示付费墙
 */
async function openPrimeDialog() {
  return handleBusinessCode(BUSINESS_CODE.WINDOW_MAX_LIMIT)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex justify-between items-center gap-8">
      <div class="title">
        {{ $t('服务') }}
      </div>
      <Identity />
      <!-- <PrimeTips /> -->
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2.5">
        <AnimationBorder :animation="false" :deg="110" :border-width="2" :animation-duration="12" class="rounded-xl" :gradient="animationGradient">
          <div class="rounded overflow-hidden">
            <div class="relative flex flex-col justify-between overflow-hidden pa-4 h-55 rounded-xl overflow-hidden plan">
              <div class="flex justify-between items-center">
                <div class="plan-title">
                  {{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}
                </div>
                <template v-if="userPayInfo?.subEndDate">
                  <div v-if="userPayInfo.isAuto" class="flex items-center gap-1 plan-expired">
                    <span>{{ $t('下次扣费: {value}', { value: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</span>
                    <SvgIcon v-if="nextBillText" v-tooltip="{ value: nextBillText, showDelay: 300, pt: { root: '!max-w-60' } }" size="14" name="base/rx_ic_info" color="#FC9D12" />
                  </div>
                  <div v-else class="expire-time text-[14px] font-normal text-[var(--colors-text-text-secondary)]">
                    {{ subscribeInfo.expireTime }}
                  </div>
                </template>
              </div>
              <div class="flex flex-col gap-1.5">
                <!-- keey text white space -->
                <div class="flex flex-row plan-value whitespace-pre">
                  <i18n-t :keypath="$t('{used} / {total}', { used: '{used}', total: '{total}' })">
                    <template #used>
                      <span class="used-count text-[32px] "
                            :class="usedWindowCount === 0 ? '' : usedWindowCount <= subscribeInfo.profileNumber ? 'text-[var(--colors-text-text-brand)]' : 'text-[var(--colors-text-text-error)]'"
                      >
                        {{ usedWindowCount }}
                      </span>
                    </template>
                    <template #total>
                      <span class="total-count">
                        {{ subscribeInfo.profileCount }}
                      </span>
                    </template>
                  </i18n-t>
                </div>
                <div class="plan-desc">
                  <!-- {{ subscribeInfo.dailyLimit }} -->
                  <i18n-t :keypath="$t('每日可创建数: {create} {line} 每日可打开数: {open}', { create: '{create}', open: '{open}', line: '{line}' })">
                    <template #line>
                      <span class="line mx-[16px] inline-block w-[1px] h-[16px]" />
                    </template>
                    <template #create>
                      <span class="create-count">
                        {{ subscribeInfo.profileCreate }}
                      </span>
                    </template>
                    <template #open>
                      <span class="open-count">
                        {{ subscribeInfo.profileOpen }}
                      </span>
                    </template>
                  </i18n-t>
                </div>
              </div>
              <div class="flex justify-between items-center gap-2.5">
                <div v-if="userPayInfo.isAuto" class="auto">
                  {{ $t('自动续订') }}
                </div>
                <div class="flex-1 flex justify-end items-center gap-2.5">
                  <RxButton v-for="item in planActions" :key="item.label" v-bind="item.props" :class="item.class" :outlined="item.outlined !== false" :severity="item.severity || 'secondary'"
                            :label="item.label" size="md" @click="item.command"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-if="freeOrExpired" class="px-3 py-1 gap-[4px] flex flex-row text-[12px] text-[var(--colors-text-text-tertiary)]">
            <i18n-t tag="div" scope="global" :keypath="$t('升级即可获取更多高级功能：窗口模板，窗口转移等等！{detail}', { detail: '{detail}' })">
              <template #detail>
                <span class="text-[var(--colors-text-text-link)] cursor-pointer select-none" @click="openPrimeDialog">{{ $t('查看详情') }}</span>
              </template>
            </i18n-t>
          </div>
          <div v-else class="px-3 py-1 gap-[2px] flex align-center items-center flex-row text-white text-[12px] font-medium">
            <SvgIcon size="14" name="base/rx_ic_user_paid" />
            {{ $t('窗口模板、窗口转移、窗口同步以及多项核心功能均已启用。') }}
            <PrimeTips :show-text="false" />
          </div>
        </AnimationBorder>
        <!-- <Identity class="px-4" /> -->
      </div>
      <div class="title">
        {{ $t('我的资源') }}
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="item in otherCards" :key="item.title" class="h-[105px] flex flex-col justify-between flex-1 pa-4 rounded-xl others">
          <div class="flex justify-between items-center">
            <span class="others-title">{{ item.title }}</span>
            <RxButton class="card-add-btn" variant="outlined" size="xxs" :label="strConcat('+ ', item.addText)" @click="item.addClick" />
          </div>
          <div class="flex items-baseline">
            <span class="others-used" :class="item.textClass">{{ item.used }}</span>
            <span class="others-total">{{ strConcat('/', item.total?.toString()) }}</span>
            <span class="ml-1.5 others-text">{{ item.text }}</span>
            <span class="ml-1.5 others-text" :class="item.extraTextClass">{{ item.extraText }}</span>
            <div v-if="item.visibleJump && item.jump" class="flex-1 flex justify-end">
              <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_arrow_right_2" @click="item.jump" />
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

.card-add-btn {
  --button-outlined-info-border-color: #11a3fd;
  --spacing-md: 8px;
  color: #11a3fd;
}

.renew-btn {
  --button-info-border-color: #0282d4;
  border-radius: var(--radius-lg, 8px);
  // border: 1px solid var(--component-button-primary-border, #0282D4);
  background: var(--component-button-primary-bg, #11a3fd);

  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}

.plan {
  z-index: 1;
  border-radius: 10px;

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--colors-background-bg-overlay) url('/images/payments/ripple_light.svg') no-repeat 118% -174px/380px
      380px;
    z-index: -1;
  }

  &-title {
    font-family: 'DingTalk JinBuTi';
    font-size: 20px;
    line-height: normal;
    background: v-bind(planTextColor);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-desc {
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 21px;
    display: flex;
    align-items: center;
  }

  &-expired {
    font-family: 'JetBrains Mono';
  }

  &-value {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: 'DingTalk JinBuTi', Inter, sans-serif;
    font-size: 32px;
    line-height: normal;
  }

  &-detail {
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
  }
}

[data-theme='dark'] {
  .plan::after {
    background-image: url('/images/payments/ripple_dark.svg');
  }
}

.auto {
  color: var(--colors-text-text-primary);
  font-family: 'DingTalk JinBuTi', Inter, sans-serif;
  font-size: 14px;
  line-height: 20px;

  // deep override
  :deep(.p-button-label) {
    font-size: 14px;
  }
}

.others {
  border-radius: 12px;
  border: 0.5px solid var(--colors-border-border-base, #afb7bb);
  background: var(--colors-background-bg-overlay, #fff);

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

    &.warning {
      color: var(--colors-text-text-warning);
    }
  }
}

.line {
  background: var(--component-dropdown-divider, #e2e9ee);
}
</style>
