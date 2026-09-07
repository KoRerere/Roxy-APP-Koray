<script setup lang="tsx">
import QRCode from 'qrcode'
import { RxAlert } from '/@/components/rx-alert/'

import { usePay } from '/@/views/pay/wallet/hook'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText, enhanceCountdown } from '/@/utils'

interface Props {
  data: Record<string, any>
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

const { data: props, onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits(['close'])

const { genCheckerOrderStatus } = usePay()
const [showToast, onlyErrorToast] = useResponseToast()

const colorMap = {
  'TRC-20': '#26A17B',
  'BEP-20': '#FC9D12',
  'SPL': '#CD51FE',
  'ERC-20': '#293038',
}

const HOUR = 60 * 60 * 1000
const loading = ref(false)
const qrcode = ref()
const stopCountdown = ref()
const countdown = ref()
const checker = genCheckerOrderStatus()

/** 地址上方展示的网络名称、图标与品牌色，字段来自结算接口 */
const chainInfo = computed(() => {
  const alias = props.chainAlias
  const name = props.chainName
  return {
    label: name && alias && name !== alias ? `${name} (${alias})` : (name || alias || ''),
    image: props.chainImage || '',
    color: colorMap[alias as keyof typeof colorMap] || colorMap['TRC-20'],
  }
})

const progress = computed(() => {
  if (!countdown.value) {
    return 0
  }
  return Number((countdown.value.timestamp / HOUR - 1).toFixed(2))
})

const countdownText = computed(() => {
  if (!countdown.value) {
    return '--:--:--'
  }
  const { hours, minutes, seconds } = countdown.value
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const notes = computed(() => ({
  title: $t('注意事项'),
  items: [
    $t('支付金额须准确为 {amount} USDT，否则可能导致无法到账', { amount: props.realAmount }),
    $t('转账时请再次确认地址是否与页面一致'),
  ],
}))

onMounted(() => {
  checkStatus()
  genProxyQrcode()
  stopCountdown.value = enhanceCountdown(new Date(props.endTime), (time) => {
    countdown.value = time
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
  qrcode.value = await QRCode.toDataURL(props.payUrl, { margin: 2.5 })
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

function copyLink() {
  copyText(props.payUrl)
  showToast(0, $t('复制成功'))
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
</script>

<template>
  <div class="flex flex-col pt-4 pb-6 px-6 gap-6 select-none min-w-130">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('{type} 支付', { type: props.payType }) }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)" />
    </div>

    <div class="flex flex-col gap-3">
      <div class="title">
        {{ $t('订单金额') }}
      </div>
      <div class="amount">
        {{ props.realAmount }} {{ props.payType }}
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div class="title">
        {{ $t('支付地址') }}
      </div>
      <div class="flex gap-2.5 pa-3 bg-[var(--colors-background-bg-block)] rounded-lg">
        <img :src="qrcode" class="pointer-events-none w-26 h-26">
        <div class="flex flex-col justify-center gap-4">
          <div class="flex items-center gap-1.5">
            <img v-if="chainInfo.image" :src="chainInfo.image" class="w-5 h-5 shrink-0">
            <span class="tt-primary text-4 font-500 leading-normal" :style="{ color: chainInfo.color }">{{ chainInfo.label }}</span>
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="tt-tertiary text-3 leading-normal">
              {{ $t('复制地址或扫描二维码进行支付') }}
            </div>
            <div class="flex items-center gap-2">
              <span class="chain">{{ props.payUrl }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" color="#7C8387" @click="copyLink" />
            </div>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 flex items-center pa-3 gap-3 min-h-18 rounded-lg other-block">
          <div class="flex items-center justify-center">
            <svg class="progress-circle" width="32" height="32" viewBox="0 0 32 32">
              <circle class="progress-bg" cx="16" cy="16" r="13" />
              <circle class="progress-value" cx="16" cy="16" r="13" :style="{ '--progress': progress, '--stroke-color': -progress > 0.66 ? '#F53838' : '#12a3fc' }" />
            </svg>
          </div>
          <div>
            <div class="remaining">
              {{ $t('支付剩余时间') }}
            </div>
            <div class="countdown">
              {{ countdownText }}
            </div>
          </div>
        </div>
        <div class="flex-1 flex items-center pa-3 gap-3 min-h-18 rounded-lg other-block">
          <img class="block loading-circle w-8 h-8" src="/@/assets/icons/status/loading.png">
          <div class="status">
            {{ $t('检查支付状态中...') }}
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <div class="title">
        {{ notes.title }}
      </div>
      <RxAlert class="w-full" :closable="false" type="warn">
        <template #content>
          <div v-for="(item, index) in notes.items" :key="item" class="note">
            {{ `${index + 1}. ${item}` }}
          </div>
        </template>
      </RxAlert>
      <i18n-t class="help" tag="div" :keypath="$t('* 支付遇到问题？ {link}', { link: '{link}' })" scope="global">
        <template #link>
          <span class="cursor-pointer help-link" @click="$showLiveChat">{{ $t('联系我们') }}</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.amount {
  color: #12a3fc;
  font-size: 32px;
  font-weight: 600;
  line-height: normal;
}

.chain {
  color: var(--colors-text-text-primary);
  font-family: 'JetBrains Mono';
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.other-block {
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
}

.remaining {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: normal;
}

.countdown {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
}

.status {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: normal;
}

.note {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 19.2px;
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

.progress {
  &-value {
    fill: none;
    stroke-width: 4.5;
    stroke-dasharray: calc(2 * 3.14159 * 14);
    stroke: var(--stroke-color, #12a3fc);
    stroke-linecap: round;
    stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  }

  &-circle {
    transform: rotate(-90deg);
  }

  &-bg {
    fill: none;
    stroke: #e8f5fc;
    stroke-width: 4.5;
  }
}
</style>
