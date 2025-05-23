<script setup lang="tsx">
import QRCode from 'qrcode'
import { API } from '/@/api'
import { PaymentStatus } from '/@/enums/pay'
import { $t } from '/@/locales'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText, startCountdown } from '/@/utils'
import { RxAlert } from '/@/components/rx-alert/'

interface Props {
  data: Record<string, any>
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

const { data: props, onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits(['close'])

const [showToast, onlyErrorToast] = useResponseToast()
const HOUR = 60 * 60 * 1000
const timer = ref()
const loading = ref(false)
const qrcode = ref()
const stopCountdown = ref()
const countdown = ref()


const progress = computed(() => {
  if (!countdown.value) return 0
  return Number((countdown.value.timestamp / HOUR - 1).toFixed(2))
})

const countdownText = computed(() => {
  if (!countdown.value) return '--:--:--'
  const { hours, minutes, seconds } = countdown.value
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})
const notes = computed(() => ({
  title: $t('注意事项'),
  items: [
    $t('支付金额须准确为 {amount} USDT，否则可能导致无法到账', { amount: props.realAmount }),
    $t('转账时请再次确认地址是否与页面一致'),
  ]
}))

onMounted(() => {
  checkStatus()
  genProxyQrcode()
  stopCountdown.value = startCountdown(new Date(props.endTime), (time) => {
    countdown.value = time
  })
})

onBeforeUnmount(() => {
  clearTimeout(timer.value)
  stopCountdown.value?.()
})

async function genProxyQrcode() {
  qrcode.value = await QRCode.toDataURL(props.payUrl)
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
    if (force) {
      close(true)
    } else {
      timer.value = setTimeout(checkStatus, 3000)
    }
  }
}

function copyLink() {
  copyText(props.payUrl)
  showToast(0, $t('复制成功'))
}

function openLiveChat() {
  LiveChatWidget.call('maximize')
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
  <div class="flex flex-col pt-4 pb-6 px-6 gap-6 select-none popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('USDT 支付') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)">
      </SvgIcon>
    </div>

    <div class="flex flex-col gap-3">
      <div class="title">{{ $t('订单金额') }}</div>
      <div class="flex items-center gap-4">
        <div class="amount">{{ props.realAmount }} USDT</div>
        <div class="py-1 px-2 tag">TRC-20</div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div class="title">{{ $t('支付地址') }}</div>
      <div class="flex gap-2.5 pa-3 bg-[#F0F3F5] rounded-lg">
        <img :src="qrcode" class="pointer-events-none w-26 h-26" />
        <div class="flex flex-col justify-center gap-2.5">
          <div class="qrcode-desc">{{ $t('复制地址或扫描二维码进行支付') }}</div>
          <div class="flex items-center gap-2">
            <span class="chain">{{ props.payUrl }}</span>
            <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" color="#7C8387" @click="copyLink"></SvgIcon>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 flex items-center pa-3 gap-3 min-h-18 rounded-lg border-1 border-solid border-[#E4E8EB]">
          <div>
            <svg class="progress-circle" width="28" height="28" viewBox="0 0 36 36">
              <circle class="progress-bg" cx="18" cy="18" r="14" />
              <circle class="progress-value" cx="18" cy="18" r="14" :style="{ '--progress': progress, '--stroke-color': -progress > 0.66 ? '#F53838' : '#12a3fc' }" />
            </svg>
          </div>
          <div>
            <div class="remaining">{{ $t('支付剩余时间') }}</div>
            <div class="countdown">{{ countdownText }}</div>
          </div>
        </div>
        <div class="flex-1 flex items-center pa-3 gap-3 min-h-18 rounded-lg border-1 border-solid border-[#E4E8EB]">
          <img class="block loading-circle w-8 h-8" src="/@/assets/images/status/loading.png">
          <div class="status">{{ $t('检查支付状态中...') }}</div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <div class="title">{{ notes.title }}</div>
      <RxAlert class="w-full" :closable="false" type="warn">
        <template #content>
          <div v-for="(item, index) in notes.items" :key="item" class="note">{{ `${index + 1}. ${item}` }}</div>
        </template>
      </RxAlert>
      <i18n-t class="help" tag="div" :keypath="$t('* 支付遇到问题？ {link}', { link: '{link}' })" scope="global">
        <template #link>
          <span class="cursor-pointer help-link" @click="openLiveChat">{{ $t('联系我们') }}</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 480px;
}

.header {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.amount {
  color: #12A3FC;
  font-size: 32px;
  font-weight: 600;
  line-height: normal;
}

.tag {
  border-radius: 4px;
  background: #26A17B;
  color: var(--Color-neutrals-0, #FFF);
  font-family: "JetBrains Mono";
  font-size: 20px;
  font-weight: 700;
  line-height: normal;
}

.qrcode-desc {
  color: var(--colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: normal;
}

.chain {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: "JetBrains Mono";
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.remaining {
  color: var(--colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: normal;
}

.countdown {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
}

.status {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 12px;
  line-height: normal;
}

.note {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 12px;
  font-weight: 500;
  line-height: 19.2px;
}

.help {
  color: var(--colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: 20px;

  &-link {
    color: var(--Colors-Text-text-brand, #12A3FC);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.progress {
  &-value {
    fill: none;
    stroke-width: 4.5;
    stroke-dasharray: calc(2 * 3.14159 * 14);
    stroke: var(--stroke-color, #12A3FC);
    stroke-linecap: round;
    stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  }

  &-circle {
    transform: rotate(-90deg);
  }

  &-bg {
    fill: none;
    stroke: #E8F5FC;
    stroke-width: 4.5;
  }
}
</style>
