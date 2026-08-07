<script setup lang="tsx">
import type { QRCodeToDataURLOptions } from 'qrcode'
import { compare } from 'compare-versions'
import { getImage } from '/@/utils/basic'
import ConfigBase from './components/config-base.vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { AgentButton } from '../../components/form'

const roxyClawStore = useRoxyClawStore()
const userStore = useUserStore()
const [showToast] = useResponseToast()
const router = useRouter()
const SCAN_INSTALL_MIN_VERSION = '3.9.2'

// 本地状态
const testLoading = ref(false)
const appVersionResolved = ref(!globalThis.isElectron || !!globalThis.$appVersion || !!userStore.appVersion)
const currentAppVersion = ref(globalThis.$appVersion || '')
const configReady = ref(false)
const scanLoading = ref(false)
const scanPolling = ref(false)
const scanQrImageUrl = ref('')
const scanInstallId = ref('')
const scanQrExpired = ref(false)
const scanStatusText = ref('')
const scanCompleted = ref(false)
const larkEnvironment = ref<'lark' | 'feishu'>('feishu')
const appId = ref('')
const appSecret = ref('')
let scanPollTimer: ReturnType<typeof setTimeout> | null = null
const environmentOptions = [
  { label: 'Lark', value: 'lark' },
  { label: $t('飞书'), value: 'feishu' },
]

const isLarkConfigured = computed(() => !!roxyClawStore.config.lark_app_id && !!roxyClawStore.config.lark_app_secret)
const effectiveAppVersion = computed(() => userStore.appVersion || currentAppVersion.value || globalThis.$appVersion || '0.0.0')
const useScanMode = computed(() => {
  try {
    return compare(effectiveAppVersion.value, SCAN_INSTALL_MIN_VERSION, '>')
  }
  catch (error) {
    console.warn('Lark scan mode version compare failed', effectiveAppVersion.value, error)
    return false
  }
})

// 从 store 加载数据
onMounted(async () => {
  try {
    if (!appVersionResolved.value && globalThis.electronAPI?.send) {
      currentAppVersion.value = await globalThis.electronAPI.send('app:getAppVersion')
    }
  }
  catch (error) {
    console.warn('Get app version failed for Lark config', error)
  }
  finally {
    appVersionResolved.value = true
  }

  const config = await roxyClawStore.fetchConfig()
  larkEnvironment.value = config.lark_environment || 'feishu'
  appId.value = config.lark_app_id
  appSecret.value = config.lark_app_secret
  configReady.value = true
})

onBeforeUnmount(() => {
  stopScanPolling(true)
})

watch([useScanMode, configReady], ([enabled, ready]) => {
  if (enabled && ready && !scanQrImageUrl.value && !scanLoading.value) {
    void startScanInstall()
  }
}, { immediate: true })

// setupFields 响应式
const setupFields = computed(() => [
  {
    field: 'environment',
    label: $t('平台'),
    type: 'select',
    options: environmentOptions,
    value: larkEnvironment.value,
    required: true,
  },
  {
    field: 'appId',
    label: $t('App ID'),
    placeholder: '123456789',
    value: appId.value,
    required: true,
  },
  {
    field: 'appSecret',
    label: $t('App Secret'),
    placeholder: '123456789:AaBbCcDdEe...',
    hasTestButton: true,
    testButtonText: $t('测试'),
    value: appSecret.value,
    loading: testLoading.value,
    type: 'password',
    required: true,
  },
])

const permissions = [
  'im:message',
  'im:message.p2p_msg:readonly',
  'im:message.group_at_msg:readonly',
  'im:message:send_as_bot',
  'im:message:update',
]

function Step3() {
  return (
    <div class="flex flex-col gap-2 mb-3">
      {$t('在「权限管理」→「开通权限」申请下方的所需的权限')}
      <div class="content-start flex flex-wrap gap-[4px_10px] items-start relative shrink-0 w-full">
        {
          permissions.map((permission) => {
            return (
              <div
                class="bg-[var(--colors-background-bg-action)] border border-[var(--colors-border-border-subtle)] border-solid content-stretch flex items-center justify-center px-2 py-1 relative rounded-1 "
              >
                <div class="flex flex-col font-['JetBrains_Mono'] font-normal justify-center relative  text-[14px] text-[var(--colors-text-text-primary)] whitespace-nowrap text-3">
                  { permission }
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

const steps = [
  { text: $t('访问飞书开放平台，点击「创建企业自建应用」') },
  { text: $t('在「添加应用能力」中找到机器人，点击「添加」') },
  { component: Step3 },
  { text: $t('在「事件与回调」→点击「订阅方式」，选择「使用长连接接收事件」，点击「保存」') },
  { text: $t('在下方点击「添加事件」→ 搜索「接收信息」，选择「im.message.receive_v1」，点击「添加」→ 选择「确认开通权限」') },
  { text: $t('在「版本管理与发布」→ 点击「创建版本」，输入应用版本号和更新说明，点击「保存」→ 选择「确认发布」') },
  { text: $t('在「凭证与基础信息」页复制 App ID 和 App Secret 粘贴到下方的配置框中 → 点击「测试」') },
  { text: $t('启动「RoxyClaw」，发送一条消息给你的飞书机器人，出现回复即可成功') },
]

/**
 * 处理字段值变化（只更新本地状态，不调用接口）
 */
function handleFieldUpdate(field: string, value: string) {
  if (field === 'environment') {
    larkEnvironment.value = value as 'lark' | 'feishu'
  }
  else if (field === 'appId') {
    appId.value = value
  }
  else if (field === 'appSecret') {
    appSecret.value = value
  }
}

/**
 * 处理删除配置
 */
async function handleDelete() {
  try {
    await roxyClawStore.updateConfig({
      lark_app_id: '',
      lark_app_secret: '',
      lark_allowed_chat_ids: [],
    })
    roxyClawStore.connectionStatus.lark = { checked: false, status: null }

    const msg = roxyClawStore.isEnabled
      ? $t('配置已删除，RoxyClaw 正在重启中...')
      : $t('配置已删除')
    showToast(0, msg)

    router.push({ name: 'agent-console-roxyclaw' })
  }
  catch (error) {
    console.error('Delete failed:', error)
    showToast(1, $t('配置删除失败'))
  }
}

/**
 * 处理保存按钮点击（调用接口更新所有配置）
 */
async function handleSave() {
  try {
    await roxyClawStore.updateConfig({
      lark_environment: larkEnvironment.value,
      lark_app_id: appId.value,
      lark_app_secret: appSecret.value,
    })

    // 重置连接状态，下次进入主页面时重新检测
    roxyClawStore.connectionStatus.lark = { checked: false, status: null }

    const msg = roxyClawStore.isEnabled
      ? $t('配置保存成功，RoxyClaw 正在重启中...')
      : $t('配置保存成功')
    showToast(0, msg)
  }
  catch (error) {
    console.error('Save failed:', error)
    showToast(1, $t('配置保存失败'))
  }
}

/**
 * 处理测试
 */
async function handleTest(field: string) {
  if (field === 'appSecret') {
    testLoading.value = true
    try {
      const result = await roxyClawStore.testLark(appId.value, appSecret.value, larkEnvironment.value)
      showToast(result.success ? 0 : 1, result.message || 'Unknown error')
    }
    catch (error) {
      showToast(1, 'Network error')
    }
    finally {
      testLoading.value = false
    }
  }
}

async function startScanInstall() {
  scanLoading.value = true
  scanQrExpired.value = false
  scanCompleted.value = false
  scanStatusText.value = $t('正在生成二维码...')
  stopScanPolling(true)

  try {
    const result = await roxyClawStore.startLarkScanInstall()
    if (!result.success || !result.data) {
      showToast(1, result.message || $t('二维码生成失败'))
      scanStatusText.value = result.message || $t('二维码生成失败')
      return
    }

    scanInstallId.value = result.data.installId
    scanQrImageUrl.value = await toQrDataUrl(result.data.qrUrl)
    scanPolling.value = true
    scanStatusText.value = $t('请使用飞书或 Lark 扫码授权')
    scheduleScanPoll(1000)
  }
  catch (error) {
    console.error('startScanInstall failed:', error)
    showToast(1, $t('二维码生成失败'))
    scanStatusText.value = $t('二维码生成失败')
  }
  finally {
    scanLoading.value = false
  }
}

async function pollScanStatus() {
  if (!scanPolling.value || !scanInstallId.value)
    return

  try {
    const result = await roxyClawStore.getLarkScanInstallStatus(scanInstallId.value)
    if (!result.success || !result.data) {
      scanStatusText.value = result.message || $t('扫码状态获取失败')
      scheduleScanPoll()
      return
    }

    const { status, interval, result: installResult, error } = result.data
    if (status === 'connected' && installResult) {
      scanStatusText.value = $t('授权成功，正在保存配置...')
      await roxyClawStore.completeLarkScanInstall(installResult)
      larkEnvironment.value = installResult.environment
      appId.value = installResult.appId
      appSecret.value = installResult.appSecret
      scanCompleted.value = true
      stopScanPolling(false)
      scanStatusText.value = $t('扫码接入成功')
      showToast(0, roxyClawStore.isEnabled ? $t('配置保存成功，RoxyClaw 正在重启中...') : $t('配置保存成功'))
      return
    }

    if (status === 'expired') {
      scanQrExpired.value = true
      scanStatusText.value = $t('二维码已过期，请重新生成')
      stopScanPolling(false)
      return
    }

    if (status === 'cancelled') {
      scanStatusText.value = $t('扫码接入已取消')
      stopScanPolling(false)
      return
    }

    if (status === 'error') {
      scanStatusText.value = error || $t('扫码接入失败')
      scanQrExpired.value = true
      stopScanPolling(false)
      return
    }

    scanStatusText.value = getScanStatusText(status)
    scheduleScanPoll(interval ? interval * 1000 : undefined)
  }
  catch (error) {
    console.error('pollScanStatus failed:', error)
    scanStatusText.value = $t('扫码状态获取失败')
    scheduleScanPoll()
  }
}

function getScanStatusText(status: string) {
  if (status === 'domain_switched')
    return $t('已识别为 Lark 租户，继续等待授权')
  if (status === 'slow_down')
    return $t('轮询过快，已自动放慢检测频率')
  if (status === 'polling')
    return $t('等待授权确认...')
  return $t('请使用飞书或 Lark 扫码授权')
}

function scheduleScanPoll(delay = 2000) {
  clearScanPollTimer()
  if (!scanPolling.value)
    return
  scanPollTimer = setTimeout(() => void pollScanStatus(), delay)
}

function clearScanPollTimer() {
  if (scanPollTimer) {
    clearTimeout(scanPollTimer)
    scanPollTimer = null
  }
}

function stopScanPolling(cancelInstall: boolean) {
  clearScanPollTimer()
  scanPolling.value = false
  if (cancelInstall && scanInstallId.value && !scanCompleted.value) {
    void roxyClawStore.cancelLarkScanInstall(scanInstallId.value)
  }
  if (cancelInstall) {
    scanInstallId.value = ''
  }
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
    v-if="!appVersionResolved"
    :title="$t('集成到 Lark/飞书 机器人')"
    :icon="getImage('roxy-claw/lark.png')"
    bg-color="#fff"
    not-action-buttons
  >
    <div class="flex items-center justify-center w-full py-10">
      <i class="i-svg-spinners:180-ring-with-bg text-8 text-[var(--colors-icon-icon-brand)]" />
    </div>
  </ConfigBase>

  <ConfigBase
    v-else-if="useScanMode"
    :title="$t('集成到 Lark/飞书 机器人')"
    :icon="getImage('roxy-claw/lark.png')"
    bg-color="#fff"
    not-action-buttons
  >
    <div class="flex flex-col gap-16 items-center w-full">
      <div class="flex flex-col gap-16 items-center w-full">
        <div class="font-600 text-[16px] text-[var(--color-text-primary,#141414)] text-center w-full">
          {{ $t('使用飞书或 Lark 扫描下方二维码，接入 RoxyClaw 机器人。') }}
        </div>

        <div class="relative border border-solid border-[var(--color-border-secondary,#e5e5e5)] rounded-4 overflow-clip size-200px p-5">
          <img v-if="scanQrImageUrl && !scanLoading" :src="scanQrImageUrl" class="w-full" :class="isLarkConfigured || scanCompleted || scanQrExpired ? 'opacity-40' : ''">

          <div v-if="isLarkConfigured || scanCompleted" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--colors-background-bg-success,#e9fceb)] border border-solid border-[var(--colors-border-border-success,#6cea87)] flex gap-1 items-center justify-center px-2 py-1 rounded-full">
            <SvgIcon name="base/rx_ic_check_fill" size="14" class="text-[var(--colors-text-text-success,#1dc94d)]" />
            <span class="font-bold text-[12px] text-[var(--colors-text-text-success,#1dc94d)] whitespace-nowrap">
              {{ $t('接入成功') }}
            </span>
          </div>

          <div v-if="scanQrExpired" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <AgentButton
              variant="secondary"
              :icon="false"
              :label="$t('重新生成')"
              @click="startScanInstall"
            />
          </div>
        </div>

        <div class="bg-[var(--color-bg-tertiary,#f5f5f5)] flex flex-col gap-[10px] items-start overflow-clip p-6 rounded-[16px] w-full">
          <div class="flex flex-col gap-4 w-full">
            <div v-for="(item, index) in [$t('扫描上方二维码以授权创建 RoxyClaw 机器人。'), $t('授权成功后会自动保存配置，并将扫码用户加入访问白名单。')]" :key="index" class="flex gap-3 items-start w-full">
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
            {{ scanStatusText || $t('请使用飞书或 Lark 扫码授权') }}
          </span>
        </div>
      </div>

      <div v-if="isLarkConfigured" class="flex gap-[10px] justify-end w-full">
        <AgentButton
          variant="danger"
          :icon="false"
          :label="$t('删除配置')"
          @click="handleDelete"
        />
      </div>
    </div>
  </ConfigBase>

  <ConfigBase
    v-else
    :title="$t('集成到 Lark/飞书 机器人')"
    :icon="getImage('roxy-claw/lark.png')"
    bg-color="#fff"
    :steps="steps"
    :setup-fields="setupFields"
    :permissions="permissions"
    @update:field-value="handleFieldUpdate"
    @test="handleTest"
    @save="handleSave"
    @delete="handleDelete"
  />
</template>
