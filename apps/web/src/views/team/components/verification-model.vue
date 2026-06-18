<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { enhanceCountdown } from '/@/utils'

const { onConfirm } = defineProps<{
  onClose: () => void
  onConfirm: (code: string) => void
}>()

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const [_, onlyErrorToast] = useResponseToast()

const emailCode = ref()
const countdown = ref()
const stopCountdown = ref()

onBeforeMount(() => {
  sendCode()
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

async function sendCode() {
  const { code, msg } = await API.team.userSendTeamPermissionVerifyCodeList()
  if (code !== 0)
    return onlyErrorToast(code, msg)
  stopCountdown.value = enhanceCountdown(Date.now() + 1000 * 60, (time) => {
    countdown.value = time
  }, { alwaysSecondLevel: true })
}
</script>

<template>
  <div class="w-130 flex flex-col gap-4 pa-6 pt-4">
    <div class="h-9 flex justify-between items-center title">
      <div>{{ $t('操作安全验证') }}</div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" @click="onClose" />
    </div>
    <div class="flex flex-col gap-6">
      <div class="flex justify-center">
        <SvgIcon name="empty/rx_illustration_verification_mail" size="128" />
      </div>
      <RxAlert class="w-full" type="warn" :closable="false" :title="$t('您正在配置的权限与资产相关，请确保团队创建人知晓本次操作')" />
      <div class="description">
        <div>{{ $t('请输入发送至团队创建人绑定{type} {value} 的验证码，以完成验证。', { type: currentWorkspace!.phone ? $t('手机号') : $t('邮箱'), value: currentWorkspace!.phone || currentWorkspace!.email }) }}</div>
      </div>
      <InputOtp v-model="emailCode" class="w-full flex gap-1.5 inputotp" integer-only :length="6" size="large" />
      <div class="flex justify-end gap-3">
        <RxButton outlined severity="secondary" size="lg" :disabled="countdown?.done === false" @click="sendCode">
          <span>{{ $t('重新发送') }}</span>
          <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
        </RxButton>
        <RxButton :label="$t('确认')" size="lg" :disabled="emailCode?.length !== 6" @click="onConfirm(emailCode)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.description {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
}

.inputotp {
  :deep(.p-inputotp-input) {
    display: flex;
    flex: 1;
    height: 76px;
    flex-direction: column;
    justify-content: center;
    color: var(--colors-text-text-primary);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 40px;
    line-height: normal;
    text-transform: uppercase;
  }
}
</style>
