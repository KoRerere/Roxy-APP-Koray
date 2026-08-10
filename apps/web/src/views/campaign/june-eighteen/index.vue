<script setup lang="ts">
import type { UseDialogInstance } from '/@/hooks/useDialog'
import ActivityModal from './activity-modal.vue'
import AgentUpgradeModal from './agent-upgrade-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useCampaignStore } from '/@/stores/campaign'
import { useUserStore } from '/@/stores/user'
import { useOpenRoxyAIAgent } from '/@/hooks/useOpenRoxyAIAgent'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { emitter } from '/@/utils/eventBus'
import { OrderType } from '/@/enums/pay'
import { enhanceCountdown, getImage, safeParseJSON } from '/@/utils/basic'
import { supportsApp4_0_2 } from '/@/utils/app-supports'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const REOPEN_INTERVAL_MS = 1000 * 60 * 60 * 8
const AGENT_MODAL_STORAGE_KEY = '$AgentUpgradeModalStatus'
const AGENT_MODAL_NEVER_REMIND_STORAGE_KEY = '$AgentUpgradeModalNeverRemind'
const activityNextOpenStorageKey = `${localStorageKey}:nextOpen`
const agentNextOpenStorageKey = `${AGENT_MODAL_STORAGE_KEY}:nextOpen`

const router = useRouter()
const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const { openRoxyAIAgent } = useOpenRoxyAIAgent()
const [showModal] = useDialog()

type ModalKind = 'activity' | 'agent'

const activityCountdown = ref<ReturnType<typeof enhanceCountdown>>()
const agentCountdown = ref<ReturnType<typeof enhanceCountdown>>()
const dialogInstance = ref<UseDialogInstance>()
const currentModal = ref<ModalKind>()
const activityRequested = ref(false)
const agentRequested = ref(false)
const activityOpened = ref(safeParseJSON(sessionStorage.getItem(localStorageKey)))
const agentOpened = ref(safeParseJSON(sessionStorage.getItem(AGENT_MODAL_STORAGE_KEY)))
const agentNeverRemind = ref(safeParseJSON(localStorage.getItem(AGENT_MODAL_NEVER_REMIND_STORAGE_KEY)))
const agentSupported = ref(!globalThis.isElectron)

const imageSrc = computed(() => {
  return getImage(`campaing/june-eighteen/mini.png`)
})

onMounted(() => {
  void resolveAppVersion().finally(() => {
    requestModal('agent')
    requestModal('activity')
  })
})

onBeforeUnmount(() => {
  activityCountdown.value?.stop()
  agentCountdown.value?.stop()
  activityCountdown.value = undefined
  agentCountdown.value = undefined
  void dialogInstance.value?.hideModal()
})

async function resolveAppVersion() {
  if (globalThis.isElectron && !globalThis.$appVersion) {
    globalThis.$appVersion = await globalThis.electronAPI.send('app:getAppVersion')
  }
  agentSupported.value = supportsApp4_0_2()
}

function markDismissed(kind: ModalKind) {
  const storageKey = kind === 'activity' ? localStorageKey : AGENT_MODAL_STORAGE_KEY
  if (kind === 'activity')
    activityOpened.value = true
  else
    agentOpened.value = true
  sessionStorage.setItem(storageKey, JSON.stringify(true))
}

/** 两张海报分别记录已读与重弹时间；当前海报关闭后再展示队列中的下一张。 */
function onDismiss(kind: ModalKind, schedule = true) {
  if (currentModal.value !== kind)
    return

  dialogInstance.value = undefined
  currentModal.value = undefined
  markDismissed(kind)
  if (schedule)
    scheduleReopen(kind)
  void nextTick(drainModalQueue)
}

function requestModal(kind: ModalKind, force = false) {
  if (kind === 'activity' && !seasonalActivity.value.juneEighteen)
    return
  if (kind === 'agent' && agentNeverRemind.value)
    return

  const opened = kind === 'activity' ? activityOpened.value : agentOpened.value
  if (!force && opened) {
    scheduleReopen(kind)
    return
  }

  if (kind === 'activity')
    activityRequested.value = true
  else
    agentRequested.value = true

  drainModalQueue()
}

function drainModalQueue() {
  if (currentModal.value || dialogInstance.value)
    return

  if (agentRequested.value) {
    agentRequested.value = false
    openAgentModal()
  }
  else if (activityRequested.value) {
    activityRequested.value = false
    openActivityModal()
  }
}

function openActivityModal() {
  currentModal.value = 'activity'
  dialogInstance.value = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-1110',
    },
    handleCancel: () => onDismiss('activity'),
    slots: {
      container: ({ hideModal }) => h(ActivityModal, {
        onClose: () => {
          void hideModal().then(closed => closed && onDismiss('activity'))
        },
        onConfirm: () => {
          onCharge()
          router.push({ name: 'wallet' })
        },
      }),
    },
  })
}

function openAgentModal() {
  currentModal.value = 'agent'
  dialogInstance.value = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-1110',
    },
    handleCancel: () => onDismiss('agent'),
    slots: {
      container: ({ hideModal }) => h(AgentUpgradeModal, {
        agentSupported: agentSupported.value,
        onClose: () => {
          void hideModal().then(closed => closed && onDismiss('agent'))
        },
        onNeverRemind: () => permanentlyDismissAgent(hideModal),
        onConfirm: onAgentConfirm,
      }),
    },
  })
}

function permanentlyDismissAgent(hideModal: UseDialogInstance['hideModal']) {
  agentNeverRemind.value = true
  agentRequested.value = false
  agentCountdown.value?.stop()
  agentCountdown.value = undefined
  localStorage.setItem(AGENT_MODAL_NEVER_REMIND_STORAGE_KEY, JSON.stringify(true))
  sessionStorage.removeItem(agentNextOpenStorageKey)
  void hideModal().then(closed => closed && onDismiss('agent', false))
}

function scheduleReopen(kind: ModalKind) {
  const countdown = kind === 'activity' ? activityCountdown : agentCountdown
  if (countdown.value)
    return

  const nextOpenStorageKey = kind === 'activity' ? activityNextOpenStorageKey : agentNextOpenStorageKey
  const stored = Number(sessionStorage.getItem(nextOpenStorageKey))
  const hasStored = Number.isFinite(stored) && stored > 0

  if (hasStored && stored <= Date.now()) {
    sessionStorage.removeItem(nextOpenStorageKey)
    requestModal(kind, true)
    return
  }

  const nextOpenAt = hasStored ? stored : Date.now() + REOPEN_INTERVAL_MS
  if (!hasStored)
    sessionStorage.setItem(nextOpenStorageKey, String(nextOpenAt))

  countdown.value = enhanceCountdown(nextOpenAt, () => { }, {
    onEnd: () => {
      countdown.value = undefined
      sessionStorage.removeItem(nextOpenStorageKey)
      requestModal(kind, true)
    },
  })
}

function onAgentConfirm() {
  if (agentSupported.value) {
    void openRoxyAIAgent()
    return
  }

  void upgradeApp()
}

async function upgradeApp() {
  const updateInfo = await globalThis.electronAPI.send('app:checkForUpdates')
  if (updateInfo?.status === 'downloaded') {
    await globalThis.electronAPI.send('app:quitAndInstall', { type: 'app' })
  }
}

function onCharge() {
  walletRecharge({
    next: (data) => {
      openProcessing(data, OrderType.Recharge)
        .finally(() => {
          emitter.emit('updateBillList')
          getUserPayInfo()
        })
    },
  })
}
</script>

<template>
  <div class="cursor-pointer" @click="requestModal('activity', true)">
    <div class="relative h-9 flex items-center justify-center rounded-1.5 select-none overflow-hidden">
      <div v-if="collapsed" class="w-full aspect-square flex items-center justify-center icon">
        {{ $t('赠送 {value}', { value: `${maxBonus}%` }) }}
      </div>
      <template v-else>
        <div class="relative w-full px-3 z-1 text">
          {{ $t('充值最高赠送 {value}', { value: `${maxBonus}%` }) }}
        </div>
        <img draggable="false" class="absolute inset-0 h-full" :src="imageSrc">
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.text {
  color: #111213;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
}

.icon {
  color: #111213;
  font-family: 'DingTalk JinBuTi';
  font-size: 10px;
  text-align: center;
  background: linear-gradient(93deg, #d7eefe 0%, #9bd6fd 106.84%);
}
</style>
