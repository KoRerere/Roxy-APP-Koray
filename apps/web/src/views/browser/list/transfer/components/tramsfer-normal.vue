<script setup lang="ts">
import ChooseSpace from '/@/views/browser/list/transfer/components/choose-space.vue'
import { RxAlert } from '/@/components/rx-alert'

import { API } from '/@/api'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useTransferEntityLabels } from '/@/composables/useTransferEntityLabels'
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
const transferLabels = useTransferEntityLabels()

const messageRef = useTemplateRef('message')

const selectedWorkspace = ref()
const transferParam = ref<string[]>([])

const isDelete = computed(() => !!transferParam.value?.includes('delete'))
const optionsGroup = computed<OptionGorup[]>(() => {
  const labels = transferLabels.value
  return [
  {
    title: $t('转移选项'),
    options: [
      {
        label: labels.entityNameOption,
        value: 'name',
      },
      {
        label: labels.entityRemarkOption,
        value: 'notes',
      },
      {
        label: labels.deleteEntityAfterTransfer,
        value: 'delete',
      },
    ],
  },
  {
    title: $t('删除选项'),
    visible: isDelete.value,
    options: [
      {
        label: labels.deleteOrphanProxyOnTransfer,
        value: 'proxy',
        disabled: buyProxyType,
        tooltip: buyProxyType ? labels.transferHasPurchasedProxy : undefined,
      },
      {
        label: labels.deleteOrphanPlatformOnTransfer,
        value: 'platform',
      },
    ],
  },
].filter(item => item.visible !== false)
})

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

async function checkTransferStatus() {
  if (!selectedWorkspace.value)
    return
  if (isOwner.value && selectedWorkspace.value.isWorkspace) {
    await onTransfer(true)
    return
  }

  const { code, data, msg } = await API.window.userGetAgentTransferWindowStatusList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  if (data === true) {
    await onTransfer(false)
    return
  }

  sendCode()
}

async function sendCode() {
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
          <i18n-t scope="global" :keypath="transferLabels.transferIncludesKeypath">
            <template #bold>
              <span class="font-bold"> {{ transferLabels.transferIncludesBold }} </span>
            </template>
            <template #bold2>
              <span class="font-bold"> {{ transferLabels.transferExcludesBold }} </span>
            </template>
          </i18n-t>
        </template>
      </RxAlert>
    </div>
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-3">
        <div class="title">
          {{ $t('转移至') }}
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
          {{ transferLabels.deleteProxyOnlyBoundToEntity }}
        </div>
        <div class="checkboxitem">
          {{ transferLabels.deleteProxyBoundToMultipleKeep }}
        </div>
        <div class="checkboxitem">
          {{ transferLabels.deleteProxyBoundToMultipleRemove }}
        </div>
        <div class="checkboxitem">
          {{ transferLabels.platformDeleteSameAsProxy }}
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <RxButton size="lg" :disabled="!selectedWorkspace || countdown?.done === false" @click="checkTransferStatus">
        <span>{{ $t('下一步') }}</span>
        <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
      </RxButton>
    </div>
  </div>
  <div v-if="step2" class="w-84 flex flex-col gap-6">
    <RxAlert class="w-full" type="warn" :closable="false">
      <template #content>
        <i18n-t scope="global" :keypath="transferLabels.transferIrreversibleKeypath">
          <template #bold1>
            <span class="font-bold"> {{ $t('对方拒绝接收') }} </span>
          </template>
          <template #bold2>
            <span class="font-bold"> {{ $t('未在24小时内确认') }} </span>
          </template>
          <template #bold3>
            <span class="font-bold"> {{ transferLabels.transferBlockedDuringProcess }} </span>
          </template>
        </i18n-t>
      </template>
    </RxAlert>
    <div class="flex flex-col gap-4">
      <div class="code">
        <div>{{ $t('验证码已发送至您的验证方式：') }}</div>
        <div>{{ currentWorkspace?.phone || currentWorkspace?.email }} </div>
        <div>{{ $t('请在 {minute} 分钟内完成验证。', { minute: 5 }) }}</div>
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
