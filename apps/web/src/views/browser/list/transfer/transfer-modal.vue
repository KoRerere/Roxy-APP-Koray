<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import ChooseSpace from './choose-space.vue'


const { ids: windowIds } = defineProps<{
  ids: number[]
}>()

const emit = defineEmits(['close'])

const targetWorkspaceId = ref()
const isDelete = ref()
const transferParam = ref({
  value: [],
  options: [
    {
      label: 'Profile name',
      value: 'name'
    },
    {
      label: 'Profile notes',
      value: 'notes'
    }
  ]
})
//===============================================
const emailCode = ref()
const step2 = ref(false)

function sendCode() {
  step2.value = true
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 popup" :class="[step2 ? 'popup2' : 'popup1']">
    <div class="flex justify-between items-center">
      <span class="header">Transfer</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <div v-if="!step2" class="flex flex-col gap-5">
      <RxAlert class="w-full" type="info" content="Transfer including cloud synchronization data, proxy, account password, 2FA, Cookies, fingerprints, etc." :closable="false" />
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3">
          <div class="title">Transfer to</div>
          <ChooseSpace v-model="targetWorkspaceId" :ids="windowIds"></ChooseSpace>
        </div>
        <div class="flex flex-col gap-3">
          <div class="title">Transferable options</div>
          <div class="flex gap-4">
            <div class="flex items-center gap-2 select-none checkboxitem" v-for="option of transferParam.options" :key="option.value">
              <Checkbox v-model="transferParam.value" size="small" name="trsparam" :input-id="option.value" :value="option.value" />
              <label :for="option.value">{{ option.label }}</label>
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-3">
        <RxButton label="Confirm" size="lg" @click="sendCode"></RxButton>
        <div class="flex items-center gap-2 checkboxitem">
          <Checkbox v-model="isDelete" binary size="small" input-id="del" />
          <label for="del">After the transfer, delete the profiles from your own space</label>
        </div>
      </div>
    </div>

    <div v-if="step2" class="flex flex-col gap-6">
      <RxAlert class="w-full" type="warn" content="Transfer cannot be undone. Unaccepted or rejected profiles will auto-return in 24 hours. No modifications allowed during processing."
        :closable="false" />
      <div class="flex flex-col gap-4">
        <div class="description">For security verification, we've sent a code to your email. Please enter it to confirm and finalize this transfer.</div>
        <InputOtp class="inputotp" v-model="emailCode" integer-only :length="6" size="large" />
      </div>
      <div class="flex flex-col gap-3">
        <RxButton label="Confirm" size="lg"></RxButton>
        <RxButton outlined severity="secondary" label="Resend" size="lg"></RxButton>
        <div class="cursor-pointer back" @click="step2 = false">Go back to first step</div>
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