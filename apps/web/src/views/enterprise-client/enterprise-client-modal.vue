<script setup lang="ts">
import currency from 'currency.js'
import { motion, useReducedMotion } from 'motion-v'
import type { UserGetPromotionInfoListData } from '@roxy/backend-api'
import couponDivider from '/@/assets/images/enterprise-client/coupon-divider.svg?url'
import referralDivider from '/@/assets/images/enterprise-client/referral-divider.svg?url'
import purchaseReferralDivider from '/@/assets/images/enterprise-client/purchase-referral-divider.svg?url'
import PurchaseCredits from './purchase-credits.vue'
import { useProxyPurchaseBinding } from './useProxyPurchaseBinding'
import QrcodeModal from '/@/views/referral-program/components/referal/qrcode-modal.vue'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils'
import { usePermission } from '/@/hooks/usePermission'

const props = defineProps<{
  rechargeAmount?: number
  balance?: number
  purchaseCount?: number
  profilePurchaseCount?: number
}>()
const emit = defineEmits<{ close: [], createProfiles: [], nestedDialogChange: [open: boolean] }>()
const { userInfo } = storeToRefs(useUserStore())
const { isZh } = storeToRefs(useSimpleLocale())
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const promotionInfo = shallowRef<UserGetPromotionInfoListData['data']>()
const loading = ref(false)
const failed = ref(false)
const creditsVisible = ref(true)
const copied = ref(false)
const reducedMotion = useReducedMotion()
const { check } = usePermission()
const { openProxyPurchaseBinding } = useProxyPurchaseBinding()
const canBindProfiles = computed(() => check('Profiles_select_proxy'))
const canCreateProfiles = computed(() => check('Profiles_add'))
const couponInitial = computed(() => reducedMotion.value ? false : { opacity: 0, y: 96, scale: 0.96 })
const hasRecharge = computed(() => props.rechargeAmount !== undefined)
const hasProxyPurchase = computed(() => props.purchaseCount !== undefined)
const hasProfilePurchase = computed(() => props.profilePurchaseCount !== undefined)
const hasPurchase = computed(() => hasProxyPurchase.value || hasProfilePurchase.value)
const referral = computed(() => promotionInfo.value?.promotionLinkList?.find(item => item.promotionLink))
const managerQrCode = computed(() => promotionInfo.value?.businessManagerQrCode?.[isZh.value ? 'Wechat' : 'Telegram'])

onMounted(loadPromotion)

function couponTransition(delay: number) {
  return reducedMotion.value
    ? { duration: 0 }
    : {
        type: 'spring' as const,
        duration: 0.45,
        bounce: 0.22,
        delay,
        opacity: { duration: 0.18, delay },
      }
}

async function loadPromotion() {
  loading.value = true
  failed.value = false
  try {
    const { code, data, msg } = await API.base.userGetPromotionInfoList()
    if (code !== 0) {
      onlyErrorToast(code, msg)
      failed.value = true
      return
    }
    promotionInfo.value = data
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

function dismissCredits() {
  if (hasRecharge.value) {
    creditsVisible.value = false
  }
  else {
    emit('close')
  }
}

function openManager() {
  if (!managerQrCode.value) {
    return
  }

  const list = [{ name: isZh.value ? 'Wechat' : 'Telegram', value: managerQrCode.value }]
  emit('nestedDialogChange', true)
  showModal({
    uniqueKey: 'enterprise-account-manager',
    showHeader: false,
    blockScroll: true,
    pt: { root: { 'aria-label': $t('添加客户经理') } },
    handleCancel: () => emit('nestedDialogChange', false),
    slots: {
      container: ({ handleCancel }) => h(QrcodeModal, { list, onClose: handleCancel }),
    },
  })
}

async function copyInviteLink() {
  if (!referral.value?.promotionLink) {
    return
  }
  try {
    await copyText(referral.value.promotionLink)
    copied.value = true
  }
  catch {
    showToast(1, $t('复制失败，请重试'))
  }
}

async function bindProfiles() {
  emit('nestedDialogChange', true)
  try {
    await openProxyPurchaseBinding()
  }
  finally {
    emit('nestedDialogChange', false)
  }
  emit('close')
}
</script>

<template>
  <div class="enterprise-client-modal" :class="{ 'shrink-0 max-h-[calc(100dvh-32px)] !overflow-y-auto border border-solid border-[var(--colors-border-border-base)] [scrollbar-width:thin] [--component-button-primary-bg:#11a3fd] [--component-button-primary-border:#0282d4] [--colors-text-text-brand:#11a3fd] [--colors-border-border-brand:#11a3fd] [--colors-text-text-warning:#fd9f12] [--colors-text-text-success:#1cc94d]': hasPurchase }" data-testid="enterprise-client-modal">
    <PurchaseCredits v-if="hasPurchase" :purchase-type="hasProfilePurchase ? 'profile' : 'proxy'" :user-name="userInfo.userName" :loading="loading" :can-contact="!!managerQrCode" @contact="openManager" @close="emit('close')" />
    <section v-else-if="creditsVisible" class="credits" aria-labelledby="enterprise-credits-title">
      <div class="credits-heading">
        <h2 id="enterprise-credits-title">
          {{ userInfo.userName ? $t('您的专属优惠，{name}', { name: userInfo.userName }) : $t('您的专属优惠') }}
        </h2>
        <div class="manager-row">
          <p>{{ $t('联系您的客户经理领取') }}</p>
          <RxButton size="sm" severity="secondary" outlined icon="base/rx_ic_qrcode" :label="$t('添加客户经理')" :loading="loading" :disabled="!managerQrCode" @click="openManager" />
        </div>
      </div>
      <RxButton class="close-button !border-0 !rounded-md" size="lg" variant="text" severity="secondary" icon="base/rx_ic_delete" :aria-label="$t('关闭')" @click="dismissCredits" />
      <div class="coupons">
        <motion.article class="coupon subsidy origin-bottom" :initial="couponInitial" :animate="{ opacity: 1, y: 0, scale: 1 }" :transition="couponTransition(0.06)">
          <div class="coupon-main">
            <div class="coupon-value">
              <span class="currency">$</span><strong>5</strong>
            </div>
            <h3>{{ $t('代理 IP 补贴') }}</h3>
          </div>
          <div class="coupon-divider">
            <img :src="couponDivider" alt="" width="229" height="1">
          </div>
          <p class="coupon-condition">
            <SvgIcon name="base/rx_ic_gift2" size="20" /><span>{{ $t('无最低消费限制') }}</span>
          </p>
        </motion.article>
        <motion.article class="coupon savings origin-bottom" :initial="couponInitial" :animate="{ opacity: 1, y: 0, scale: 1 }" :transition="couponTransition(0.14)">
          <div class="coupon-main">
            <div class="coupon-value">
              <span class="save">{{ $t('立省') }}</span><span class="currency">$</span><strong>10</strong>
            </div>
            <h3>{{ $t('静态住宅代理') }}</h3>
          </div>
          <div class="coupon-divider">
            <img :src="couponDivider" alt="" width="229" height="1">
          </div>
          <p class="coupon-condition">
            <SvgIcon name="base/rx_ic_cart" size="20" /><span>{{ $t('订单满 $200 可用') }}</span>
          </p>
        </motion.article>
      </div>
    </section>
    <div class="content">
      <template v-if="hasPurchase">
        <section class="flex flex-col gap-3" aria-labelledby="enterprise-purchase-success-title">
          <h2 id="enterprise-purchase-success-title" class="flex items-center gap-2.5 font-[Archivo] text-6 font-600 leading-[normal] tt-primary">
            <SvgIcon class="shrink-0" name="base/rx_ic_check_fill" size="24" color="var(--colors-text-text-success)" />{{ hasProfilePurchase ? $t('恭喜，订阅成功！') : $t('购买成功') }}
          </h2>
          <p v-if="hasProfilePurchase" class="text-3.5 leading-5 tt-secondary">
            {{ $t('付款成功！您已成为高级会员，即刻享用会员专属功能。') }}
          </p>
          <i18n-t v-else tag="p" class="text-4 leading-6 tt-secondary" :keypath="$t('您购买的 {count} 条代理 IP 已到账，绑定到窗口后即可开始使用。', { count: '{count}' })" scope="global">
            <template #count>
              <span class="font-600 tt-brand">{{ purchaseCount }}</span>
            </template>
          </i18n-t>
        </section>
        <RxButton v-if="hasProfilePurchase" class="confirm-button !h-auto min-h-10 [&_.p-button-label]:whitespace-normal" :class="{ '!bg-[var(--component-button-primary-bg)] !border-[var(--component-button-primary-border)] !text-[var(--component-button-primary-text)]': canCreateProfiles }" size="lg" :label="$t('创建窗口')" :disabled="!canCreateProfiles" @click="emit('createProfiles')" />
        <RxButton v-else class="confirm-button !h-auto min-h-10 [&_.p-button-label]:whitespace-normal" :class="{ '!bg-[var(--component-button-primary-bg)] !border-[var(--component-button-primary-border)] !text-[var(--component-button-primary-text)]': canBindProfiles }" size="lg" icon="base/rx_ic_link" :label="$t('批量绑定窗口')" :disabled="!canBindProfiles" @click="bindProfiles" />
      </template>
      <template v-if="hasRecharge">
        <section class="recharge-success" aria-labelledby="enterprise-recharge-title">
          <div class="success-copy">
            <h2 id="enterprise-recharge-title">
              <SvgIcon name="base/rx_ic_check_fill" size="24" color="var(--colors-text-text-success)" />{{ $t('资金充值成功') }}
            </h2>
            <i18n-t tag="p" :keypath="$t('您已成功充值 {amount}，当前钱包余额为 {balance}', { amount: '{amount}', balance: '{balance}' })" scope="global">
              <template #amount>
                <span class="amount">{{ currency(rechargeAmount ?? 0).format() }}</span>
              </template>
              <template #balance>
                <span class="amount">{{ currency(balance ?? 0).format() }}</span>
              </template>
            </i18n-t>
          </div>
        </section>
        <RxButton class="confirm-button" size="lg" :label="$t('确认')" @click="emit('close')" />
      </template>
      <div class="referral-section" :class="{ 'with-recharge': hasRecharge }" :aria-busy="loading">
        <div v-if="hasRecharge || hasPurchase" class="referral-divider" :class="{ '!h-px overflow-hidden': hasPurchase }">
          <img :src="hasPurchase ? purchaseReferralDivider : referralDivider" :class="{ '!top-0 !max-w-none': hasPurchase }" alt="" width="576" height="1">
        </div>
        <div v-if="failed" class="referral-row" role="status">
          <p>{{ $t('暂时无法加载联系及邀请信息') }}</p>
          <RxButton size="xs" outlined severity="secondary" :label="$t('重试')" @click="loadPromotion" />
        </div>
        <div v-else class="referral-row">
          <div class="referral-copy">
            <p>{{ $t('邀请好友使用 RoxyBrowser，最高可获得 30% 佣金奖励') }}</p>
            <div class="referral-code">
              <span>{{ $t('推广码') }} :</span><code>{{ loading ? '…' : referral?.promotionCode || '—' }}</code>
            </div>
          </div>
          <RxButton class="copy-button" :class="{ '!border-[var(--colors-border-border-brand)] !text-[var(--colors-text-text-brand)]': hasPurchase }" size="xs" outlined :disabled="!referral?.promotionLink" :label="copied ? $t('已复制') : $t('复制邀请链接')" @click="copyInviteLink" />
          <span class="sr-only" aria-live="polite">{{ copied ? $t('已复制') : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.enterprise-client-modal {
  width: 640px;
  max-width: 100%;
  overflow: hidden;
  border-radius: var(--radius-lg, 8px);
  background: var(--colors-background-bg-page);
  color: var(--colors-text-text-primary);
  font-family: Inter, sans-serif;

  h2,
  h3,
  p {
    margin: 0;
  }
}

.credits {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 32px;
  background: linear-gradient(180deg, var(--enterprise-gold-start, #faebd1), var(--enterprise-gold-end, #f7dfb5));
}

.credits-heading {
  display: flex;
  flex-direction: column;
  gap: 12px;

  h2 {
    padding-right: 28px;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
  }
}

.manager-row,
.referral-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.manager-row p {
  flex: 1;
  min-width: 0;
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  font-weight: 500;
}
.manager-row :deep(.rx_button) {
  flex-shrink: 0;
  height: 32px;
}
.credits .close-button {
  position: absolute !important;
  top: 20px;
  right: 20px;
}
.close-button {
  min-width: 40px;
  width: 40px;
  height: 40px;
  padding: 8px;
}

.coupons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  overflow: clip;
  overflow-clip-margin: 6px;
  filter: drop-shadow(0 4px 2px rgb(0 0 0 / 2%)) drop-shadow(0 1px 0.5px rgb(0 0 0 / 6%));
}
.coupon {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 12px 24px;
  border-left: 5px solid var(--coupon-accent);
  border-radius: 12px;
  background: var(--colors-background-bg-page);
  mask-image: radial-gradient(circle at left center, transparent 13.5px, #000 14px);
}
.subsidy {
  --coupon-accent: var(--colors-text-text-warning);
}
.savings {
  --coupon-accent: var(--colors-text-text-error);
}
.coupon-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.coupon-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  height: 58px;
  color: var(--coupon-accent);
}
.coupon-value .currency {
  font-size: 36px;
  font-weight: 600;
  line-height: 44px;
}
.coupon-value strong {
  font-size: 48px;
  font-weight: 700;
  line-height: 58px;
}
.coupon-value .save {
  margin-right: 2px;
  font-size: 16px;
  font-weight: 600;
}
.coupon h3 {
  font-size: 16px;
  font-weight: 600;
  line-height: 19px;
}
.coupon-divider,
.referral-divider {
  height: 0;
  position: relative;
}
.coupon-divider img,
.referral-divider img {
  position: absolute;
  top: -1px;
  max-width: 100%;
}
.coupon-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
  color: var(--colors-text-text-tertiary);
}
.coupon-condition :deep(svg) {
  flex-shrink: 0;
  color: var(--coupon-accent);
}
.content {
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
}
.recharge-success {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}
.success-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.success-copy h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: Archivo, Inter, sans-serif;
  font-size: 24px;
  font-weight: 600;
  line-height: 26px;
}
.success-copy h2 :deep(svg) {
  flex-shrink: 0;
}
.success-copy p {
  color: var(--colors-text-text-secondary);
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}
.amount {
  color: var(--colors-text-text-brand);
  font-weight: 600;
}
.confirm-button {
  width: 100%;
  height: 40px;
  margin-top: 28px;
  margin-bottom: 20px;
}
.referral-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.referral-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.referral-row {
  color: var(--colors-text-text-secondary);
  font-size: 13px;
  line-height: 16px;
}
.referral-code {
  display: flex;
  align-items: center;
  gap: 6px;
}
.referral-code code {
  padding: 4px 6px;
  border: 0.5px solid var(--colors-border-border-subtle);
  border-radius: 4px;
  background: var(--colors-background-bg-block);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
}
.copy-button {
  flex-shrink: 0;
}

[data-theme='dark'] .credits {
  --enterprise-gold-start: var(--colors-background-bg-gold);
  --enterprise-gold-end: #59431f;
}

@media (max-width: 600px) {
  .credits {
    padding: 24px;
  }
  .content {
    padding: 24px;
  }
  .manager-row,
  .referral-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .coupons {
    gap: 12px;
  }
  .coupon {
    padding-left: 14px;
    padding-right: 12px;
  }
  .coupon h3 {
    min-height: 38px;
  }
  .coupon-condition {
    align-items: flex-start;
  }
  .success-copy h2 {
    font-size: 20px;
    line-height: 26px;
  }
}
@media (max-width: 420px) {
  .coupons {
    grid-template-columns: 1fr;
  }
  .coupon h3 {
    min-height: 0;
  }
}
</style>
