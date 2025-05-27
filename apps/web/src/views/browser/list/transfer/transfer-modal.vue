<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import ChooseSpace from './choose-space.vue'
import { API } from '/@/api';
import { useResponseToast } from "/@/hooks/useResponseToast";
import { $t } from '/@/locales';
import { startCountdown } from '/@/utils';
import { useUserStore } from '/@/stores/user'

const { userInfo } = storeToRefs(useUserStore())
const { ids: windowIds } = defineProps<{
  ids: number[]
}>()

const emit = defineEmits(['close', 'confirm'])
const [_, onlyErrorToast] = useResponseToast()
const messageRef = useTemplateRef('message')

const selectedWorkspace = ref()
const transferParam = ref<string[]>([])
const isDelete = computed(() => !!transferParam.value?.includes('delete'))
const optionsGroup = computed(() => [
  {
    title: $t('投送选项'),
    options: [
      {
        label: $t('窗口名称'),
        value: 'name'
      },
      {
        label: $t('窗口备注'),
        value: 'notes'
      },
      {
        label: $t('投送后彻底删除窗口（该操作无法撤销）'),
        value: 'delete'
      }
    ]
  },
  {
    title: $t('删除选项'),
    visible: isDelete.value,
    options: [
      {
        label: $t('同时删除代理资源中仅与投送窗口有绑定关系的代理'),
        value: 'proxy'
      },
      {
        label: $t('同时删除平台账号中仅与投送窗口有绑定关系的账号'),
        value: 'platform'
      }
    ]
  }
].filter(item => item.visible !== false))

watch(isDelete, (value) => {
  if (value) {
    nextTick(() => {
      messageRef.value?.scrollIntoView({ behavior: 'smooth' })
    })
  }
})

//===============================================
const emailCode = ref()
const step2 = ref(false)
const countdown = ref()
const stopCountdown = ref()

onBeforeUnmount(() => {
  stopCountdown.value?.()
})

async function sendCode() {
  if (!selectedWorkspace.value) return

  if (selectedWorkspace.value.isWorkspace) {
    await onTransfer(true)
    return
  }

  const { code, msg } = await API.window.userTransferWindowVerifyCodeList({ targetWorkspaceId: selectedWorkspace.value.workspaceId })
  if (code !== 0) return onlyErrorToast(code, msg)
  step2.value = true
  stopCountdown.value = startCountdown(Date.now() + 1000 * 60, (time) => {
    countdown.value = time
  })
}

async function onTransfer(isSelf: boolean) {
  const _transferParam = isDelete.value
    ? transferParam.value
    : transferParam.value.filter(item => ['name', 'notes'].includes(item))// 取消彻底删除时过滤依赖项

  const { code, msg } = await API.window.userTransferWindowCreate({
    windowIds,
    targetWorkspaceId: selectedWorkspace.value.workspaceId,
    isDelete: isDelete.value,
    emailCode: emailCode.value,
    transferParam: _transferParam
  })
  if (code !== 0) return onlyErrorToast(code, msg)
  emit('confirm', { isSelf, needRefresh: isDelete.value })
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 max-h-[80vh] overflow-y-auto popup" :class="[step2 ? 'popup2' : 'popup1']">
    <div class="flex justify-between items-center">
      <span class="header">{{ windowIds.length > 1 ? $t('投送 {count} 个窗口', { count: windowIds.length }) : $t('投送窗口')
      }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <div v-if="!step2" class="flex flex-col gap-6">
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
          <div class="title">{{ $t('投送至') }}</div>
          <ChooseSpace v-model="selectedWorkspace" :ids="windowIds"></ChooseSpace>
        </div>
        <div class="flex flex-col gap-3" v-for="group of optionsGroup" :key="group.title">
          <div class="title">{{ group.title }}</div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2 select-none checkboxitem" v-for="option of group.options" :key="option.value">
              <Checkbox v-model="transferParam" size="small" name="trsparam" :input-id="option.value" :value="option.value" />
              <label :for="option.value">{{ option.label }}</label>
            </div>
          </div>
        </div>
        <div ref="message" class="flex flex-col pa-3 pt-2 illustrate" v-if="isDelete">
          <div class="illustrate-title mb-3">{{ $t('删除说明') }}</div>
          <div class="checkboxitem">{{ $t('若代理 a 仅与窗口 A 绑定，窗口 A 被投送，则代理 a 将从代理资源中删除') }}</div>
          <div class="checkboxitem">{{ $t('若代理 a 与窗口 A、B 绑定，仅窗口 A 被投送，则代理 a 不会被删除') }}</div>
          <div class="checkboxitem">{{ $t('若代理 a 与窗口 A、B 绑定，窗口 A、B 均被投送，则代理 a 将从代理资源中删除') }}</div>
          <div class="checkboxitem">{{ $t('(平台账号删除规则同代理)') }}</div>
        </div>
      </div>
      <div class="flex flex-col gap-3">
        <RxButton size="lg" :disabled="!selectedWorkspace || countdown?.done === false" @click="sendCode">
          <span>{{ $t('下一步') }}</span>
          <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
        </RxButton>
      </div>
    </div>

    <div v-if="step2" class="flex flex-col gap-6">
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
        <div class="emailcode">
          <div class="emailcode-item">{{ $t('我们已经向您的邮箱发送了一个6位数字验证码：') }}</div>
          <div class="email-text">{{ userInfo.email }} </div>
          <div>{{ $t("验证码将在 5 分钟后过期。") }}</div>
          <div class="emailcode-item mt-[12px]">
            {{ $t('请检查邮件以获取验证码') }}
          </div>
        </div>
        <InputOtp class="inputotp" v-model="emailCode" integer-only :length="6" size="large" />
      </div>
      <div class="flex flex-col gap-3">
        <RxButton :label="$t('确认')" size="lg" :disabled="emailCode?.length !== 6" @click="onTransfer(false)"></RxButton>
        <RxButton outlined severity="secondary" size="lg" :disabled="countdown?.done === false" @click="sendCode">
          <span>{{ $t('重新发送') }}</span>
          <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
        </RxButton>
        <div class="cursor-pointer back" @click="step2 = false">{{ $t('返回') }}</div>
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
    color: var(--colors-text-text-primary, #FAFAFA);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    line-height: normal;
    text-transform: uppercase;
  }
}

.popup1 {
  width: 480px;
}

.popup2 {
  width: 384px;
}

.header {
  color: var(--component-button-primary-text, #111213);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.illustrate {
  border-radius: 4px;
  background: var(--colors-background-bg-block, #F1F5F8);

  &-title {
    color: var(--component-button-primary-text, #111213);
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.title {
  color: var(--component-button-primary-text, #111213);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.checkboxitem {
  color: var(--colors-text-text-secondary, #575D60);
  font-size: 12px;
  line-height: 19.2px;
}

.description {
  color: var(--component-button-primary-text, #111213);
  font-size: 14px;
  line-height: 20px;
}

.back {
  color: var(--colors-text-text-brand, #11A3FD);
  font-size: 14px;
  line-height: 20px;
}

.emailcode {
  align-self: stretch;
  color: var(--colors-text-text-secondary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-lg, 20px);

  .emailcode-item {
    color: var(--colors-text-text-secondary, #575D60);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
    /* 166.667% */
  }
}
</style>
