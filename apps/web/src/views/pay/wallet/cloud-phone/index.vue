<script setup lang="ts">
import { format } from 'date-fns'
import Dialog from 'primevue/dialog'
import WalletServiceLayout from '../components/wallet-service-layout.vue'
import AutoRenew from '../manage/auto-renew.vue'
import ActionDialog from './action-dialog.vue'
import { useCloudPhoneWallet } from './useCloudPhoneWallet'
import type { CloudPhoneWalletAction } from './useCloudPhoneWallet'
import welcomeLight from '/@/assets/images/cloud-phone/wallet/welcome-light.png'
import welcomeDark from '/@/assets/images/cloud-phone/wallet/welcome-dark.png'
import planGlowDark from '/@/assets/images/cloud-phone/wallet/plan-glow-dark.svg?url'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { state, claimTrial } = useCloudPhoneWallet()
const { isDarkTheme } = storeToRefs(useThemeStore())
const [showToast] = useResponseToast()
const action = ref<CloudPhoneWalletAction>('plan')
const dialogVisible = ref(false)
const showClaimConfirmation = ref(false)
const plan = computed(() => state.value.plan)
const available = computed(() => Math.max(0, (plan.value?.quantity ?? 0) - (plan.value?.used ?? 0)))
const usagePercent = computed(() => plan.value?.quantity ? Math.min(100, plan.value.used / plan.value.quantity * 100) : 0)

function openAction(value: CloudPhoneWalletAction) {
  // 包月额度属于套餐，未订阅时先演示订阅，再购买包月设备。
  action.value = value === 'monthly' && !plan.value ? 'plan' : value
  dialogVisible.value = true
}

function confirmClaim() {
  claimTrial()
  showClaimConfirmation.value = false
  showToast(0, $t('演示状态已更新'))
}
</script>

<template>
  <WalletServiceLayout>
    <div class="flex flex-col gap-2.5">
      <section v-if="!plan" class="relative flex items-end gap-5 overflow-hidden border border-solid border-[var(--colors-border-border-inactive)] rounded-2 p-5">
        <img :src="isDarkTheme ? welcomeDark : welcomeLight" alt="" class="pointer-events-none absolute inset-0 h-full w-full object-cover">
        <div class="relative min-w-0 flex flex-1 flex-col gap-5">
          <div class="flex flex-col items-start gap-3">
            <span class="rounded-full bg-[linear-gradient(144deg,#12a3fc_0%,#c36df4_100%)] px-3 py-1 text-3 leading-4 text-white">
              {{ $t('每个新账号限领一次') }}
            </span>
            <h2 class="m-0 text-6 font-600 leading-7 font-[Archivo] tt-primary">
              {{ $t('领取您的云手机新手礼包') }}
            </h2>
          </div>
          <p class="m-0 text-3.5 leading-5 tt-primary">
            {{ $t('无需充值，免费获得 1 台云手机，使用 30 天，并赠送 30 分钟临时使用时长。') }}
          </p>
        </div>
        <RxButton class="relative shrink-0" size="lg" :label="$t('免费领取')" @click="showClaimConfirmation = true" />
      </section>

      <AnimationBorder v-else :animation="false" :deg="110" :border-radius="12" :gradient="['#12a3fc', '#ec51f7']">
        <section class="relative flex flex-col gap-5 overflow-hidden rounded-2.5 bg-[var(--colors-background-bg-overlay)] p-5">
          <img :src="isDarkTheme ? planGlowDark : '/images/payments/wallet/plan-glow.svg'" alt="" class="pointer-events-none absolute right-0 top-0 h-40 w-[457px]">
          <div class="relative flex flex-wrap items-center justify-between gap-3">
            <h2 class="m-0 text-4 font-600 leading-5 tt-primary">
              {{ $t('云手机套餐') }}
            </h2>
            <span class="text-3 font-500 font-['JetBrains_Mono'] tt-tertiary">{{ $t('到期时间: {value}', { value: format(plan.expiresAt, 'yyyy-MM-dd') }) }}</span>
          </div>
          <div class="relative flex flex-col gap-3">
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0 flex items-baseline gap-1.5 font-['DingTalk_JinBuTi']">
                <span class="text-7 leading-9 tt-brand">{{ plan.used.toLocaleString() }}</span>
                <span class="text-4 leading-6 tt-secondary">/ {{ $t('{count} 台云手机', { count: plan.quantity.toLocaleString() }) }}</span>
                <RxTooltip class="flex shrink-0 self-center">
                  <SvgIcon name="base/rx_ic_info" size="12" color="var(--colors-icon-icon-note)" />
                  <template #content>
                    {{ $t('当前使用数量和套餐可创建的云手机总数。') }}
                  </template>
                </RxTooltip>
              </div>
              <span class="shrink-0 text-4 leading-6 font-['DingTalk_JinBuTi'] tt-tertiary">{{ $t('{count} 个可用', { count: available.toLocaleString() }) }}</span>
            </div>
            <div class="h-1.25 overflow-hidden rounded-full bg-[var(--colors-border-border-inactive)]" role="progressbar" :aria-label="$t('云手机用量')" :aria-valuenow="plan.used" :aria-valuemin="0" :aria-valuemax="plan.quantity">
              <div class="h-full rounded-full bg-[var(--colors-border-border-brand)]" :style="{ width: `${usagePercent}%` }" />
            </div>
          </div>
          <div class="relative flex flex-wrap items-center justify-between gap-3">
            <RxButton severity="secondary" outlined size="md" :label="plan.autoRenew ? $t('管理订阅') : $t('启用自动续费')" @click="openAction('auto-renew')" />
            <div class="flex items-center gap-2.5">
              <RxButton size="md" :label="$t('更改套餐')" @click="openAction('change')" />
              <RxButton severity="secondary" outlined size="md" icon="base/rx_ic_renew2" :label="$t('续费')" @click="openAction('renew')" />
            </div>
          </div>
        </section>
      </AnimationBorder>

      <section class="flex items-center gap-5 overflow-hidden border border-solid border-[var(--colors-border-border-inactive)] rounded-3 bg-[var(--colors-background-bg-overlay)] px-5 py-4">
        <div class="min-w-0 flex flex-1 flex-col items-start gap-3">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5 text-3.5 font-600 leading-4.5 tt-secondary">
              <span>{{ $t('使用时长') }}</span>
              <RxTooltip class="flex shrink-0">
                <SvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
                <template #content>
                  {{ $t('按分钟计费的云手机已使用时长及可用总时长，包含免费赠送和购买的时长。') }}
                </template>
              </RxTooltip>
            </div>
            <div class="flex items-baseline gap-1.5 whitespace-nowrap">
              <span class="text-3.5 font-500 tt-tertiary">{{ $t('已使用') }}</span>
              <div class="flex items-baseline gap-1 font-600">
                <span class="text-6 tt-secondary">{{ state.usedMinutes.toLocaleString() }}</span>
                <span class="text-4 leading-6 tt-inactive">/{{ state.totalMinutes.toLocaleString() }}</span>
              </div>
              <span class="text-3.5 tt-tertiary">{{ $t('分钟') }}</span>
            </div>
          </div>
          <RxButton variant="outlined" size="xxs" icon="base/rx_ic_plus" :label="$t('购买')" @click="openAction('time')" />
        </div>
        <div class="h-15 w-0 shrink-0 border-l border-l-dashed border-[var(--colors-border-border-subtle)]" />
        <div class="w-50 flex shrink-0 flex-col items-start gap-3">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5 text-3.5 font-600 leading-4.5 tt-secondary">
              <span>{{ $t('包月设备') }}</span>
              <RxTooltip class="flex shrink-0">
                <SvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
                <template #content>
                  {{ $t('已购买的包月开机设备额度，包月设备不消耗按分钟计费的使用时长。') }}
                </template>
              </RxTooltip>
            </div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-6 font-600 tt-secondary">{{ state.monthlyDevices }}</span>
              <span class="text-3.5 tt-tertiary">{{ $t('台设备') }}</span>
            </div>
          </div>
          <RxButton variant="outlined" size="xxs" icon="base/rx_ic_plus" :label="$t('购买')" @click="openAction('monthly')" />
        </div>
      </section>
    </div>
    <AutoRenew />

    <ActionDialog v-model:visible="dialogVisible" :action="action" />
    <Dialog v-model:visible="showClaimConfirmation" :header="$t('领取您的云手机新手礼包')" modal :draggable="false" class="w-110 max-w-[calc(100vw-32px)]">
      <p class="m-0 text-3.5 leading-6 tt-secondary">
        {{ $t('当前为界面演示，操作仅更新预览状态，不会产生真实订单或扣款。') }}
      </p>
      <template #footer>
        <RxButton severity="secondary" outlined :label="$t('取消')" @click="showClaimConfirmation = false" />
        <RxButton :label="$t('应用演示')" @click="confirmClaim" />
      </template>
    </Dialog>
  </WalletServiceLayout>
</template>
