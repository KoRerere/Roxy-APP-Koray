<script setup lang="tsx">
import type { QRCodeToDataURLOptions } from 'qrcode'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import ConfigBase from './components/config-base.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useSimpleLocale } from '/@/stores/locale'

const roxyClawStore = useRoxyClawStore()
const [showToast] = useResponseToast()
const locale = useSimpleLocale()
const router = useRouter()

const isLoading = ref(false)
const qrImageUrl = ref('')
const qrCode = ref('')
const statusText = ref('Click the button below to generate a WeChat login QR code.')
const polling = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null

// 添加过。未添加过
const isBind = computed(() => !!roxyClawStore.config.wechat_bot_token)

onMounted(() => {
  if (!isBind.value) {
    generateQrCode()
  }
})

onBeforeUnmount(() => {
  stopPolling()
})

const steps = [
  { text: 'Scan the QR code with WeChat and confirm the login on your phone.' },
]

async function generateQrCode() {
  isLoading.value = true
  stopPolling()

  try {
    const result = await roxyClawStore.getWeixinBotQrcode()
    console.log('getWeixinBotQrcode result', result)
    if (!result.success || !result.data?.qrcode) {
      showToast(1, result.message || 'Failed to get WeChat QR code')
      statusText.value = 'Failed to get QR code. Please try again later.'
      return
    }

    qrCode.value = result.data.qrcode
    qrImageUrl.value = await toQrDataUrl(result.data.qrcodeImgContent)
    polling.value = true
    void pollQrStatus()
  }
  catch (error) {
    console.error('generateQrCode failed:', error)
    showToast(1, 'Failed to get WeChat QR code')
    statusText.value = 'Failed to get QR code. Please try again later.'
  }
  finally {
    isLoading.value = false
  }
}

async function pollQrStatus() {
  if (!polling.value || !qrCode.value) {
    return
  }

  try {
    const result = await roxyClawStore.getWeixinBotQrcodeStatus(qrCode.value)
    if (result.success && result.data) {
      console.log('bot result', result)
      const { status, botToken } = result.data
      if (status === 'wait') {
        scheduleNextPoll()
        return
      }

      if (status === 'confirmed' && botToken) {
        await roxyClawStore.updateConfig({
          wechat_bot_token: botToken,
        })
        stopPolling()
      }

      if (status === 'expired' || status === 'cancelled') {
        polling.value = false
        statusText.value = 'The QR code has expired. Please generate a new one.'
        showToast(1, 'The QR code has expired')
      }
    }
    else {
      scheduleNextPoll()
    }
  }
  catch (error) {
    console.error('pollQrStatus failed:', error)
    scheduleNextPoll()
  }
}

function scheduleNextPoll() {
  stopPolling()
  if (!polling.value) {
    return
  }
  pollTimer = setTimeout(() => {
    void pollQrStatus()
  }, 1000)
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

async function handleSave() {
  if (!roxyClawStore.config.wechat_bot_token) {
    showToast(1, 'Please complete WeChat login first')
    return
  }
  roxyClawStore.connectionStatus.wechat = { checked: true, status: 'success' }
  showToast(0, roxyClawStore.isEnabled ? 'Configuration saved. RoxyClaw will restart.' : 'Configuration saved')
}

async function handleDelete() {
  try {
    stopPolling()
    await roxyClawStore.updateConfig({
      wechat_bot_token: '',
    })

    roxyClawStore.connectionStatus.telegram = { checked: false, status: null }

    const msg = roxyClawStore.isEnabled
      ? $t('配置已删除，RoxyClaw 正在重启中...')
      : $t('配置已删除')
    showToast(0, msg)

    router.push({ name: 'roxy-claw-home' })
  }
  catch (error) {
    console.error('Delete failed:', error)
    showToast(1, 'Failed to remove configuration')
  }
}

async function toQrDataUrl(text: string) {
  const options: QRCodeToDataURLOptions = {
    margin: 1,
    width: 320,
    color: {
      dark: '#111111',
      light: '#FFFFFFFF',
    },
  }
  return QRCode.toDataURL(text, options)
}
</script>

<template>
  <ConfigBase
    title="Integrate with WeChat Bot"
    icon="/images/roxy-claw/wechat.svg"
    bg-color="#3cb46e"
    :steps="steps"
    :is-integrate="locale.siteLocale === 'zh-CN'"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="flex w-full flex-col gap-4 rounded-2xl border border-solid border-[var(--colors-border-border-subtle)] bg-[var(--colors-background-bg-action)] p-5">
      <div class="text-base font-bold text-[var(--colors-text-text-primary)]">
        WeChat QR
      </div>

      <div v-if="qrImageUrl" class="flex flex-col gap-3">
        <img :src="qrImageUrl" class="h-56 w-56 rounded-xl border border-solid border-[var(--colors-border-border-subtle)] bg-white p-2">
      </div>
    </div>
  </ConfigBase>
</template>
