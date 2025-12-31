<script setup lang="ts">
import ChooseSpace from '/@/views/browser/list/transfer/components/choose-space.vue'
import { RxAlert } from '/@/components/rx-alert'

import { API } from '/@/api'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { enhanceCountdown } from '/@/utils'

interface OptionGorup {
  title: string
  visible?: boolean
  options: {
    label: string
    value: string
    tooltip?: string
    disabled?: boolean
  }[]
}

defineOptions({ inheritAttrs: false })

const { ids: windowIds, buyProxyType = false } = defineProps<{
  ids: number[]
  buyProxyType?: boolean
}>()

const emit = defineEmits(['confirm', 'resize'])

const { isOwner } = storeToRefs(useRoleStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const [_, onlyErrorToast] = useResponseToast()

const messageRef = useTemplateRef('message')

const selectedWorkspace = ref()
const transferParam = ref<string[]>([])

const isDelete = computed(() => !!transferParam.value?.includes('delete'))
const optionsGroup = computed<OptionGorup[]>(() => [
  {
    title: $t('投送选项'),
    options: [
      {
        label: $t('窗口名称'),
        value: 'name',
      },
      {
        label: $t('窗口备注'),
        value: 'notes',
      },
      {
        label: $t('投送后彻底删除窗口（该操作无法撤销）'),
        value: 'delete',
      },
    ],
  },
  {
    title: $t('删除选项'),
    visible: isDelete.value,
    options: [
      {
        label: $t('同时删除代理资源中仅与投送窗口有绑定关系的代理'),
        value: 'proxy',
        disabled: buyProxyType,
        tooltip: buyProxyType ? $t('投送窗口中存在购买代理') : undefined,
      },
      {
        label: $t('同时删除平台账号中仅与投送窗口有绑定关系的账号'),
        value: 'platform',
      },
    ],
  },
].filter(item => item.visible !== false))

watch(isDelete, (value) => {
  if (value) {
    nextTick(() => {
      messageRef.value?.scrollIntoView({ behavior: 'smooth' })
    })
  }
})

// =================== step2 ============================
const step2 = ref(false)
const emailCode = ref()
const countdown = ref()
const stopCountdown = ref()

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

async function sendCode() {
  if (!selectedWorkspace.value)
    return
  if (isOwner.value && selectedWorkspace.value.isWorkspace) {
    await onTransfer(true)
    return
  }

  const { code, msg } = await API.window.userTransferWindowVerifyCodeList({ targetWorkspaceId: selectedWorkspace.value.workspaceId })
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

async function onTransfer(isSelf: boolean) {
  /**
   * 未勾选删除，需要过滤掉删除的子项(解决勾选子项后，父项取消勾选导致的问题)
   */
  const _transferParam = isDelete.value
    ? transferParam.value
    : transferParam.value.filter(item => !['platform', 'proxy'].includes(item))

  const { code, msg } = await API.window.userTransferWindowCreate({
    windowIds,
    targetWorkspaceId: selectedWorkspace.value.workspaceId,
    isDelete: isDelete.value,
    emailCode: emailCode.value,
    transferParam: _transferParam,
  })
  if (code !== 0)
    return onlyErrorToast(code, msg)
  emit('confirm', { isSelf, needRefresh: isDelete.value })
}
</script>

<template>
  <div v-if="!step2" class="w-108 flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <RxAlert class="w-full" type="info" :closable="false">
        <template #content>
          <i18n-t scope="global" :keypath="$t('窗口投送将发送您所选窗口{bold}，但无法发送{bold2}。', { bold: '{bold}', bold2: '{bold2}' })">
            <template #bold>
              <span class="font-bold"> {{ $t('已同步过的云端数据、代理信息、平台账号、Cookies 和指纹参数等') }} </span>
            </template>
            <template #bold2>
              <span class="font-bold"> {{ $t('扩展应用，需要接收方手动安装') }} </span>
            </template>
          </i18n-t>
        </template>
      </RxAlert>
    </div>
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-3">
        <div class="title">
          {{ $t('投送至') }}
        </div>
        <ChooseSpace v-model="selectedWorkspace" :ids="windowIds" />
      </div>
      <div v-for="group of optionsGroup" :key="group.title" class="flex flex-col gap-3">
        <div class="title">
          {{ group.title }}
        </div>
        <div class="flex flex-col gap-3">
          <div v-for="option of group.options" :key="option.value" class="flex items-center gap-2 select-none checkboxitem">
            <RxCheckbox v-model="transferParam" size="small" name="trsparam" :input-id="option.value" :value="option.value" :disabled="option.disabled" />
            <label :for="option.value">{{ option.label }}</label>
            <SvgIcon v-if="option.tooltip" v-tooltip="option.tooltip" name="base/rx_ic_info" size="16" color="var(--colors-icon-icon-note)" />
          </div>
        </div>
      </div>
      <div v-if="isDelete" ref="message" class="flex flex-col pa-3 pt-2 illustrate">
        <div class="illustrate-title mb-3">
          {{ $t('删除说明') }}
        </div>
        <div class="checkboxitem">
          {{ $t('若代理 a 仅与窗口 A 绑定，窗口 A 被投送，则代理 a 将从代理资源中删除') }}
        </div>
        <div class="checkboxitem">
          {{ $t('若代理 a 与窗口 A、B 绑定，仅窗口 A 被投送，则代理 a 不会被删除') }}
        </div>
        <div class="checkboxitem">
          {{ $t('若代理 a 与窗口 A、B 绑定，窗口 A、B 均被投送，则代理 a 将从代理资源中删除') }}
        </div>
        <div class="checkboxitem">
          {{ $t('(平台账号删除规则同代理)') }}
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <RxButton size="lg" :disabled="!selectedWorkspace || countdown?.done === false" @click="sendCode">
        <span>{{ $t('下一步') }}</span>
        <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
      </RxButton>
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
      <div class="code">
        <div>{{ $t('验证码已发送至您的验证方式：') }}</div>
        <div>{{ currentWorkspace?.phone || currentWorkspace?.email }} </div>
        <div>{{ $t("请在 5 分钟内完成验证。") }}</div>
      </div>
      <InputOtp v-model="emailCode" class="inputotp" integer-only :length="6" size="large" />
    </div>
    <div class="flex flex-col gap-3">
      <RxButton :label="$t('确认')" size="lg" :disabled="emailCode?.length !== 6" @click="onTransfer(false)" />
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

.illustrate {
  border-radius: 4px;
  background: var(--colors-background-bg-block, #f1f5f8);

  &-title {
    color: var(--colors-text-text-primary, #111213);
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.checkboxitem {
  color: var(--colors-text-text-secondary, #575d60);
  font-size: 12px;
  line-height: 19.2px;
}

.description {
  color: var(--component-button-primary-text, #111213);
  font-size: 14px;
  line-height: 20px;
}

.code {
  align-self: stretch;
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 20px;
}

.back {
  color: var(--colors-text-text-brand, #11a3fd);
  font-size: 14px;
  line-height: 20px;
}
</style>
