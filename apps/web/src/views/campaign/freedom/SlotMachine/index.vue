<script lang="tsx" setup>
import SlotMachine from './SlotMachine.vue'
import RxButton from '/@/components/rx-button'
import { RxAlert } from '/@/components/rx-alert'
import { API } from '/@/api'

defineProps<{
  hideModal: () => void
}>()

const slotMachineRef = ref()

const result = ref<'win' | 'lose'>()

const loading = ref(false)

async function handleStart() {
  loading.value = true
  slotMachineRef.value?.start()
  // 1. 调用后端接口，然后接口会返回 true or false 是中奖
  const { data } = await API.base.userMayFreedomResultList()
  slotMachineRef.value?.stop(data)
}

function handleStopped(value) {
  result.value = value ? 'win' : 'lose'
  loading.value = false
}
</script>

<template>
  <div class="flex flex-col gap-4 w-full py-4 px-6">
    <div class="flex justify-between items-center">
      <span class="text-[var(--colors-text-text-primary)] text-4 font-700">{{ $t('抽奖获取窗口订阅大奖') }}</span>
      <!-- <SvgIcon name="base/rx_ic_delete" size="20" class="cursor-pointer" @click="hideModal" /> -->
    </div>

    <div class="text-[var(--colors-text-text-primary)] flex flex-col gap-6 text-3.5 pb-2">
      <div class="text-[var(--colors-text-text-tertiary)]">
        {{ $t('点击下面抽奖的按钮进行抽奖，当中间的三个图标均为 💰💰💰 时，即可获得我们的一等奖：(每次抽取获奖概率约 5.1%)') }}
      </div>
      <div class="font-700">
        {{ $t('🎁 专业版（1000 窗口）1 年使用权') }}
      </div>
      <SlotMachine ref="slotMachineRef" @stopped="handleStopped" />
    </div>

    <div class="flex flex-col gap-3 w-full pb-2">
      <RxAlert v-if="result === 'lose'" type="warn" :title="$t('很遗憾，本次暂未中奖。感谢您的参与！')" class="w-full" />
      <RxButton v-if="result !== 'lose'" size="lg" class="w-full" :loading @click="handleStart">
        {{ $t('开始抽奖') }}
      </RxButton>
      <RxButton v-else severity="secondary" outlined class="flex-shrink-0" @click="hideModal">
        {{ $t('返回') }}
      </RxButton>
    </div>
  </div>
</template>
