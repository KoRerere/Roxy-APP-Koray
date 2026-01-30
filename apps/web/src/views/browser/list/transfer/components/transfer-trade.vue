<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { RxAlert } from '/@/components/rx-alert'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { enhanceCountdown, validateEmail, validatePhone } from '/@/utils'
import { ProxyCheckStatus } from '/@/enums/proxy'

defineOptions({ inheritAttrs: false })

const { ids: windowIds, datas } = defineProps<{
  ids: number[]
  datas: Record<string, any>[]
}>()

const emit = defineEmits(['confirm', 'resize'])

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const [_, onlyErrorToast] = useResponseToast()

const expireDays = ref(0)
const targetEmail = ref()
const step2 = ref(false)
const emailCode = ref()
const countdown = ref()
const stopCountdown = ref()

const optionsGroup = [
  {
    title: $t('投送选项'),
    options: [
      {
        label: $t('窗口名称'),
        value: 'name',
        disabled: true,
      },
      {
        label: $t('窗口备注'),
        value: 'notes',
      },
      {
        label: $t('窗口代理 IP'),
        value: 'tradeProxy',
      },
      {
        label: $t('窗口平台账号'),
        value: 'tradePlatform',
      },
    ],
  },
]
const transferParam = ref<string[]>(['name', 'notes', 'tradeProxy', 'tradePlatform'])

const isReady = computed(() => {
  return transferParam.value.some(item => item === 'tradeProxy' || item === 'tradePlatform')
})

const isStepDisabled = computed(() => {
  return !isReady.value || !targetEmail.value || countdown.value?.done === false
})

onBeforeMount(() => {
  getPeriod()
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

async function getPeriod() {
  const { code, data, msg } = await API.window.userGetAgentDeliveryDurationListList()
  if (code !== 0)
    return onlyErrorToast(code, msg)
  expireDays.value = data[0]!
}

// =================== step2 ============================

async function checkTransferStatus() {
  if (!validateEmail(targetEmail.value) && !validatePhone(targetEmail.value)) {
    return onlyErrorToast(-1, $t('请输入正确的邮箱地址/手机号'))
  }

  // 只要存在检测失败的代理 IP 就不准投送
  if (datas.some(item => item.checkStatus === ProxyCheckStatus.failure)) {
    return onlyErrorToast(-1, $t('部分窗口代理 IP 检测失败，请确保代理 IP 测试均正常或删除检测失败的代理 IP 后再继续操作'))
  }

  const isTradeProxy = transferParam.value.includes('tradeProxy')
  const isTradePlatform = transferParam.value.includes('tradePlatform')
  const hasEmptyProxy = datas.some(item => !item.host)
  const hasEmptyPlatform = datas.some(item => !item.windowPlatformList.length)

  // 仅投送代理
  if (isTradeProxy && !isTradePlatform && hasEmptyProxy) {
    return onlyErrorToast(-1, $t('部分窗口缺少代理 IP'))
  }

  // 仅投送账号
  if (!isTradeProxy && isTradePlatform && hasEmptyPlatform) {
    return onlyErrorToast(-1, $t('部分窗口缺少平台账号'))
  }

  if (isTradeProxy && isTradePlatform && (hasEmptyProxy || hasEmptyPlatform)) {
    return onlyErrorToast(-1, $t('部分窗口缺少代理 IP 或平台账号'))
  }

  const { code, data, msg } = await API.window.userGetAgentTransferWindowStatusList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  if (data === true) {
    await onTransfer()
    return
  }

  sendCode()
}

async function sendCode() {
  const { code, msg } = await API.window.userTransferWindowVerifyCodeList({ targetEmail: targetEmail.value })
  if (code !== 0)
    return onlyErrorToast(code, msg)
  nextStep(true)
  stopCountdown.value = enhanceCountdown(Date.now() + 1000 * 60, (time) => {
    countdown.value = time
  }, { alwaysSecondLevel: true })
}

function nextStep(value: boolean) {
  step2.value = value
  emit('resize')
}

async function onTransfer() {
  const { code, msg } = await API.window.userAgentTransferWindowCreate({
    windowIds,
    targetEmail: targetEmail.value,
    emailCode: emailCode.value,
    transferParam: transferParam.value,
    expireDays: expireDays.value,
  })
  if (code !== 0)
    return onlyErrorToast(code, msg)
  emit('confirm', { isSelf: false, needRefresh: true })
}
</script>

<template>
  <div v-if="!step2" class="w-108 flex flex-col gap-6">
    <RxAlert v-if="!isReady" class="w-full" type="error" :closable="false">
      <template #content>
        <i18n-t scope="global" :keypath="$t('投送的窗口必须包含 {bold1} 或 {bold2}', { bold1: '{bold1}', bold2: '{bold2}' })">
          <template #bold1>
            <span class="font-bold"> {{ $t('代理 IP') }} </span>
          </template>
          <template #bold2>
            <span class="font-bold"> {{ $t('平台账号') }} </span>
          </template>
        </i18n-t>
      </template>
    </RxAlert>
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-3">
        <div class="title">
          {{ $t('投送至') }}
        </div>
        <TsFormInputText v-model="targetEmail" size="lg" pre-icon="base/rx_ic_mail" :placeholder="$t('请输入邮箱/手机号')" />
      </div>
      <div v-for="group of optionsGroup" :key="group.title" class="flex flex-col gap-3">
        <div class="title">
          {{ group.title }}
        </div>
        <div class="flex flex-col gap-3">
          <div v-for="option of group.options" :key="option.value" class="flex items-center gap-2 select-none ">
            <RxCheckbox v-model="transferParam" size="small" name="trsparam" :disabled="option.disabled" :input-id="option.value" :value="option.value" />
            <label :for="option.value" class="description">{{ option.label }}</label>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1.5 title">
          <span>{{ $t('临时窗口有效期') }}</span>
          <SvgIcon v-tooltip.top="$t('临时窗口过期之前均可以正常使用，过期后如用量不足则无法打开，但窗口信息（账号、代理 IP 等）均能正常导出。')" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" size="14" />
        </div>
        <div class="time">
          {{ $t('{day} 天', { day: expireDays }) }}
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <RxButton size="lg" :disabled="isStepDisabled" @click="checkTransferStatus">
        <span>{{ $t('下一步') }}</span>
        <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
      </RxButton>
      <div class="help">
        {{ $t('* 完成窗口投送后，窗口将被移至回收站。') }}
      </div>
    </div>
  </div>
  <div v-if="step2" class="w-84 flex flex-col gap-6">
    <RxAlert class="w-full" type="warn" :closable="false">
      <template #content>
        <i18n-t scope="global" :keypath="$t('投送无法撤销，若{bold1}或{bold2}，则所有窗口自动退回。{bold3}', { bold1: '{bold1}', bold2: '{bold2}', bold3: '{bold3}' })">
          <template #bold1>
            <span class="font-bold"> {{ $t('对方拒绝接收') }} </span>
          </template>
          <template #bold2>
            <span class="font-bold"> {{ $t('未在24小时内确认') }} </span>
          </template>
          <template #bold3>
            <span class="font-bold"> {{ $t('投送过程中窗口无法被操作。') }} </span>
          </template>
        </i18n-t>
      </template>
    </RxAlert>
    <div class="flex flex-col gap-4">
      <div class="self-stretch description">
        <div>{{ $t('验证码已发送至您的验证方式：') }}</div>
        <div>{{ currentWorkspace?.phone || currentWorkspace?.email }} </div>
        <div>{{ $t('请在 {minute} 分钟内完成验证。', { minute: 5 }) }}</div>
      </div>
      <InputOtp v-model="emailCode" class="inputotp" integer-only :length="6" size="large" />
    </div>
    <div class="flex flex-col gap-3">
      <RxButton :label="$t('确认')" size="lg" :disabled="emailCode?.length !== 6" @click="onTransfer" />
      <RxButton outlined severity="secondary" size="lg" :disabled="countdown?.done === false" @click="sendCode">
        <span>{{ $t('重新发送') }}</span>
        <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
      </RxButton>
      <div class="cursor-pointer back" @click="nextStep(false)">
        {{ $t('返回') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.inputotp {
  margin: 0 auto;
  gap: var(--spacing-md, 6px);

  :deep(.p-inputotp-input) {
    display: flex;
    width: 52px;
    height: 60px;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
    color: var(--colors-text-text-primary, #fafafa);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    line-height: normal;
    text-transform: uppercase;
  }
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 19.2px;
}

.time {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.help {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 20px;
}

.back {
  color: var(--colors-text-text-brand);
  font-size: 14px;
  line-height: 20px;
}
</style>
