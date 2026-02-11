<script setup lang="ts">
import ActivityModal from '/@/views/campaign/spring-festival/activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { SubLevelEnum } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { safeParseJSON } from '/@/utils/basic'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const router = useRouter()
const { currentLocale } = storeToRefs(useSimpleLocale())
const { userPayInfo } = storeToRefs(useUserStore())
const [showModal] = useDialog()
const opened = ref(safeParseJSON(localStorage.getItem(localStorageKey)))

const imageSrc = computed(() => {
  const suffix = ['en', 'ru'].includes(currentLocale.value!) ? 'en' : 'zh-CN'
  return `/images/campaing/spring-festival/title_${suffix}.svg`
})

onMounted(() => {
  openModal()
})

function openModal() {
  if (opened.value)
    return

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
        onConfirm: goToSubscribePlan,
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
  <div class="cursor-pointer" @click="goToSubscribePlan">
    <div class="relative h-9 px-3 flex flex-col items-center justify-center rounded-1.5 overflow-hidden holiday">
      <SvgIcon v-if="collapsed" name="other/lion_dance" size="20" />
      <div v-else class="flex items-center self-stretch gap-2">
        <SvgIcon name="other/lion_dance" size="20" />
        <img draggable="false" :src="imageSrc">
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.holiday {
  background:
    radial-gradient(74.13% 65.78% at 50% 100%, rgba(255, 154, 78, 0.7) 0%, rgba(255, 154, 78, 0) 100%), #f63016;
}
</style>
