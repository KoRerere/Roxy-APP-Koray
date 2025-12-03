<script setup lang="tsx">
import QRCode from 'qrcode'
import { API } from '/@/api'
import { PaymentStatus } from '/@/enums/pay'
import { $t } from '/@/locales'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { enhanceCountdown } from '/@/utils'

interface Props {
  data: Record<string, any>
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

const { data: props, onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits(['close'])

const [_, onlyErrorToast] = useResponseToast()
const timer = ref()
const loading = ref(false)
const qrcode = ref()
const stopCountdown = ref()
const countdown = ref()

onMounted(() => {
  checkStatus()
  genProxyQrcode()
  stopCountdown.value = enhanceCountdown(new Date(props.endTime), (time) => {
    const { minutes, seconds } = time
    countdown.value = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0')
  }, { alwaysSecondLevel: true, onEnd: () => close(true) })
})

onBeforeUnmount(() => {
  clearTimeout(timer.value)
  stopCountdown.value?.stop()
})

async function genProxyQrcode() {
  qrcode.value = await QRCode.toDataURL(props.payUrl, { margin: 0 })
}

async function checkStatus(force = false) {
  if (force) {
    clearTimeout(timer.value)
  }

  const { code, data, msg } = await API.pay.userQueryOrderStatusList({ orderNo: props.orderNo })
  onlyErrorToast(code, msg)
  if (data === PaymentStatus.Success) {
    confirm()
  } else {
    if (force || data !== PaymentStatus.Wait) {
      close(true)
    } else {
      timer.value = setTimeout(checkStatus, 3000)
    }
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
  <div class="flex flex-col pt-4 pb-6 px-6 gap-4 select-none popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('支付宝付款') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)" />
    </div>
    <div class="flex flex-col gap-12">
      <i18n-t class="sacn-desc" tag="div" :keypath="$t('请于 {time} 内完成支付。', { time: '{time}' })" scope="global">
        <template #time>
          <span v-if="countdown" class="inline-block w-12 cursor-pointer sacn-time">{{ countdown }}</span>
        </template>
      </i18n-t>
      <div class="flex flex-col items-center gap-2.5 pa-5 self-center sacn-area">
        <div class="pa-2 rounded-lg bg-white">
          <img :src="qrcode" class="block pointer-events-none w-45 h-45" />
        </div>
        <div class="h-9 flex items-center gap-1">
          <img class="block w-12" src="/images/payments/rx_pay_alipay_white.svg">
          <span class="sacn-text">{{ $t('支付宝') }}</span>
        </div>
      </div>
      <i18n-t class="help" tag="div" :keypath="$t('* 支付遇到问题？ {link}', { link: '{link}' })" scope="global">
        <template #link>
          <span class="cursor-pointer help-link" @click="$showLiveChat">{{ $t('联系我们') }}</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 384px;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
}

.sacn {
  &-desc {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 16px;
    line-height: 20px;
  }

  &-time {
    color: var(--colors-text-text-warning);
    font-weight: 600;
  }

  &-area {
    border-radius: 16px;
    background-color: #1677FF;
  }

  &-text {
    color: #FFF;
    font-family: "Microsoft YaHei UI";
    font-size: 20px;
    line-height: 20px;
  }
}

.help {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 20px;

  &-link {
    color: var(--colors-text-text-brand);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
