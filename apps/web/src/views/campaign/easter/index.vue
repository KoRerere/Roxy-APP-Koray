<script setup lang="ts">
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { SubLevelEnum } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { safeParseJSON } from '/@/utils/basic'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const [showModal] = useDialog()
const { mixpanelTrack } = useUserStore()

const opened = ref(safeParseJSON(localStorage.getItem(localStorageKey)))
const easterText = ref()

watch(() => userPayInfo.value.isEaster, (newVal) => {
  if (newVal !== undefined) {
    easterText.value = newVal ? $t('专属 5 折复活蛋') : $t('寻复活彩蛋，领大奖')
  }
}, { immediate: true })

onMounted(() => {
  openModal()
})

function openModal(force = false) {
  if (!force && opened.value)
    return

  if (force) {
    mixpanelTrack('easter_2026', { easter_entrance_type: 'App' })
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-1110',
    },
    slots: {
      container: ({ hideModal }) => h(ActivityModal, {
        onClose: () => {
          hideModal()
          localStorage.setItem(localStorageKey, JSON.stringify(true))
        },
        onConfirm: () => {
          goToSubscribePlan()
        },
      }),
    },
  })
}

function goToSubscribePlan() {
  const isSubscribe = [SubLevelEnum.Free, SubLevelEnum.Trial, SubLevelEnum.Expired].includes(userPayInfo.value.subLevel as SubLevelEnum)
  if (isSubscribe) {
    router.push({ name: 'subscribe-plan' })
  }
  else if (userPayInfo.value.isAuto) {
    router.push({ name: 'upgrade-plan' })
  }
  else {
    emitter.emit('showRenewalDialog', {
      paySuccess: () => {
        router.replace({ name: 'wallet', query: { name: 'manage' } })
        emitter.emit('updateBillList')
      },
    })
  }
}
</script>

<template>
  <div v-if="easterText" class="cursor-pointer" @click="openModal(true)">
    <div class="relative h-9 flex items-center justify-center rounded-1.5 select-none overflow-hidden">
      <img v-if="collapsed" class="block w-full aspect-square" src="/images/campaing/easter/egg.png">
      <template v-else>
        <div class="relative w-full px-3 z-1 text">
          {{ easterText }}
        </div>
        <img draggable="false" class="absolute inset-0 h-full" src="/images/campaing/easter/mini_banner.png">
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.text {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  font-weight: 700;
}
</style>
