<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
import type { UserCheckProxyBindRiskCreateData } from '@roxy/backend-api'
import { RxAlert } from '/@/components/rx-alert'
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'
import DeviceDetectFeedback from '/@/views/ecommerce/devices/components/device-detect-feedback.vue'
import DeviceExpireCell from '/@/views/ecommerce/devices/components/device-expire-cell.vue'
import {
  BIND_RISK_CHECK_STEPS,
  BIND_RISK_RISK_STEP_START,
  buildDeviceInfoFromDetection,
  calcCheckingStepComplete,
  calcCheckingStepProgress,
  resolveDeviceProxyForDetection,
  useDeviceDetection,
} from '/@/views/ecommerce/devices/hooks/useDeviceDetection'
import type { BindRiskFormContext, EcommerceDeviceInfo } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import { PROXY_BIND_RISK_NOT_REMIND_KEY } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import { API } from '/@/api'
import { ProxyType } from '/@/enums/proxy'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { sleep } from '/@/utils'
import type { CheckResult } from '/@/views/agent/hooks'

type RiskLevel = 'none' | 'medium' | 'high'

type BindingRecord = NonNullable<UserCheckProxyBindRiskCreateData['data']>['bindingRecords'][number]

interface Props {
  /** 待检测的设备 ID */
  proxyId: string
  /** 待绑定的平台 displayId */
  displayId: string
  /** 账号窗口 ID（列表绑定场景传入，取账号 id） */
  windowId?: number
  /** 表单中的账号平台与绑定设备信息 */
  formContext: BindRiskFormContext
  /** 设备完整信息，用于连通性检测；缺省时按 proxyId 拉取详情 */
  deviceProxy?: Record<string, unknown>
}

type ModalPhase = 'checking' | 'device-failed' | 'result' | 'error'

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  reselect: []
  continue: []
}>()

const CHECK_STEPS = BIND_RISK_CHECK_STEPS
const RISK_CHECK_STEP_START = BIND_RISK_RISK_STEP_START

const phase = ref<ModalPhase>('checking')
const progress = ref(0)
const activeStep = ref(0)
const riskResult = ref<UserCheckProxyBindRiskCreateData['data'] | null>(null)
const notRemind = ref(false)
const deviceCheckResult = ref<CheckResult | null>(null)
const deviceCheckPassed = ref(false)
const resolvedDeviceInfo = ref<EcommerceDeviceInfo | null>(props.formContext.deviceInfo)

const { runDeviceDetection } = useDeviceDetection()
const { userPayInfo } = storeToRefs(useUserStore())
const [, onlyErrorToast] = useResponseToast()

/** 检测阶段顶部提示：首步为设备连通性，后续为绑定风险 */
const checkingAlertText = computed(() => {
  return activeStep.value === 0
    ? $t('正在检测设备连通性...')
    : $t('正在检测设备绑定风险...')
})

/** 当前整体风险等级 */
const riskLevel = computed<RiskLevel>(() => {
  const level = riskResult.value?.riskLevel ?? 'none'
  if (level === 'medium' || level === 'high')
    return level
  return 'none'
})

/** 接口返回的历史绑定记录 */
const bindingRecords = computed<BindingRecord[]>(() => {
  return riskResult.value?.bindingRecords ?? []
})

/** 是否展示中/高风险详情区块 */
const showRiskDetails = computed(() => {
  return riskLevel.value !== 'none' && bindingRecords.value.length > 0
})

/** 顶部风险提示文案 */
const overallRiskConfig = computed(() => {
  const configMap = {
    none: {
      type: 'success' as const,
      title: $t('无风险：暂未检测到风险'),
    },
    medium: {
      type: 'warn' as const,
      title: $t('中风险：出口国家不匹配。建议确认设备出口地区是否适用于账号平台，确认无误后可继续绑定'),
    },
    high: {
      type: 'error' as const,
      title: $t('高风险：检测到该设备绑定过相同平台账号，可能影响账号安全，建议重新选择设备'),
    },
  }
  return configMap[riskLevel.value]
})

/** 表单账号平台展示名 */
const platformLabel = computed(() => {
  const platform = props.formContext.accountPlatform
  return platform?.displayName || platform?.name || platform?.url || '--'
})

/** 当前选中设备在表格中的展示行 */
const deviceExitRows = computed<Array<EcommerceDeviceInfo & { riskLevel?: string }>>(() => {
  const deviceInfo = resolvedDeviceInfo.value
  if (!deviceInfo)
    return []

  return [{
    ...deviceInfo,
    riskLevel: riskResult.value?.riskLevel,
  }]
})

onMounted(() => {
  runCheck()
})

function getRowRiskMeta(level?: string) {
  const value = level ?? riskResult.value?.riskLevel ?? 'none'
  const map = {
    none: { label: $t('无风险'), className: 'tt-success' },
    medium: { label: $t('中风险'), className: 'tt-warning' },
    high: { label: $t('高风险'), className: 'text-[var(--colors-text-text-error)]' },
  }
  return map[value as keyof typeof map] ?? map.none
}

/**
 * 格式化设备出口地址
 */
function formatExitAddress(item: EcommerceDeviceInfo) {
  const country = item.lastCountry || '--'
  const ip = item.lastIp || '--'
  return `${country} · ${ip}`
}

/**
 * 格式化来源文案，与设备列表列配置保持一致
 */
function formatSource(item: EcommerceDeviceInfo) {
  return item.proxyType === ProxyType.buy ? $t('购买') : $t('添加')
}

/**
 * 格式化绑定状态
 */
function formatBindStatus(record: BindingRecord) {
  return record.bindStatusLabel || record.bindStatus || '--'
}

const exitTableColumns = [
  {
    title: $t('设备出口'),
    key: 'exit',
    slot: 'exit',
  },
  {
    title: $t('来源'),
    key: 'proxyType',
    getText: (data: EcommerceDeviceInfo) => formatSource(data),
  },
  {
    title: $t('到期时间'),
    key: 'expireDate',
    slot: 'expireDate',
  },
  {
    title: $t('风险等级'),
    key: 'riskLevel',
    slot: 'riskLevel',
  },
]

const riskDetailColumns = [
  {
    title: $t('账号名'),
    key: 'windowName',
  },
  {
    title: $t('电商平台'),
    key: 'platform',
    slot: 'platform',
  },
  {
    title: $t('登录账号'),
    key: 'platformUserName',
    getText: (data: BindingRecord) => data.platformUserName || '--',
  },
  {
    title: $t('绑定状态'),
    key: 'bindStatus',
    slot: 'bindStatus',
  },
]

/**
 * 绑定风险检测过程中同步推进进度条与步骤态（从第二步起）
 */
async function animateRiskCheckingProgress(apiPromise: Promise<UserCheckProxyBindRiskCreateData>) {
  const stepDuration = 500
  const totalSteps = CHECK_STEPS.length

  for (let index = RISK_CHECK_STEP_START; index < totalSteps; index++) {
    activeStep.value = index
    progress.value = calcCheckingStepProgress(index, totalSteps)
    await sleep(stepDuration)
  }

  const response = await apiPromise
  progress.value = 100
  activeStep.value = totalSteps
  await sleep(250)
  return response
}

function setCheckingStep(index: number) {
  activeStep.value = index
  progress.value = calcCheckingStepProgress(index, CHECK_STEPS.length)
}

/** 执行设备连通性检测，失败则进入 device-failed 阶段 */
async function runDeviceConnectivityCheck() {
  setCheckingStep(0)

  const deviceProxy = await resolveDeviceProxyForDetection(
    props.proxyId,
    props.deviceProxy,
    onlyErrorToast,
  )
  const detection = await runDeviceDetection(deviceProxy, {
    isDirect: userPayInfo.value.isDirectWhitelist,
    enableHistoryCheck: false,
  })

  deviceCheckResult.value = detection.checkResult

  if (detection.phase === 'connectivity-failed') {
    phase.value = 'device-failed'
    return false
  }

  deviceCheckPassed.value = true
  resolvedDeviceInfo.value = buildDeviceInfoFromDetection(deviceProxy, detection.checkResult, props.proxyId)
  activeStep.value = RISK_CHECK_STEP_START
  progress.value = calcCheckingStepComplete(RISK_CHECK_STEP_START, CHECK_STEPS.length)
  return true
}

async function runCheck(options: { skipDeviceCheck?: boolean } = {}) {
  phase.value = 'checking'
  progress.value = 0
  activeStep.value = 0
  riskResult.value = null

  if (!options.skipDeviceCheck) {
    deviceCheckResult.value = null
    deviceCheckPassed.value = false
  }

  try {
    if (!options.skipDeviceCheck) {
      const passed = await runDeviceConnectivityCheck()
      if (!passed)
        return
    }
    else {
      activeStep.value = RISK_CHECK_STEP_START
      progress.value = calcCheckingStepComplete(RISK_CHECK_STEP_START, CHECK_STEPS.length)
    }

    const apiPromise = API.proxy.userCheckProxyBindRiskCreate({
      proxyId: props.proxyId,
      displayId: props.displayId,
      ...(props.windowId != null ? { windowId: props.windowId } : {}),
    })

    const { code, data, msg } = await animateRiskCheckingProgress(apiPromise)

    if (code !== 0) {
      onlyErrorToast(code, msg)
      phase.value = 'error'
      return
    }

    riskResult.value = data
    phase.value = 'result'
  }
  catch (error) {
    console.error('[ProxyBindRiskModal] check failed', error)
    phase.value = 'error'
  }
}

function handleClose() {
  emit('close')
}

function handleReselect() {
  emit('reselect')
}

function handleContinue() {
  if (notRemind.value)
    localStorage.setItem(PROXY_BIND_RISK_NOT_REMIND_KEY, 'true')
  emit('continue')
}
</script>

<template>
  <div class="flex flex-col gap-4 pa-6 pt-4 rounded-2" :class="[['device-failed', 'error'].includes(phase) ? 'w-120' : 'w-160']">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('设备详情') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="handleClose" />
    </div>
    <template v-if="phase === 'checking'">
      <RxAlert class="w-full" type="info" :closable="false" :content="checkingAlertText" />
      <div class="checking-panel flex flex-col gap-4 pa-4 rounded-3">
        <ProgressBar :value="progress" :show-value="false" class="risk-progress" />
        <div class="grid grid-cols-4 gap-3">
          <div v-for="(step, index) in CHECK_STEPS" :key="step" class="flex items-center gap-1.5 min-w-0">
            <SvgIcon :name="index < activeStep ? 'base/rx_ic_check' : 'base/rx_ic_magnify'" size="16"
                     :color="index <= activeStep ? 'var(--colors-icon-icon-brand)' : 'var(--colors-icon-icon-tertiary)'" class="shrink-0"
            />
            <span class="tt-secondary text-3 leading-4 truncate">{{ step }}</span>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="phase === 'device-failed'">
      <DeviceDetectFeedback phase="connectivity-failed" :check-result="deviceCheckResult" :show-history-check="false" />
      <div class="flex justify-end gap-2">
        <RxButton :label="$t('重新选择')" outlined severity="secondary" @click="handleReselect" />
        <RxButton :label="$t('重新检测')" @click="runCheck" />
      </div>
    </template>

    <template v-else-if="phase === 'error'">
      <RxAlert class="w-full" type="error" :closable="false" :content="$t('检测失败，请重试')" />
      <div class="flex justify-end gap-2">
        <RxButton :label="$t('取消')" outlined severity="secondary" @click="handleClose" />
        <RxButton :label="$t('重新检测')" @click="deviceCheckPassed ? runCheck({ skipDeviceCheck: true }) : runCheck()" />
      </div>
    </template>

    <!-- 检测结果 -->
    <template v-else>
      <RxAlert class="w-full" v-bind="overallRiskConfig" :closable="false" />

      <div class="account-card flex flex-col gap-3 pa-4 rounded-3">
        <div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <div class="flex flex-col gap-1.5">
            <div class="tt-tertiary text-3 leading-4">
              {{ $t('账号信息') }}
            </div>
            <div class="flex items-center gap-2 min-w-0">
              <PlatformIcon v-if="formContext.accountPlatform?.platformIcon" :platform-icon="formContext.accountPlatform.platformIcon"
                            :platform-icon-dark="formContext.accountPlatform.platformIconDark" class="w-4 shrink-0"
              />
              <SvgIcon v-else name="base/rx_ic_user_key" size="24" color="var(--colors-icon-icon-tertiary)" class="shrink-0" />
              <div class="flex items-center gap-2 min-w-0 tt-primary text-3.25 leading-4.5 font-500">
                <span class="truncate">{{ formContext.windowName || '--' }}</span>
                <RxDivider v-if="platformLabel !== '--'" vertical line-only class="!ma-0 !h-4 shrink-0" line-color="var(--colors-border-border-subtle)" />
                <span class="truncate">{{ platformLabel }}</span>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="tt-tertiary text-3 leading-4">
              {{ $t('登录账号') }}
            </div>
            <div class="tt-primary text-3.25 leading-4.5 font-500">
              {{ formContext.platformUserName || '--' }}
            </div>
          </div>
        </div>
      </div>

      <RyTable v-if="deviceExitRows.length" data-key="lastIp" :columns="exitTableColumns" :data-list="deviceExitRows" :paginator="false" :show-actions="false" :show-table-header="false">
        <template #exit="{ data }">
          <div class="flex items-center gap-2 min-w-0">
            <SvgIcon :name="(`country-code/${data.lastCountry}` as any)" fallback="base/rx_ic_earth" size="20" class="shrink-0" />
            <span class="tt-primary text-3.25 leading-4.5 truncate">{{ formatExitAddress(data) }}</span>
          </div>
        </template>
        <template #expireDate="{ data }">
          <DeviceExpireCell :data="data" />
        </template>
        <template #riskLevel="{ data }">
          <span class="text-3.25 leading-4.5 font-500" :class="getRowRiskMeta(data.riskLevel).className">
            {{ getRowRiskMeta(data.riskLevel).label }}
          </span>
        </template>
      </RyTable>

      <div v-if="showRiskDetails" class="flex flex-col gap-2">
        <div class="shrink-0 tt-primary text-3.5 font-600 leading-5">
          {{ $t('风险详情') }}
        </div>
        <RyTable scroll-height="200px" data-key="windowName" :columns="riskDetailColumns" :data-list="bindingRecords" :paginator="false" :show-actions="false" :show-table-header="false">
          <template #platform="{ data }">
            <div class="flex items-center gap-2 min-w-0">
              <PlatformIcon v-if="formContext.accountPlatform?.platformIcon && data.platform === platformLabel" :platform-icon="formContext.accountPlatform.platformIcon"
                            :platform-icon-dark="formContext.accountPlatform.platformIconDark" class="w-5 shrink-0"
              />
              <span class="tt-primary text-3.25 leading-4.5 truncate">{{ data.platform || '--' }}</span>
            </div>
          </template>
          <template #bindStatus="{ data }">
            <span class="tt-primary text-3.25 leading-4.5">{{ formatBindStatus(data) }}</span>
          </template>
        </RyTable>
      </div>

      <div class="flex items-center justify-between pt-1">
        <div class="flex items-center gap-2">
          <RxCheckbox v-model="notRemind" input-id="proxyBindRiskNotRemind" binary />
          <label class="tt-secondary text-3 select-none cursor-pointer" for="proxyBindRiskNotRemind">
            {{ $t('该风险不再提醒') }}
          </label>
        </div>
        <div class="flex items-center gap-2">
          <RxButton size="md" :label="$t('重新选择')" outlined severity="secondary" @click="handleReselect" />
          <RxButton size="md" :label="$t('继续绑定')" @click="handleContinue" />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-datatable-table) {
  padding-bottom: 0;
}

.checking-panel,
.account-card {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-block);
}

.risk-progress {
  height: 8px;

  :deep(.p-progressbar-value) {
    background: var(--colors-background-bg-brand, #12a3fc);
  }

  :deep(.p-progressbar-label) {
    display: none;
  }
}

.risk-tag {
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--colors-border-border-brand, #12a3fc);
  color: var(--colors-text-text-brand, #12a3fc);
  font-size: 12px;
  line-height: 20px;
}
</style>
