<script setup lang="ts">
import Wallet from '../manage/wallet.vue'
import BankCards from '../manage/bank-cards.vue'
import { useUserStore } from '/@/stores/user'

withDefaults(defineProps<{ fillHeight?: boolean }>(), { fillHeight: false })

const { getUserPayInfo } = useUserStore()
const balanceRefreshUi = ref<'idle' | 'loading' | 'success'>('idle')
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let successTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false

onBeforeMount(() => getUserPayInfo())
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(refreshTimer)
  clearTimeout(successTimer)
})

async function onRefresh() {
  if (balanceRefreshUi.value !== 'idle') {
    return
  }
  balanceRefreshUi.value = 'loading'
  const startedAt = Date.now()
  try {
    await getUserPayInfo()
    if (disposed) {
      return
    }
    refreshTimer = setTimeout(() => {
      balanceRefreshUi.value = 'success'
      successTimer = setTimeout(() => {
        balanceRefreshUi.value = 'idle'
      }, 2000)
    }, Math.max(0, 1000 - (Date.now() - startedAt)))
  }
  catch {
    if (!disposed) {
      balanceRefreshUi.value = 'idle'
    }
  }
}
</script>

<template>
  <div class="h-full w-full overflow-x-auto overflow-y-hidden">
    <div class="rx-container h-full">
      <div class="h-full flex items-stretch justify-center gap-7 px-10">
        <div class="wallet-scroll-col h-full min-w-0 max-w-155 flex-1 overflow-y-auto">
          <div class="flex flex-col gap-5 pb-10 pt-8" :class="{ 'min-h-full': fillHeight }">
            <slot />
          </div>
        </div>
        <div class="my-8 w-0 shrink-0 border-l border-l-dashed border-[var(--colors-border-border-subtle)]" />
        <div class="wallet-scroll-col h-full w-95 shrink-0 overflow-y-auto">
          <div class="flex flex-col pb-10 pt-8">
            <Wallet :balance-refresh-ui="balanceRefreshUi" @refresh="onRefresh" />
            <BankCards class="-mt-49.5" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-scroll-col {
  scrollbar-width: none;
}

.wallet-scroll-col::-webkit-scrollbar {
  display: none;
}
</style>
