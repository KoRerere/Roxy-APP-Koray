<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import ChooseSpace from './choose-space.vue'
import { API } from '/@/api';
import { useResponseToast } from "/@/hooks/useResponseToast";
import { $t } from '/@/locales';
import { SpaceType } from '/@/views/browser/list/transfer/type.ts'
import { startCountdown } from '/@/utils';


const { ids: windowIds } = defineProps<{
  ids: number[]
}>()

const emit = defineEmits(['close', 'confirm'])
const [_, onlyErrorToast] = useResponseToast()

const selectedWorkspace = ref()
const isDelete = ref(false)
const transferParam = ref({
  value: [],
  options: [
    {
      label: $t('窗口名称'),
      value: 'name'
    },
    {
      label: $t('窗口备注'),
      value: 'notes'
    }
  ]
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

  if (selectedWorkspace.value.type === SpaceType.Self) {
    onTransfer()
    return
  }

  const { code, msg } = await API.window.userTransferWindowVerifyCodeList()
  if (code !== 0) return onlyErrorToast(code, msg)
  step2.value = true
  stopCountdown.value = startCountdown(Date.now() + 1000 * 60, (time) => {
    countdown.value = time
  })
}

async function onTransfer() {
  const { code, msg } = await API.window.userTransferWindowCreate({
    windowIds,
    targetWorkspaceId: selectedWorkspace.value.workspaceId,
    isDelete: isDelete.value,
    emailCode: emailCode.value,
    transferParam: transferParam.value.value
  })
  if (code !== 0) return onlyErrorToast(code, msg)
  emit('confirm')
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 popup" :class="[step2 ? 'popup2' : 'popup1']">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('窗口转移') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <div v-if="!step2" class="flex flex-col gap-5">
      <RxAlert class="w-full" type="info" content="转移包括云同步数据、代理、账号密码、2FA、Cookies、指纹等" :closable="false" />
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3">
          <div class="title">{{ $t('转移至') }}</div>
          <ChooseSpace v-model="selectedWorkspace" :ids="windowIds"></ChooseSpace>
        </div>
        <div class="flex flex-col gap-3">
          <div class="title">{{ $t('转移选项') }}</div>
          <div class="flex gap-4">
            <div class="flex items-center gap-2 select-none checkboxitem" v-for="option of transferParam.options" :key="option.value">
              <Checkbox v-model="transferParam.value" size="small" name="trsparam" :input-id="option.value" :value="option.value" />
              <label :for="option.value">{{ option.label }}</label>
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-3">
        <RxButton size="lg" :disabled="!selectedWorkspace || countdown?.done === false" @click="sendCode">
          <span>{{ $t('下一步') }}</span>
          <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
        </RxButton>
        <div class="flex items-center gap-2 checkboxitem">
          <Checkbox v-model="isDelete" binary size="small" input-id="del" />
          <label for="del">{{ $t('转移后删除窗口') }}</label>
        </div>
      </div>
    </div>

    <div v-if="step2" class="flex flex-col gap-6">
      <RxAlert class="w-full" type="warn" content="转移操作无法撤销。未接受或被拒绝的配置文件将在24小时内自动返回。处理过程中不允许修改。" :closable="false" />
      <div class="flex flex-col gap-4">
        <div class="description">{{ $t('为了安全验证，我们已向您的邮箱发送了验证码。请输入验证码以确认并完成此次转移。') }}</div>
        <InputOtp class="inputotp" v-model="emailCode" integer-only :length="6" size="large" />
      </div>
      <div class="flex flex-col gap-3">
        <RxButton :label="$t('确认')" size="lg" :disabled="emailCode?.length !== 6" @click="onTransfer"></RxButton>
        <RxButton outlined severity="secondary" size="lg" :disabled="countdown?.done === false" @click="sendCode">
          <span>{{ $t('重新发送') }}</span>
          <span v-if="countdown?.done === false">{{ `(${countdown.seconds}s)` }}</span>
        </RxButton>
        <div class="cursor-pointer back" @click="step2 = false">{{ $t('返回上一步') }}</div>
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
    color: #000;
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
  color: var(--Colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.checkboxitem {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 12px;
  line-height: 16px;
}

.description {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 14px;
  line-height: 20px;
}

.back {
  color: var(--Colors-text-text-link, #11A3FD);
  font-size: 14px;
  line-height: 20px;
}
</style>