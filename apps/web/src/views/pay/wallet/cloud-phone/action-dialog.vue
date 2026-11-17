<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import { useCloudPhoneWallet } from './useCloudPhoneWallet'
import type { CloudPhoneWalletAction } from './useCloudPhoneWallet'
import { useResponseToast } from '/@/hooks/useResponseToast'

const props = defineProps<{ action: CloudPhoneWalletAction }>()
const visible = defineModel<boolean>('visible', { default: false })
const { state, applyDemo } = useCloudPhoneWallet()
const [showToast] = useResponseToast()
const form = reactive({ quantity: 5, days: 30, minutes: 2000, monthlyDevices: 1, autoRenew: true })
const quantityOptions = [5, 10, 20, 50, 100].map(value => ({ label: String(value), value }))
const minuteOptions = [2000, 5000, 10000, 20000, 50000].map(value => ({ label: value.toLocaleString(), value }))
const durationOptions = computed(() => [7, 30, 90, 180, 360].map(value => ({ label: $t('{day} 天', { day: value }), value })))
const isPlanAction = computed(() => ['plan', 'change', 'renew'].includes(props.action))
const canConfirm = computed(() => props.action !== 'monthly' || (
  Number.isInteger(form.monthlyDevices)
  && form.monthlyDevices >= 1
  && form.monthlyDevices <= (state.value.plan?.quantity ?? 0)
))
const title = computed(() => ({
  'plan': $t('订阅云手机套餐'),
  'time': $t('购买使用时长'),
  'monthly': $t('购买包月设备'),
  'change': $t('更改云手机套餐'),
  'renew': $t('续费云手机套餐'),
  'auto-renew': $t('管理自动续费'),
})[props.action])

watch([visible, () => props.action], ([open]) => {
  if (!open) {
    return
  }
  Object.assign(form, {
    quantity: Math.max(5, state.value.plan?.quantity ?? 5),
    days: 30,
    minutes: 2000,
    monthlyDevices: state.value.monthlyDevices || 1,
    autoRenew: state.value.plan?.autoRenew ?? true,
  })
})

function confirm() {
  if (!canConfirm.value) {
    return
  }
  applyDemo(props.action, form)
  visible.value = false
  showToast(0, $t('演示状态已更新'))
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="title" modal :draggable="false" class="w-110 max-w-[calc(100vw-32px)]">
    <div class="flex flex-col gap-5">
      <div class="rounded-1.5 bg-[var(--component-alert-bg-info)] p-3 text-3 leading-5 tt-secondary">
        {{ $t('当前为界面演示，操作仅更新预览状态，不会产生真实订单或扣款。') }}
      </div>
      <div v-if="isPlanAction" class="flex flex-col gap-2">
        <label for="cloud-wallet-quantity" class="text-3.5 font-500 tt-primary">{{ $t('云手机数量') }}</label>
        <Select v-model="form.quantity" input-id="cloud-wallet-quantity" :options="quantityOptions" option-label="label" option-value="value" :disabled="action === 'renew' && !state.plan?.trial" />
      </div>
      <div v-if="isPlanAction && action !== 'change'" class="flex flex-col gap-2">
        <label for="cloud-wallet-duration" class="text-3.5 font-500 tt-primary">{{ $t('订阅时长') }}</label>
        <Select v-model="form.days" input-id="cloud-wallet-duration" :options="durationOptions" option-label="label" option-value="value" />
      </div>
      <div v-if="action === 'time'" class="flex flex-col gap-2">
        <label for="cloud-wallet-minutes" class="text-3.5 font-500 tt-primary">{{ $t('使用时长（分钟）') }}</label>
        <Select v-model="form.minutes" input-id="cloud-wallet-minutes" :options="minuteOptions" option-label="label" option-value="value" />
      </div>
      <div v-if="action === 'monthly'" class="flex flex-col gap-2">
        <label for="cloud-wallet-monthly" class="text-3.5 font-500 tt-primary">{{ $t('包月设备数量') }}</label>
        <InputNumber v-model="form.monthlyDevices" input-id="cloud-wallet-monthly" show-buttons :min="1" :max="state.plan?.quantity ?? 0" :allow-empty="false" />
      </div>
      <div v-if="isPlanAction || action === 'auto-renew'" class="flex items-center justify-between gap-4">
        <label for="cloud-wallet-auto-renew" class="text-3.5 tt-primary">{{ $t('自动续费') }}</label>
        <RxToggleSwitch v-model="form.autoRenew" input-id="cloud-wallet-auto-renew" />
      </div>
    </div>
    <template #footer>
      <RxButton severity="secondary" outlined :label="$t('取消')" @click="visible = false" />
      <RxButton :label="$t('应用演示')" :disabled="!canConfirm" @click="confirm" />
    </template>
  </Dialog>
</template>
