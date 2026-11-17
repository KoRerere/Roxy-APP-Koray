import { addDays } from 'date-fns'
import { computed, reactive, watch } from 'vue'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'

export type CloudPhoneWalletAction = 'plan' | 'time' | 'monthly' | 'change' | 'renew' | 'auto-renew'

export interface CloudPhonePlan {
  quantity: number
  used: number
  expiresAt: number
  autoRenew: boolean
  trial: boolean
}

interface CloudPhoneWalletDemo {
  plan: CloudPhonePlan | null
  trialClaimed: boolean
  totalMinutes: number
  usedMinutes: number
  monthlyDevices: number
}

// 界面演示状态按账号、工作区隔离，仅在内存中保存；不调用结算接口或修改真实余额。
const demos = reactive<Record<string, CloudPhoneWalletDemo>>({})

export function useCloudPhoneWallet() {
  const userStore = useUserStore()
  const workspaceStore = useWorkspaceStore()
  const scopeKey = computed(() => `${userStore.userInfo.id ?? 'guest'}:${workspaceStore.currentWorkspace?.id ?? 'default'}`)
  watch(scopeKey, (key) => {
    demos[key] ??= {
      plan: null,
      trialClaimed: false,
      totalMinutes: 0,
      usedMinutes: 0,
      monthlyDevices: 0,
    }
  }, { immediate: true, flush: 'sync' })
  const state = computed(() => demos[scopeKey.value]!)

  function claimTrial() {
    if (state.value.trialClaimed || state.value.plan) {
      return
    }
    state.value.plan = { quantity: 1, used: 0, expiresAt: addDays(new Date(), 30).getTime(), autoRenew: false, trial: true }
    state.value.totalMinutes += 30
    state.value.trialClaimed = true
  }

  function applyDemo(action: CloudPhoneWalletAction, values: { quantity: number, days: number, minutes: number, monthlyDevices: number, autoRenew: boolean }) {
    if (action === 'time') {
      state.value.totalMinutes += values.minutes
      return
    }
    if (action === 'monthly') {
      state.value.monthlyDevices = values.monthlyDevices
      return
    }
    if (action === 'auto-renew') {
      if (state.value.plan) {
        state.value.plan.autoRenew = values.autoRenew
      }
      return
    }
    const current = state.value.plan
    state.value.plan = {
      quantity: values.quantity,
      used: current?.used ?? 0,
      expiresAt: action === 'change' && current
        ? current.expiresAt
        : addDays(new Date(action === 'renew' && current ? Math.max(Date.now(), current.expiresAt) : Date.now()), values.days).getTime(),
      autoRenew: values.autoRenew,
      trial: false,
    }
    state.value.monthlyDevices = Math.min(state.value.monthlyDevices, values.quantity)
  }

  return { state, claimTrial, applyDemo }
}
