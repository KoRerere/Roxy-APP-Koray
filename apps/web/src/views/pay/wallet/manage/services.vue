<script setup lang="tsx">
import PrimeTips from '/@/views/pay/wallet/manage/components/prime-tips.vue'
import ProfilesTips from '/@/views/pay/wallet/manage/components/profiles-tips.vue'
import AutoModal from '/@/views/pay/wallet/manage/components/auto-modal.vue'
// 身份折扣文案暂不对外展示
// import Identity from '/@/views/pay/wallet/manage/identity.vue'
import currency from 'currency.js'
import { format } from 'date-fns'

import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { BuyProxyListType, ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums'
import { PayIdentity, SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useProxy } from '/@/views/agent/hooks'
// import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
// import { BUSINESS_CODE } from '/@/constants/business-code'
import { useBuyPoints } from '/@/views/agent-console/components/buy-points/useBuyPoints'
import { isEmpty } from 'es-toolkit/compat'
import { useRouteContext } from '/@/composables/useRouteContext'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'
// import LifetimeProfileModal from '/@/views/pay/wallet/components/lifetime-profile-modal.vue'
import { percentOffToZhe } from '/@/views/agent/shop/utils/long-renew-first'
import userPaidIconUrl from '/@/assets/icons/base/rx_ic_user_paid.svg?url'

const router = useRouter()
const { isEcommerce } = useRouteContext()
const billingLabels = useBillingEntityLabels()
const [showModal] = RxUseDialog()
const [_, onlyErrorToast] = useResponseToast()
const { isOwner } = storeToRefs(useRoleStore())
const { userPayInfo, identityInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const { buyProxy, renewProxy, viewExpiresSoonProxy } = useProxy()
// const { handleBusinessCode } = useHandleBusinessCode()
const { buyPoints } = useBuyPoints()

const nextBillText = ref()
const isFree = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Free)
const isTrial = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Trial)
const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)
const isPremiumPartner = computed(() => identityInfo.value.identity === PayIdentity.agent && isOwner.value)
const usedWindowCount = computed(() => userPayInfo.value.useWindowCount)

/** 代理卡片：使用中数量 / 即将过期数量 / 长续首享入口 */
const proxyInfo = computed(() => {
  const { proxyExpireCount, proxyUsingCount, showProxyRenewMinDiscount, proxyRenewMinDiscount } = userPayInfo.value
  return {
    title: billingLabels.value.proxyEntity,
    usingCount: proxyUsingCount || 0,
    expireCount: proxyExpireCount || 0,
    // IP 数量单位：中文「个」，英文「IPs」
    unit: isEcommerce.value ? '' : $t('个'),
    // 账户级开关：有可享长续首享的可续费 IP 时由后端置 true
    showLongRenewBanner: !!showProxyRenewMinDiscount,
    // 中文展示折数，英/俄展示 % Off，缺省按 30% Off（7 折）
    longRenewZhe: percentOffToZhe(proxyRenewMinDiscount || 30),
    longRenewOff: proxyRenewMinDiscount || 30,
  }
})

/** 静态住宅 / 静态机房 使用中的已购 IP 数量 */
const proxyTypeCounts = ref<{ residential: number, datacenter: number } | null>(null)

/** 机房代理判定：providerType 形如 "DataCenter Proxies"，其余（ISP Proxies）视为静态住宅 */
function isDatacenterProvider(providerType?: string) {
  return /data\s*center|机房/i.test(providerType || '')
}

/**
 * 列表接口不支持按供应商类型筛选，这里拉取已购代理后在前端按 providerType 分组，
 * 只统计未过期且已开通完成的 IP，与「使用中」口径保持一致
 */
async function getProxyTypeCounts() {
  try {
    const { code, data } = await API.proxy.userGetProxyListMergedList({
      type: BuyProxyListType.List,
      proxyType: String(ProxyType.buy),
      page_index: '1',
      page_size: '999',
    })
    if (code !== 0) {
      throw new Error('fetch proxy list failed')
    }
    const rows = (data?.rows || []).filter(item =>
      item.proxyExpireStatus !== ProxyExpireStatus.expired
      && item.orderStatus === ProxyOrderStatus.done,
    )
    const datacenter = rows.filter(item => isDatacenterProvider(item.providerType)).length
    proxyTypeCounts.value = { residential: rows.length - datacenter, datacenter }
  }
  catch {
    // 拉取失败时回退为展示使用中总数
    proxyTypeCounts.value = null
  }
}

/** 代理数量栏：有分类数据时按静态住宅 / 静态机房展示，否则展示使用中总数 */
const proxyStats = computed(() => {
  // 即将到期一直展示，没有则为 0；大于 0 时标橙色，点击打开续费弹窗
  const expiring = {
    label: $t('即将到期'),
    value: proxyInfo.value.expireCount,
    warning: proxyInfo.value.expireCount > 0,
    onClick: proxyInfo.value.expireCount > 0 ? renewExpiresSoonProxy : undefined,
  }
  if (!proxyTypeCounts.value) {
    return [{ label: $t('使用中'), value: proxyInfo.value.usingCount }, expiring]
  }
  return [
    { label: $t('静态住宅代理 IP'), value: proxyTypeCounts.value.residential },
    { label: $t('静态机房代理 IP'), value: proxyTypeCounts.value.datacenter },
    expiring,
  ]
})

watch(() => [userPayInfo.value.proxyUsingCount, userPayInfo.value.proxyExpireCount], () => {
  if (!isEcommerce.value) {
    getProxyTypeCounts()
  }
}, { immediate: true })

/** 是否有已购代理 IP（使用中 / 即将到期 / 按类型统计任一大于 0） */
const hasPurchasedProxy = computed(() => {
  const { usingCount, expireCount } = proxyInfo.value
  const typed = proxyTypeCounts.value ? proxyTypeCounts.value.residential + proxyTypeCounts.value.datacenter : 0
  return usingCount + expireCount + typed > 0
})

function onBuyProxy() {
  buyProxy().then((orderInfo) => {
    router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
  })
}

/** 资源卡片：AI 积分 / 团队 / 团队成员，三列等分展示 */
const resourceCards = computed(() => {
  const { useMemberCount, maxMemberCount, useWorkspaceCount, maxWorkspaceCount, points } = userPayInfo.value
  return [
    {
      title: $t('AI Agent 积分'),
      icon: 'roxy-agent/rx-ic-logo',
      iconColor: undefined,
      used: points,
      text: $t('积分'),
      addText: $t('购买'),
      addClick: buyPoints,
      visible: !isEcommerce.value,
    },
    {
      title: $t('团队'),
      icon: 'base/rc_ic_user_referral',
      iconColor: 'var(--colors-icon-icon-brand, #11a3fd)',
      used: useWorkspaceCount,
      total: maxWorkspaceCount,
      text: $t('已使用'),
      addText: $t('新增'),
      visible: isOwner.value,
      addClick: () => onExpand('workspace'),
    },
    {
      title: $t('团队成员'),
      icon: 'base/rx_ic_user_group',
      iconColor: 'var(--colors-icon-icon-brand, #11a3fd)',
      used: useMemberCount,
      total: maxMemberCount,
      text: $t('已使用'),
      addText: $t('新增'),
      addClick: () => onExpand('staff'),
    },
  ].filter(item => item.visible !== false)
})

/** 是否展示自动续费开关（付费有效套餐，且非高级合作伙伴） */
const showAutoRenewSwitch = computed(() => !isFree.value && !isTrial.value && !isPremiumPartner.value && (!isExpired.value || !!userPayInfo.value.isAuto))

/** 套餐卡片右下角按钮；自动续费的开启/管理改由开关触发 */
const planActions = computed(() => {
  return [
    {
      label: $t('购买套餐'),
      visible: isFree.value || isTrial.value || isExpired.value,
      primary: true,
      command: () => {
        router.push({ name: 'subscribe-plan' })
      },
    },
    {
      label: $t('更改套餐'),
      visible: !isFree.value && !isTrial.value && !isExpired.value,
      primary: true,
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
      icon: 'base/rx_ic_renew2',
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
  ].filter(item => item.visible !== false && !isPremiumPartner.value)// 高级合作伙伴享受特殊订阅
})

const primeIconMask = `url("${userPaidIconUrl}")`

const freeOrExpired = computed(() => {
  // return true
  return isFree.value || isExpired.value
})

const animationGradient = computed(() => {
  // 未开通会员：设计稿为灰色实线描边（border-inactive）
  const freeBg = 'var(--colors-border-border-inactive, #e2e9ee)'
  return (freeOrExpired.value)
    // no linear-gradient for free or expired
    ? [freeBg, freeBg]
    : ['#2CB8FE 14.71%', '#EC51F7 111.53%']
})

const subscribeInfo = computed(() => {
  if (isEmpty(userPayInfo.value)) {
    return {}
  }

  const { maxWindowCount, createWindowTimes, openWindowTimes, totalCreateWindowTimes, totalOpenWindowTimes } = userPayInfo.value
  const profileCount = currency(maxWindowCount, { symbol: '', precision: 0 })
  const createRate = currency(totalCreateWindowTimes, { precision: 0, symbol: '' }).divide(profileCount.value).value
  const openRate = currency(totalOpenWindowTimes, { precision: 0, symbol: '' }).divide(profileCount.value).value
  const createTotal = isPremiumPartner.value ? $t('无限用量') : totalCreateWindowTimes
  const openTotal = isPremiumPartner.value ? $t('无限用量') : totalOpenWindowTimes

  return {
    expireTime: isPremiumPartner.value
      ? $t('永久免费')
      : $t('到期时间: {value}', { value: isFree.value ? $t('无期限') : format(userPayInfo.value.subEndDate, 'yyyy-MM-dd') }),
    profileCount: isPremiumPartner.value ? billingLabels.value.unlimitedEntities : billingLabels.value.countEntitiesShort(profileCount.format()),
    profileNumber: isPremiumPartner.value ? Infinity : profileCount.value,
    createWindowTimes,
    createTotal,
    createTooltips: isPremiumPartner.value ? '' : $t('每日可创建数 = 窗口数 × {rate}', { rate: createRate }),
    openWindowTimes,
    openTotal,
    openTooltips: isPremiumPartner.value ? '' : $t('每日可打开数 = 窗口数 × {rate}', { rate: openRate }),
  }
})

/** 剩余可用窗口数；无限量（高级合作伙伴）或无套餐时不展示 */
const availableWindowCount = computed(() => {
  const total = Number(subscribeInfo.value.profileNumber)
  if (!total || !Number.isFinite(total)) {
    return null
  }
  return Math.max(0, total - (usedWindowCount.value || 0))
})

/** 套餐窗口用量进度，仅用于进度条展示 */
const profileUsagePercent = computed(() => {
  const total = subscribeInfo.value.profileNumber
  if (!total || !Number.isFinite(Number(total)) || Number(total) <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, (usedWindowCount.value / Number(total)) * 100))
})

onBeforeMount(() => {
  getNextBillingDate()
})

async function getNextBillingDate() {
  if (!userPayInfo.value.autoRenewDowngrade) {
    return
  }

  const { code, data, msg } = await API.pay.userGetDowngradeSubscriptionInfoList()
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }

  nextBillText.value = billingLabels.value.nextBillEntities({
    count: data.windowCount,
    amount: currency(data.amount).format(),
    date: format(data.windowStartDate, 'yyyy/MM/dd'),
  })
}

/**
 * 钱包资源卡只有即将过期数量，续费弹窗需要代理行数据。
 * 先拉即将过期列表，再打开与商店「续费」相同的弹窗。
 */
async function renewExpiresSoonProxy() {
  const expireCount = userPayInfo.value.proxyExpireCount
  if (!expireCount) {
    return
  }

  const { code, data, msg } = await API.proxy.userGetProxyListMergedList({
    type: BuyProxyListType.List,
    proxyExpireStatus: ProxyExpireStatus.soon,
    page_size: String(Math.max(expireCount, 100)),
  } as Parameters<typeof API.proxy.userGetProxyListMergedList>[0] & { proxyExpireStatus: number })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }

  // 与商店续费入口一致：仅已完成订单且即将过期的代理可续费
  const renewList = (data?.rows || []).filter(item =>
    item.proxyExpireStatus === ProxyExpireStatus.soon
    && item.orderStatus === ProxyOrderStatus.done,
  )
  if (!renewList.length) {
    viewExpiresSoonProxy()
    return
  }

  renewProxy(renewList, () => {
    emitter.emit('updateBillList')
    void getUserPayInfo()
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

// /** 打开终身窗口购买弹窗（仅钱包结算） */
// function buyLifetimeProfile() {
//   showModal({
//     header: 'lifetime-profile-purchase',
//     showHeader: false,
//     modal: true,
//     blockScroll: true,
//     slots: {
//       container: ({ hideModal }) => (
//         <LifetimeProfileModal onClose={hideModal} />
//       ),
//     },
//   })
// }

/**
 * 始终展示付费墙
 */
// async function openPrimeDialog() {
//   return handleBusinessCode(BUSINESS_CODE.WINDOW_MAX_LIMIT)
// }
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <!-- 套餐卡片 -->
    <!-- 未订阅（免费 / 已过期）：1px 灰色描边、8px 圆角、bg-page 底；已订阅：2px 渐变描边、12px 圆角 -->
    <AnimationBorder v-if="!isEcommerce" :animation="false" :deg="110" :border-width="freeOrExpired ? 1 : 2" :class="freeOrExpired ? 'rounded-2' : 'rounded-3'" :gradient="animationGradient">
      <div class="relative flex flex-col gap-5 pa-5 overflow-hidden plan" :class="freeOrExpired ? 'rounded-[7px] plan--free' : 'rounded-2.5'">
        <div v-if="!freeOrExpired" class="plan-glow" />
        <!-- 01 标题 + 到期时间 -->
        <div class="relative flex justify-between items-center gap-3">
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <div class="tt-primary text-4 font-600 leading-5 whitespace-nowrap">
              {{ $t('窗口套餐') }}
            </div>
            <div class="px-2 py-0.5 rounded-full text-3 color-white whitespace-nowrap font-['DingTalk_JinBuTi'] plan-badge" :class="{ 'plan-badge--muted': freeOrExpired }">
              {{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}
            </div>
          </div>
          <div v-if="!isTrial" class="shrink-0 text-3 font-500 whitespace-nowrap font-['JetBrains_Mono'] tt-tertiary">
            {{ subscribeInfo.expireTime }}
          </div>
        </div>

        <!-- 02 用量 -->
        <div class="relative flex flex-col gap-3">
          <div class="flex justify-between items-end gap-3">
            <div class="flex items-baseline gap-1.5 min-w-0">
              <span class="text-7 leading-9 font-['DingTalk_JinBuTi']"
                    :class="usedWindowCount > (subscribeInfo?.profileNumber ?? 0) ? 'text-[var(--colors-text-text-error)]' : 'text-[var(--colors-text-text-brand)]'"
              >{{ usedWindowCount?.toLocaleString?.() ?? usedWindowCount }}</span>
              <span class="tt-secondary text-4 leading-6 font-['DingTalk_JinBuTi']">/ {{ subscribeInfo?.profileCount }}</span>
              <ProfilesTips class="self-center" :show-text="false" />
            </div>
            <span v-if="availableWindowCount !== null" class="shrink-0 tt-tertiary text-[16px] leading-[24px] font-['DingTalk_JinBuTi'] whitespace-nowrap">
              {{ $t('{count} 个可用', { count: availableWindowCount.toLocaleString() }) }}
            </span>
          </div>
          <div class="h-1.25 rounded-full overflow-hidden bg-[var(--colors-border-border-inactive,#e2e9ee)]">
            <div class="h-full rounded-full bg-[var(--colors-border-border-brand,#11a3fd)] transition-all" :style="{ width: `${profileUsagePercent}%` }" />
          </div>
          <i18n-t tag="div" class="flex items-center gap-0.5 tt-tertiary text-3 leading-normal select-none"
                  :keypath="$t('每日可创建数：{create} {line} 每日可打开数：{open}', { create: '{create}', open: '{open}', line: '{line}' })"
          >
            <template #create>
              <span v-tooltip.top="subscribeInfo.createTooltips" class="tt-brand font-600 cursor-pointer">{{ subscribeInfo?.createWindowTimes }}</span>
              <span>/</span>
              <span>{{ subscribeInfo?.createTotal }}</span>
            </template>
            <template #open>
              <span v-tooltip.top="subscribeInfo.openTooltips" class="tt-brand font-600 cursor-pointer">{{ subscribeInfo?.openWindowTimes }}</span>
              <span>/</span>
              <span>{{ subscribeInfo?.openTotal }}</span>
            </template>
            <template #line>
              <RxDivider class="mx-2" vertical line-only />
            </template>
          </i18n-t>
        </div>

        <!-- 03 操作 + Prime 提示 -->
        <!-- 未开通会员（免费 / 已过期）：Prime 提示与升级按钮同一行，底部对齐 -->
        <div v-if="freeOrExpired" class="relative flex justify-between items-end gap-3">
          <PrimeTips>
            <template #trigger>
              <div class="flex items-center gap-1.5 cursor-default text-3 leading-normal whitespace-nowrap">
                <i class="block size-4 shrink-0 prime-icon prime-icon--muted" />
                <span class="tt-tertiary">{{ $t('升级会员，解锁全部 Prime 功能') }}</span>
              </div>
            </template>
          </PrimeTips>
          <div class="flex items-center gap-2.5 shrink-0">
            <RxButton v-for="item in planActions" :key="item.label" v-bind="item.props"
                      :severity="item.primary ? undefined : 'secondary'" :outlined="!item.primary" :icon="(item.icon as any)"
                      :label="item.label" size="md" @click="item.command"
            />
          </div>
        </div>
        <div v-else class="relative flex flex-col gap-4">
          <div class="flex justify-between items-start gap-3 min-h-9">
            <RxButton v-if="showAutoRenewSwitch" severity="secondary" outlined size="md"
                      :label="userPayInfo.isAuto ? $t('管理订阅') : $t('启用自动续费')" @click="enableAutoRenew"
            />
            <div v-else />
            <div class="flex items-center gap-2.5 shrink-0">
              <RxButton v-for="item in planActions" :key="item.label" v-bind="item.props"
                        :severity="item.primary ? undefined : 'secondary'" :outlined="!item.primary" :icon="(item.icon as any)"
                        :label="item.label" size="md" @click="item.command"
              />
            </div>
          </div>
          <PrimeTips class="self-start">
            <template #trigger>
              <div class="flex items-center gap-1.5 cursor-default text-3 leading-normal whitespace-nowrap">
                <i class="block size-4 shrink-0 prime-icon" />
                <span class="tt-tertiary">{{ $t('您已解锁全部 Prime 功能') }}</span>
              </div>
            </template>
          </PrimeTips>
          <div v-if="nextBillText" class="tt-tertiary text-3 -mt-2">
            {{ nextBillText }}
          </div>
        </div>
      </div>
    </AnimationBorder>

    <!-- 代理卡片：有已购 IP 时蓝绿渐变描边；一个都没买时与未开通会员一致，1px 灰色描边 -->
    <div class="flex flex-col overflow-hidden card" :class="{ 'card--promo': hasPurchasedProxy }">
      <div class="flex flex-col gap-3 pa-5">
        <div class="flex items-start gap-3">
          <div class="flex-1 tt-primary text-4 font-600 leading-5">
            {{ proxyInfo.title }}
          </div>
          <!-- 主按钮组件，仅覆盖为设计稿的蓝绿渐变底 -->
          <RxButton class="shrink-0 proxy-buy-btn" size="xs" icon="base/rx_ic_cart" :label="$t('购买')" @click="onBuyProxy" />
        </div>
        <div class="flex items-center gap-5">
          <template v-for="(stat, index) in proxyStats" :key="stat.label">
            <div v-if="index > 0" class="shrink-0 w-0 h-7 border-l border-l-dashed border-[var(--colors-border-border-subtle,#c7d1d6)]" />
            <div class="flex-1 min-w-0 flex flex-col gap-1.5">
              <span class="text-3 tt-primary truncate">{{ stat.label }}</span>
              <div class="flex items-baseline gap-1.5" :class="{ 'cursor-pointer': stat.onClick }" @click="stat.onClick?.()">
                <span class="text-6 leading-normal font-600" :class="stat.warning ? 'tt-warning' : 'tt-secondary'">{{ stat.value }}</span>
                <span class="text-3.5 font-500 tt-primary">{{ proxyInfo.unit }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div v-if="proxyInfo.showLongRenewBanner" class="flex items-center justify-center gap-1 px-2 py-1.5 cursor-pointer long-renew-banner" @click="viewExpiresSoonProxy">
        <span>{{ $t('长续首享·低至 {discount}折', { discount: proxyInfo.longRenewZhe, off: proxyInfo.longRenewOff }) }}</span>
        <SvgIcon name="base/rx_ic_arrow_right_2" size="12" color="#fff" />
      </div>
    </div>

    <!-- 积分 / 团队 / 成员 -->
    <div v-if="resourceCards.length" class="flex items-center gap-5 px-5 py-4 card">
      <template v-for="(item, index) in resourceCards" :key="item.title">
        <div v-if="index > 0" class="shrink-0 w-0 h-15 border-l border-l-dashed border-[var(--colors-border-border-subtle,#c7d1d6)]" />
        <div class="flex-1 min-w-0 flex flex-col items-start gap-3">
          <div class="flex flex-col gap-1.5">
            <span class="tt-secondary text-3.5 leading-4.5 font-600 truncate">{{ item.title }}</span>
            <div class="flex items-baseline gap-2 whitespace-nowrap">
              <div class="shrink-0 flex items-baseline gap-1 tt-secondary font-600">
                <span class="text-6 leading-normal">{{ item.used }}</span>
                <span v-if="item.total !== undefined" class="text-4 leading-6">/{{ item.total }}</span>
              </div>
              <span class="tt-tertiary text-3.5 font-500 leading-5">{{ item.text }}</span>
            </div>
          </div>
          <RxButton variant="outlined" size="xxs" icon="base/rx_ic_plus" :label="item.addText" @click="item.addClick" />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prime-icon {
  // 图标原色为白色，用 mask + 渐变按设计稿着色
  background: linear-gradient(135deg, #8780fe 0%, #c491f1 100%);
  mask: v-bind(primeIconMask) no-repeat center / contain;

  &--muted {
    background: var(--colors-icon-icon-note, #90afc2);
  }
}
.plan {
  background: var(--colors-background-bg-overlay, #fff);

  &--free {
    background: var(--colors-background-bg-page, #fff);
  }

  &-glow {
    // 设计稿光斑切图（bg 图层导出），贴卡片右上角 457×160
    position: absolute;
    top: 0;
    right: 0;
    width: 457px;
    height: 160px;
    pointer-events: none;
    background: url('/images/payments/wallet/plan-glow.svg') no-repeat right top / 100% 100%;
  }

  &-badge {
    background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);

    &--muted {
      // 设计稿为固定色 #90afc2（未绑定变量）
      background: #90afc2;
    }
  }
}

.card {
  border-radius: 12px;
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  background: var(--colors-background-bg-overlay, #fff);
}

.card--promo {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--colors-background-bg-overlay, #fff), var(--colors-background-bg-overlay, #fff)) padding-box,
    linear-gradient(100deg, #05b1d7 0%, #11cd69 100%) border-box;
}

// 深色模式光斑切图
[data-theme='dark'] .plan-glow {
  background-image: url('/images/payments/wallet/plan-glow-dark.svg');
}

// 代理购买按钮：RxButton 主按钮，仅把底色换成设计稿的蓝绿渐变
.proxy-buy-btn {
  border-color: transparent;
  background: linear-gradient(to left, #11cd69, #05b1d7);

  &:not(:disabled):hover {
    border-color: transparent;
    background: linear-gradient(to left, #11cd69, #05b1d7);
    filter: brightness(1.05);
  }
}

.tt-warning {
  color: var(--colors-text-text-warning, #fd9f12);
}

.tt-inactive {
  color: var(--colors-text-text-inactive, #7d8387);
}

.long-renew-banner {
  background: linear-gradient(to left, #11cd69, #05b1d7);
  color: #fff;
  font-family: 'DingTalk JinBuTi', sans-serif;
  font-size: 12px;
  line-height: 16px;
}
</style>
