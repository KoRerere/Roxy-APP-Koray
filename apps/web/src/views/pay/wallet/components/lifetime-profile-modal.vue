<script setup lang="ts">
import { h } from 'vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import LifetimeProfileSuccess from '/@/views/pay/wallet/components/lifetime-profile-success.vue'
import currency from 'currency.js'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { PayWay } from '/@/enums/pay'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { getImage } from '/@/utils'
import { API } from '/@/api'
import { useFirstConsumeReferralPopup } from '/@/views/referral-program/useFirstConsumeReferralPopup'

const { onCancel } = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()
/** 接口注释：终身窗口无折扣，单价 $20 */
const UNIT_PRICE = 20
const QUICK_COUNTS = [1, 5, 10, 20]
const MIN_COUNT = 1
const MAX_COUNT = 100

interface Props {
  /** 取消购买（关闭且未支付） */
  onCancel?: () => void | Promise<void>
}

const [_, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()
const { getUserPayInfo } = useUserStore()
const { isDarkTheme } = storeToRefs(useThemeStore())
const { maybeShowFirstConsumeReferralPopup } = useFirstConsumeReferralPopup()

const purchaseCount = ref(MIN_COUNT)

/** 数量区顶部彩色光晕：按深浅色切换设计稿 Gradient 资源 */
const qtyPanelGlowSrc = computed(() => {
  return isDarkTheme.value
    ? getImage('payments/lifetime-profile-gradient-dark.svg')
    : getImage('payments/lifetime-profile-gradient-light.svg')
})

const totalAmount = computed(() => currency(purchaseCount.value).multiply(UNIT_PRICE).value)

/** 步进输入后钳制购买数量 */
function onCountUpdate(value: number) {
  nextTick(() => {
    purchaseCount.value = Math.min(Math.max(Math.round(value) || MIN_COUNT, MIN_COUNT), MAX_COUNT)
  })
}

/** 快捷档位直接写入数量 */
function quickSelect(value: number) {
  purchaseCount.value = value
}

/** 钱包扣款购买终身窗口；成功后刷新付费信息并弹出成功态 */
async function settle() {
  const { code, data, msg } = await API.pay.userPermanentWindowSettlementCreate({
    payType: PayWay.Balance,
    purchaseCount: purchaseCount.value,
  })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return false
  }

  await getUserPayInfo()
  showSuccess(data.purchaseCount || purchaseCount.value)
  return true
}

/** 打开终身窗口购买成功弹窗 */
function showSuccess(count: number) {
  showModal({
    header: 'lifetime-profile-success',
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => maybeShowFirstConsumeReferralPopup(),
    slots: {
      container: ({ handleCancel }) => h(LifetimeProfileSuccess, {
        purchaseCount: count,
        onClose: handleCancel,
      }),
    },
  })
}

/**
 * 与扩充配额等购买弹窗一致：先选数量，确认后再走钱包支付。
 */
function confirm() {
  showModal({
    header: 'lifetime-profile-wallet-pay',
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount: totalAmount.value,
        originalAmount: totalAmount.value,
        cancelRedirect: false,
        onClose: hideModal,
        onConfirm: async () => {
          const ok = await settle()
          if (ok) {
            close(false)
          }
        },
      }),
    },
  })
}

/** 关闭购买弹窗 */
function close(isCancel: boolean) {
  emit('close')
  if (isCancel) {
    onCancel?.()
  }
}
</script>

<template>
  <div class="flex flex-col pt-4 gap-4 overflow-hidden w-140">
    <div class="h-10 relative flex justify-between items-center px-6">
      <span class="tt-primary text-4 font-600 leading-normal">{{ $t('购买终身窗口') }}</span>
      <SvgIcon class="cursor-pointer" size="20" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)" @click="close(true)" />
    </div>

    <div class="flex flex-col gap-6 px-6 pb-6">
      <div class="relative flex flex-col gap-5 items-center overflow-hidden py-6 rounded-lg qty-panel">
        <!-- 设计稿顶部光晕：480×122 居中贴顶，圆角由 overflow-hidden 裁切 -->
        <img
          :src="qtyPanelGlowSrc"
          alt=""
          draggable="false"
          class="absolute top-0 left-1/2 -translate-x-1/2 w-480px h-122px max-w-none pointer-events-none select-none"
        >
        <p class="relative z-1 tt-primary text-3.5 font-500 text-center m-0">
          {{ $t('请选择要购买的窗口数量') }}
        </p>
        <RxStepInput v-model="purchaseCount" class="relative z-1 !w-70 !h-18" size="lg" :min="MIN_COUNT" :max="MAX_COUNT" :step="1"
                     :pt="{ pcinputtext: { root: '!text-8 !font-bold' } }" @update:model-value="onCountUpdate"
        />
        <div class="relative z-1 flex gap-2 items-center justify-center">
          <div v-for="item in QUICK_COUNTS" :key="item" class="w-20 min-w-6 px-4 py-1.5 rounded-md text-center text-4 font-500 cursor-pointer select-none qty-tag" @click="quickSelect(item)">
            {{ item }}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 w-full">
        <div class="flex items-center justify-between text-4">
          <span class="tt-primary font-500 leading-5">{{ $t('单价') }}</span>
          <span class="tt-primary text-right">{{ currency(UNIT_PRICE).format() }}</span>
        </div>
        <div class="flex items-center justify-between text-4">
          <span class="tt-primary font-500 leading-5">{{ $t('数量') }}</span>
          <span class="tt-primary text-right">{{ purchaseCount }}</span>
        </div>
        <div class="h-11 flex items-center justify-between">
          <span class="tt-primary text-4 font-500 leading-5">{{ $t('总价') }}</span>
          <span class="text-6 font-600 text-[var(--color-blue-300,#12a3fc)] text-right">{{ currency(totalAmount).format() }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-4 w-full">
        <RxButton class="w-full" size="lg" :label="$t('确认付款')" @click="confirm" />
        <!-- 设计稿：付款与须知之间用虚线隔开，避免须知被当成按钮附属文案 -->
        <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-base)" />
        <div class="flex flex-col gap-1 px-1.5 w-full">
          <div class="tt-primary text-3.5 font-500 leading-normal">{{ $t('购买须知:') }}</div>
          <div class="notes">
            <!-- 关键词加中等字重，对应设计稿里比正文更醒目的说明片段 -->
            <i18n-t tag="p" class="m-0" scope="global" :keypath="$t('1. {em}，无需手动续费', { em: '{em}' })">
              <template #em>
                <span class="notes-em">{{ $t('一次购买永久有效') }}</span>
              </template>
            </i18n-t>
            <i18n-t tag="p" class="m-0" scope="global" :keypath="$t('2. {em}，互不影响，满足不同使用需求', { em: '{em}' })">
              <template #em>
                <span class="notes-em">{{ $t('可与现有的窗口订阅套餐叠加使用') }}</span>
              </template>
            </i18n-t>
            <i18n-t tag="p" class="m-0" scope="global" :keypath="$t('3. {em0}，已购买的订单{em1}', { em0: '{em0}', em1: '{em1}' })">
              <template #em0>
                <span class="notes-em">{{ $t('购买成功后立即生效') }}</span>
              </template>
              <template #em1>
                <span class="notes-em">{{ $t('不支持退款') }}</span>
              </template>
            </i18n-t>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.qty-panel {
  /* 设计稿：页面底色上叠品牌蓝 0%→14% 纵向渐变，浅色呈淡蓝、深色叠暗底呈深蓝衬底 */
  background:
    linear-gradient(180deg, rgba(17, 163, 253, 0.04) 0%, rgba(17, 163, 253, 0.14) 100%),
    var(--colors-background-bg-page, #fff);
}

.qty-tag {
  border: 0.5px solid var(--colors-border-border-base, #afb7bb);
  background: var(--colors-background-bg-page, #fff);
  color: var(--component-tag-text, #34393d);
}

.notes {
  color: var(--colors-text-text-tertiary, #575d60);
  font-size: 12px;
  line-height: 20px;

  &-em {
    color: var(--colors-text-text-secondary, #34393d);
    font-weight: 500;
  }
}
</style>
