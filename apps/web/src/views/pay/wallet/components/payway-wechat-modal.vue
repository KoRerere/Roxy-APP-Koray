<script setup lang="tsx">
import QRCode from 'qrcode'
import { usePay } from '/@/views/pay/wallet/hook'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { enhanceCountdown } from '/@/utils'

interface Props {
  data: Record<string, any>
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

const { data: props, onConfirm, onCancel } = defineProps<Props>()

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
    if (isOK)
      confirm()
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
  if (isCancel)
    onCancel?.()
}
</script>

<template>
  <div class="flex flex-col select-none w-115 rounded-2 overflow-hidden">
    <div class="flex flex-col items-center gap-4 pa-6 top">
      <div class="w-full relative flex items-center h-9">
        <div class="flex items-center gap-2 py-2 px-3 rounded-full clock">
          <SvgIcon class="cursor-pointer" name="base/rx_ic_clock" />
          <span v-if="countdown" class="tt-primary font-[JetBrains_Mono] text-3.25 font-500">{{ countdown }}</span>
        </div>
        <SvgIcon class="absolute right-0 cursor-pointer" size="20" name="base/rx_ic_delete" @click="close(true)" />
      </div>
      <div class="w-56 aspect-square rounded-2 bg-white pa-3">
        <div class="pa-2.5 rounded-1.5 sacn">
          <img :src="qrcode" class="block pointer-events-none w-full aspect-square">
        </div>
      </div>
    </div>

    <div class="flex flex-col items-center pa-6 gap-6">
      <div class="flex items-center gap-3">
        <SvgIcon name="other/wxpay" size="36" />
        <span class="tt-primary text-4 leading-5 font-700">{{ $t('微信支付') }}</span>
      </div>
      <div class="-mt-3 tt-secondary text-4 leading-5">
        {{ $t('使用微信扫码完成支付') }}
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

.clock {
  background: var(--component-tag-bg2);
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
