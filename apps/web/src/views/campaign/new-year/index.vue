<script setup lang="ts">
import ActivityModal from '/@/views/campaign/new-year/activity-modal.vue'
import { AnimatePresence, motion } from 'motion-v'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { SubLevelEnum } from '/@/enums/pay'
import { safeParseJSON } from '/@/utils/basic'
import { emitter } from '/@/utils/eventBus'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const [showModal] = useDialog()

const hover = ref(false)
const opened = ref(safeParseJSON(localStorage.getItem(localStorageKey)))

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
    <img v-if="collapsed" class="block rounded aspect-ratio-1" src="/images/campaing/new-year/holiday_season.svg">
    <div v-else class="flex flex-col items-center justify-center">
      <motion.div class="relative rounded-2 overflow-hidden h-9 holiday" :class="{ hover }" :while-press="{ scale: 0.99 }" @mouseover="hover = true" @mouseleave="hover = false">
        <AnimatePresence mode="popLayout" :initial="false">
          <motion.div v-if="!hover" class="content" :initial="{ y: 60 }" :animate="{ y: 0 }" :exit="{ y: 60 }" :transition="{ type: 'spring', bounce: 0, duration: 0.3 }">
            {{ $t('双旦活动大促') }}
          </motion.div>
          <motion.div v-else class="content" :initial="{ y: -60 }" :animate="{ y: 0 }" :exit="{ y: -60 }" :transition="{ type: 'spring', bounce: 0, duration: 0.3 }">
            {{ $t('低至 3.8 折') }}
            <SvgIcon name="base/rx_ic_arrow_right" color="#fff" size="24" />
          </motion.div>
        </AnimatePresence>
        <motion.div class="absolute origin-[30px_30px]" :initial="false" :animate="{
          x: hover ? 126 : 126,
          y: hover ? -45 : -65,
          opacity: hover ? 0.2 : 0.8,
          rotate: hover ? 105 : 15,
        }" :transition="{ type: 'spring', bounce: 0, duration: 0.3 }" :style="{ transformStyle: 'preserve-3d' }"
        >
          <SvgIcon name="other/snow_flake" color="#fff" size="60" />
        </motion.div>
      </motion.div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.holiday {
  width: 190px;
  background-color: #c71813;
  perspective: 1000px;
}

.content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  width: 100%;
  height: 100%;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
</style>
