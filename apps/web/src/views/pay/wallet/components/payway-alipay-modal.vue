<script setup lang="tsx">
import currency from 'currency.js'
import QRCode from 'qrcode'
import { usePay } from '/@/views/pay/wallet/hook'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { enhanceCountdown } from '/@/utils'

interface Props {
  data: Record<string, any>
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  /** 从钱包充值进入时显示返回；点击后关闭扫码弹窗，不跳转账单页，回到充值弹窗 */
  onBack?: () => void | Promise<void>
}

const { data: props, onConfirm, onCancel, onBack } = defineProps<Props>()

const emit = defineEmits(['close'])

const { genCheckerOrderStatus } = usePay()
const [_, onlyErrorToast] = useResponseToast()
const loading = ref(false)
const qrcode = ref()
const stopCountdown = ref()
const countdown = ref()
const checker = genCheckerOrderStatus()

onMounted(() => {
  checkStatus()
  genProxyQrcode()
  stopCountdown.value = enhanceCountdown(new Date(props.endTime), (time) => {
    const { minutes, seconds } = time
    countdown.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }, {
    alwaysSecondLevel: true,
    onEnd: () => {
      console.log('order timeout closed')
      close(true)
    },
  })
})

onBeforeUnmount(() => {
  checker.stop()
  stopCountdown.value?.stop()
})

async function genProxyQrcode() {
  qrcode.value = await QRCode.toDataURL(props.payUrl, { margin: 0 })
}

async function checkStatus() {
  try {
    const isOK = await checker.check(props.orderNo)
    if (isOK) {
      confirm()
    }
  }
  catch (error) {
    close(true)
    onlyErrorToast(-1, (error as Error).message)
  }
}

async function confirm() {
  loading.value = true
  await onConfirm?.()
  loading.value = false
  close(false)
}

function close(isCancel: boolean) {
  emit('close')
  if (isCancel) {
    onCancel?.()
  }
}

/** 关闭扫码弹窗并回到钱包充值，不走取消支付的账单页跳转 */
function back() {
  emit('close')
  onBack?.()
}
</script>

<template>
  <div class="flex flex-col select-none w-115 rounded-2 overflow-hidden">
    <div class="flex flex-col items-center gap-5 pa-6 top">
      <div class="w-full relative flex items-center h-9">
        <RxButton v-if="onBack" severity="secondary" variant="text" size="xxs" icon="base/rx_ic_arrow_left" :label="$t('返回')" @click="back" />
        <SvgIcon class="absolute right-0 cursor-pointer" size="20" name="base/rx_ic_delete" @click="close(true)" />
      </div>

      <div v-if="data.orderAmount" class="flex flex-col justify-center items-center gap-1">
        <div class=" tt-secondary text-3.5 font-600 leading-4">
          {{ $t('支付金额') }}
        </div>
        <div class="tt-warning text-9 font-800 leading-12">
          {{ currency(data.orderAmount).format() }}
        </div>
      </div>

      <div class="flex flex-col items-center gap-3">
        <div class="w-56 aspect-square rounded-2 bg-white pa-3">
          <div class="pa-2.5 rounded-1.5 sacn">
            <img :src="qrcode" class="block pointer-events-none w-full aspect-square">
          </div>
        </div>

        <i18n-t class="tt-primary text-3.5 font-500 leading-normal" tag="div" :keypath="$t('二维码将于 {time} 到期', { time: '{time}' })" scope="global">
          <template #time>
            <span class="tt-warning">{{ countdown }}</span>
          </template>
        </i18n-t>
      </div>
    </div>

    <div class="flex flex-col items-center pa-6 gap-6">
      <div class="flex items-center gap-3">
        <SvgIcon name="other/alipay" size="36" />
        <span class="tt-primary text-4 leading-5 font-700">{{ $t('支付宝') }}</span>
      </div>
      <div class="-mt-3 tt-secondary text-4 leading-5">
        {{ $t('使用支付宝扫码完成支付') }}
      </div>
      <i18n-t class="tt-tertiary text-3 leading-5" tag="div" :keypath="$t('* 支付遇到问题？ {link}', { link: '{link}' })" scope="global">
        <template #link>
          <span class="cursor-pointer link" @click="$showLiveChat">{{ $t('联系我们') }}</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.top {
  background: var(--colors-background-bg-block);
}

.sacn {
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
}

.link {
  color: var(--colors-text-text-brand);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
