<script setup lang="tsx">
import { getImage } from '/@/utils/basic'
import type { QRCodeToDataURLOptions } from 'qrcode'
import { h, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useDialog } from '/@/hooks/useDialog'
import ConfigBase from './components/config-base.vue'
import { useSimpleLocale } from '/@/stores/locale'
import { AgentButton } from '../../components/form'

const roxyClawStore = useRoxyClawStore()
const [showToast] = useResponseToast()
const router = useRouter()
const [showModal] = useDialog()
const locale = useSimpleLocale()

const isLoading = ref(false)
const qrImageUrl = ref('')
const qrCode = ref('')
const qrExpired = ref(false)
const polling = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const isBind = computed(() => !!roxyClawStore.config.wechat_bot_token)

onMounted(() => {
  generateQrCode()
})

onBeforeUnmount(() => {
  stopPolling()
})

async function generateQrCode() {
  isLoading.value = true
  qrExpired.value = false
  stopPolling()

  try {
    const result = await roxyClawStore.getWeixinBotQrcode()
    if (!result.success || !result.data?.qrcode) {
      showToast(1, result.message || 'Failed to get WeChat QR code')
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
  }
  finally {
    isLoading.value = false
  }
}

async function pollQrStatus() {
  if (!polling.value || !qrCode.value)
    return

  try {
    const result = await roxyClawStore.getWeixinBotQrcodeStatus(qrCode.value)
    console.log('result', result)
    if (result.success && result.data) {
      const { status, botToken } = result.data
      if (status === 'wait') {
        scheduleNextPoll()
        return
      }

      if (status === 'confirmed' && botToken) {
        await roxyClawStore.updateConfig({ wechat_bot_token: botToken })
        roxyClawStore.connectionStatus.wechat = { checked: true, status: 'success' }
        stopPolling()
      }

      if (status === 'expired' || status === 'cancelled') {
        qrExpired.value = true
        stopPolling()
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
  if (!polling.value)
    return
  pollTimer = setTimeout(() => void pollQrStatus(), 1000)
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function handleDelete() {
  showModal({
    header: $t('删除配置'),
    modal: true,
    okText: $t('确认删除'),
    okProps: { severity: 'danger' },
    slots: {
      default: () => h('p', {
        class: 'text-[var(--colors-text-text-secondary)] text-[14px] leading-[1.6] my-0',
      }, $t('此操作将清空 WeChat 的所有配置，确认继续？')),
    },
    handleOk: async () => {
      try {
        stopPolling()
        await roxyClawStore.updateConfig({ wechat_bot_token: '' })
        roxyClawStore.connectionStatus.wechat = { checked: false, status: null }
        const msg = roxyClawStore.isEnabled
          ? $t('配置已删除，RoxyClaw 正在重启中...')
          : $t('配置已删除')
        showToast(0, msg)
        router.push({ name: 'agent-console-roxyclaw' })
      }
      catch (error) {
        console.error('Delete failed:', error)
        showToast(1, 'Failed to remove configuration')
      }
    },
  })
}

async function toQrDataUrl(text: string) {
  const options: QRCodeToDataURLOptions = {
    margin: 1,
    width: 320,
    color: { dark: '#111111', light: '#FFFFFFFF' },
  }
  return QRCode.toDataURL(text, options)
}
</script>

<template>
  <ConfigBase
    :title="$t('集成到微信 ClawBot')"
    :icon="getImage('roxy-claw/wechat.svg')"
    bg-color="#1dc94d"
    :is-integrate="locale.siteLocale === 'zh-CN'"
    not-action-buttons
  >
    <!-- Content -->
    <div class="flex flex-col gap-16 items-center w-full">
      <!-- QR scan flow (not bound) -->
      <div class="flex flex-col gap-16 items-center w-full">
        <!-- Title -->
        <div class="font-600 text-[16px] text-[var(--color-text-primary,#141414)] text-center w-full">
          {{ $t('扫描下方二维码，关联您的微信账号。') }}
        </div>

        <!-- QR Code: active -->
        <div class="relative border border-solid border-[var(--color-border-secondary,#e5e5e5)] rounded-4 overflow-clip size-200px p-5">
          <img v-if="qrImageUrl && !isLoading" :src="qrImageUrl" class="w-full" :class="isBind || qrExpired ? 'opacity-40' : ''">

          <div v-if="isBind" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--colors-background-bg-success,#e9fceb)] border border-solid border-[var(--colors-border-border-success,#6cea87)] flex gap-1 items-center justify-center px-2 py-1 rounded-full">
            <SvgIcon name="base/rx_ic_check_fill" size="14" class="text-[var(--colors-text-text-success,#1dc94d)]" />
            <span class="font-bold text-[12px] text-[var(--colors-text-text-success,#1dc94d)] whitespace-nowrap">
              {{ $t('绑定成功') }}
            </span>
          </div>

          <div v-if="qrExpired" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <AgentButton
              variant="secondary"
              :icon="false"
              :label="$t('重新生成')"
              @click="generateQrCode"
            />
          </div>
        </div>

        <!-- Step guide -->
        <div class="bg-[var(--color-bg-tertiary,#f5f5f5)] flex flex-col gap-[10px] items-start overflow-clip p-6 rounded-[16px] w-full">
          <div class="flex flex-col gap-4 w-full">
            <div v-for="(item, index) in [$t('扫描上方二维码以关联您的微信账号。'), $t('在微信提示界面中，点击“连接”以绑定您的 RoxyClaw 账号。')]" :key="index" class="flex gap-3 items-start w-full">
              <div class="bg-[#0f0f0f] flex items-center justify-center rounded-full shrink-0 size-6">
                <span class="font-bold text-[12px] text-white">{{ index + 1 }}</span>
              </div>
              <span class="text-[14px] leading-[20px] text-[var(--color-text-primary,#141414)]">
                {{ item }}
              </span>
            </div>
          </div>
          <div class="w-full border-t border-t-solid border-t-[var(--color-border-secondary,#e5e5e5)]" />
          <span class="text-[14px] leading-[20px] text-[var(--color-text-primary,#141414)]">
            {{ $t('* 请确保您的微信支持 OpenClaw 扩展功能。') }}
          </span>
        </div>
      </div>

      <!-- Disconnect button -->
      <div v-if="isBind" class="flex gap-[10px] justify-end w-full">
        <AgentButton
          variant="danger"
          :icon="false"
          :label="$t('删除配置')"
          @click="handleDelete"
        />
      </div>
    </div>
  </ConfigBase>
</template>
