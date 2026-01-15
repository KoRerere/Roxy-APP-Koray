<script setup lang="ts">
// import { AnimatePresence, motion } from 'motion-v'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useSimpleLocale } from '/@/stores/locale'
import { SubLevelEnum } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'

const { collapsed = false } = defineProps<{
  collapsed?: boolean
}>()

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { realTheme } = storeToRefs(useThemeStore())
const { currentLocale } = storeToRefs(useSimpleLocale())

const imgSrc = computed(() => {
  const locale = currentLocale.value === 'ru' ? 'en' : currentLocale.value
  return `/images/campaing/gifts-${locale}-${realTheme.value}.png`
})

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
    <div class="relative h-9 px-3 flex flex-col items-center justify-center rounded-1 overflow-hidden holiday">
      <SvgIcon v-if="collapsed" name="base/rx_ic_gift_2" size="16" color="var(--campaign-giftcard-icon-giftcard)" />
      <div v-else class="flex items-center justify-between w-full">
        <SvgIcon class="absolute -top-3 left-6 opacity-5 -rotate-15" name="base/rx_ic_gift_2" size="48" color="var(--campaign-giftcard-icon-giftcard)" />
        <img class="h-3.75 block" :src="imgSrc">
        <SvgIcon name="base/rx_ic_arrow_right_2" color="var(--colors-icon-icon-primary)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.holiday {
  background: var(--campaign-giftcard-bg-giftcard);
}
</style>
