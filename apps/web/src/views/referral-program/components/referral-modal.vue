<script setup lang="ts">
import { copyText, getImage } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'

const emit = defineEmits<{
  /** 关闭弹窗；查看详情传入 view-details，避免购买成功回调再跳走 */
  close: [reason?: 'dismiss' | 'view-details']
}>()

const router = useRouter()
const { isDarkTheme } = storeToRefs(useThemeStore())
const [showToast] = useResponseToast()

const illustrationSrc = getImage('referral-program/sbs.svg')
/** 当前推广链接 */
const referralLink = ref('')
/** 好友消费折扣（% Off） */
const userDiscount = ref<number>()
/** 邀请人返佣比例（%） */
const promotionDiscount = ref<number>()

/** 弹窗顶部装饰背景，随主题切换 */
const headerBgSrc = computed(() => {
  return isDarkTheme.value
    ? `url('${getImage('referral-program/modal-bg-dark.png')}')`
    : `url('${getImage('referral-program/modal-bg-light.png')}')`
})

/** 好友折扣的「折」数值，由 % Off 换算 */
const discountZhe = computed(() => {
  const off = Number(userDiscount.value)
  if (!Number.isFinite(off)) {
    return '--'
  }
  const zhe = (100 - off) / 10
  return Number.isInteger(zhe) ? String(zhe) : String(Number(zhe.toFixed(1)))
})

/** 返佣比例展示值 */
const commissionRate = computed(() => {
  const rate = Number(promotionDiscount.value)
  return Number.isFinite(rate) ? String(rate) : '--'
})

onMounted(() => {
  void fetchPromotionInfo()
})

/** 拉取默认推广链接上的折扣、返佣和邀请链接 */
async function fetchPromotionInfo() {
  const { code, data } = await API.base.userGetPromotionInfoList()
  const link = data?.promotionLinkList?.[0]
  if (code !== 0 || !link) {
    return
  }
  referralLink.value = link.promotionLink || ''
  userDiscount.value = link.userDiscount
  promotionDiscount.value = link.promotionDiscount
}

/** 跳转推广计划页并关闭弹窗 */
function onViewDetails() {
  emit('close', 'view-details')
  router.push({ name: 'referral-program' })
}

/** 复制带折扣与专属链接的分享文案 */
function onCopyShare() {
  if (!referralLink.value) {
    return
  }
  const off = Number.isFinite(Number(userDiscount.value)) ? userDiscount.value : '--'
  copyText($t('Roxy 指纹浏览器：专用于 AI 账号多开、跨境出海与社媒矩阵的多账号防关联/环境隔离工具。\n\n专属内推享 {discount} 折（立省 {off}%）：\n\n🔗 通过链接注册：{link}', {
    discount: discountZhe.value,
    off,
    link: referralLink.value,
  }))
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <div class="relative w-140 overflow-hidden rounded-2 modal">
    <SvgIcon class="absolute top-5 right-5 z-1 cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="emit('close')" />

    <div class="flex justify-center pt-8">
      <img class="block h-18" :src="illustrationSrc">
    </div>

    <div class="flex flex-col items-center gap-1 px-8 pt-5">
      <i18n-t class="tt-primary text-4.5 font-700 leading-7 text-center" tag="div" scope="global" :keypath="$t('分享专属链接给同行，好友享 {discount} 折', { discount: '{discount}', off: '{off}' })">
        <template #discount>
          <span class="color-[#11A3FD]">{{ discountZhe }}</span>
        </template>
        <template #off>
          <span class="color-[#11A3FD]">{{ Number.isFinite(Number(userDiscount)) ? userDiscount : '--' }}</span>
        </template>
      </i18n-t>
      <i18n-t class="tt-primary text-4.5 font-700 leading-7 text-center" tag="div" scope="global" :keypath="$t('您享 {rate}% 返佣，轻松回血！', { rate: '{rate}' })">
        <template #rate>
          <span class="color-[#FF8A00]">{{ commissionRate }}</span>
        </template>
      </i18n-t>
    </div>

    <div class="px-6 pt-5">
      <RxDivider line-only />
    </div>

    <div class="flex flex-col gap-2 px-6 pt-4">
      <div class="tt-primary text-3.5 leading-5">
        {{ $t('邀请链接:') }}
      </div>
      <div class="px-3 py-2.5 rounded-lg link-box tt-secondary text-3.5 font-['JetBrains_Mono'] leading-5 break-all">
        {{ referralLink || '--' }}
      </div>
    </div>

    <div class="flex justify-end items-center gap-3 px-6 pt-6 pb-6">
      <RxButton severity="secondary" variant="outlined" :label="$t('查看详情')" @click="onViewDetails" />
      <RxButton :label="$t('复制并分享')" :disabled="!referralLink" @click="onCopyShare" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal {
  background-color: var(--colors-background-bg-overlay, #fff);
  background-image: v-bind(headerBgSrc);
  background-repeat: no-repeat;
  background-position: top center;
  background-size: 100% auto;
}

.link-box {
  background: var(--colors-background-bg-block, #f1f5f8);
}
</style>
