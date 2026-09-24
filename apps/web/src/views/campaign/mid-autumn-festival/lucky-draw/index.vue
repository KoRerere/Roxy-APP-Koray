<script lang="tsx" setup>
import LuckyDraw from './lucky-draw.vue'
import LotteryResult from './result.vue'
import LotteryPrizes from './prizes.vue'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { getImage } from '/@/utils/basic.ts'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { LotteryPrize, LotteryPrizeRecord } from './prize'

const props = defineProps<{
  /** 关闭当前抽奖盘弹窗 */
  hideModal: () => void | Promise<boolean>
  /** 转盘停稳后关抽奖盘以弹出结果，不视为结束整段抽奖 */
  closeForResult: () => Promise<boolean>
  /** 从结果弹窗继续抽奖时重新打开抽奖盘 */
  reopenLuckyDraw: () => void
}>()

const router = useRouter()
const [showModal] = useDialog()
const [showToast] = useResponseToast()

const luckyDrawRef = ref<{ start: () => void, stop: () => void, abort: () => void }>()

const loading = ref(false)
const pendingCount = ref(0)
/** 本轮接口已返回、等转盘停稳后再弹结果 */
let pendingPrize: LotteryPrize | undefined

const imgSrc = computed(() => `url('${getImage('campaing/mid-autumn-festival/lottery/lottery_bg.jpg')}')`)

/** 打开抽奖盘时先拉剩余次数，避免次数与按钮状态不一致 */
async function fetchPendingCount() {
  const { code, data, msg } = await API.pay.userMidAutumnLotteryPrizesList()
  if (code === 0) {
    pendingCount.value = data?.pendingCount ?? 0
    return
  }
  showToast(code, msg)
}

/** 关抽奖盘再进「服务和钱包」；人在账单 tab 时也必须带 query，否则会留在账单 */
async function goToWallet() {
  const closed = await props.hideModal()
  if (closed === false) {
    return
  }
  router.push({ name: 'wallet', query: { name: 'manage' } })
}

/** 无次数时仍允许点抽奖按钮，用 toast 引导去消费拿次数 */
function showInsufficientDrawToast() {
  showToast(-1, (
<I18nT keypath={$t('{click} 获得更多抽奖机会', { click: '{click}' })} scope="global">
      {{
        click: () => (
          <a
            class="cursor-pointer"
            onClick={() => {
              void goToWallet()
            }}
          >
            {$t('前往消费')}
          </a>
        ),
      }}
    </I18nT>
), {
    summary: $t('当前抽奖次数不足'),
    life: 5000,
  })
}

/** 先开转动画，再请求抽奖接口，成功后停针 */
async function handleStart() {
  if (loading.value) {
    return
  }

  if (pendingCount.value <= 0) {
    showInsufficientDrawToast()
    return
  }

  loading.value = true
  pendingPrize = undefined
  luckyDrawRef.value?.start()
  try {
    const { code, data, msg } = await API.pay.userMidAutumnLotteryDrawCreate()
    if (code !== 0 || !data) {
      luckyDrawRef.value?.abort()
      showToast(code, msg)
      loading.value = false
      return
    }

    pendingPrize = data
    pendingCount.value = data.pendingCount
    luckyDrawRef.value?.stop()
  }
  catch {
    luckyDrawRef.value?.abort()
    showToast(-1, $t('操作失败'))
    loading.value = false
  }
}

/** 转盘停稳后弹出结果，再关掉抽奖盘；失败中止时不会走到这里 */
async function handleStopped() {
  loading.value = false
  if (!pendingPrize) {
    return
  }

  const prize = pendingPrize
  pendingPrize = undefined
  openResult(prize)
  await props.closeForResult()
}

/** 抽奖结果独立弹层；继续抽奖时再把转盘开回来 */
function openResult(prize: LotteryPrize) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(LotteryResult, {
        prize,
        onClose: hideModal,
        onViewPrizes: () => {
          hideModal()
          openPrizes()
        },
        onContinueDraw: async () => {
          const closed = await hideModal()
          if (closed) {
            props.reopenLuckyDraw()
          }
        },
      }),
    },
  })
}

/** 我的奖品列表，进入时由表格自行请求最新记录 */
function openPrizes() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(LotteryPrizes, {
        onClose: hideModal,
        onViewDetails: prize => viewPrizeDetail(hideModal, prize),
      }),
    },
  })
}

/**
 * 先关奖品列表和抽奖盘，再按类型跳转。
 * 代理 IP 去代理列表，其余奖品去账单；人在服务和钱包 tab 时也必须带 query，否则会留在原 tab。
 */
async function viewPrizeDetail(hidePrizes: () => Promise<boolean>, prize: LotteryPrizeRecord) {
  const closed = await hidePrizes()
  if (!closed) {
    return
  }

  await props.hideModal()
  if (prize.prizeType === 'proxy') {
    router.push({ name: 'agent-list' })
    return
  }
  router.push({ name: 'wallet', query: { name: 'billing' } })
}

onMounted(() => {
  fetchPendingCount()
})
</script>

<template>
  <div class="relative w-120 flex flex-col pa-6 pt-4 gap-6 rounded-2 overflow-hidden content">
    <SvgIcon class="absolute top-4 right-4 z-1 cursor-pointer" name="base/rx_ic_delete" size="20" color="#fff" @click="props.hideModal" />
    <div class="flex flex-col items-center pt-13.5 gap-1.5">
      <div class="title">
        {{ $t('消费开盲盒，好礼等你领') }}
      </div>
      <I18nT tag="div" class="color-white text-3.75 leading-6" scope="global" :keypath="$t('最高可赢  {value}', { value: '{value}' })">
        <template #value>
          <span class="tt-warning font-600">MacBook Pro M5 Pro</span>
        </template>
      </I18nT>
    </div>
    <LuckyDraw ref="luckyDrawRef" :disabled="loading" @stopped="handleStopped" @draw="handleStart" />
    <div class="-mt-1 flex flex-col items-center gap-2.5">
      <I18nT tag="div" class="color-white text-3.5 leading-5" scope="global" :keypath="$t('剩余抽奖次数：{value}', { value: '{value}' })">
        <template #value>
          <span class="tt-warning font-600">{{ pendingCount }}</span>
        </template>
      </I18nT>
      <div class="flex items-center gap-5">
        <div class="flex items-center gap-1" :class="loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'" @click="goToWallet">
          <span class="text-3.25 tt-brand leading-4.5">{{ $t('获取更多抽奖机会') }}</span>
          <SvgIcon class="tt-brand" name="base/rx_ic_chevron_right" size="13" />
        </div>
        <div class="flex items-center gap-1" :class="loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'" @click="openPrizes">
          <span class="text-3.25 tt-brand leading-4.5">{{ $t('查看我的奖品') }}</span>
          <SvgIcon class="tt-brand" name="base/rx_ic_chevron_right" size="13" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imgSrc);
  background-size: 100% auto;
  background-repeat: no-repeat;
  background-position: top center;
}

.title {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  line-height: 36px;
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
