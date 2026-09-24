<script setup lang="ts">
import { getPrizeTierName } from './prize'
import type { LotteryPrize } from './prize'
import { getImage } from '/@/utils'

const props = defineProps<{
  /** 本次抽中的奖品 */
  prize: LotteryPrize
}>()

const emit = defineEmits<{
  /** 关闭结果弹窗 */
  close: []
  /** 关掉结果后打开我的奖品列表 */
  viewPrizes: []
  /** 关掉结果后重新打开抽奖盘 */
  continueDraw: []
}>()

const imgSrc = `url('${getImage('campaing/mid-autumn-festival/lottery/draw_bg.png')}')`

/** 档位对应的奖项名，如四等奖 */
const prizeName = computed(() => getPrizeTierName(props.prize.prizeTier))
</script>

<template>
  <div class="relative w-120 flex flex-col pa-8 pt-10 gap-6 rounded-2 overflow-hidden result">
    <SvgIcon class="absolute top-6 right-6 cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="emit('close')" />

    <div class="flex flex-col items-center gap-2 pt-5">
      <img draggable="false" class="w-20" :src="getImage('campaing/mid-autumn-festival/lottery/salute.png')">
      <div class="text-6 font-700 leading-9 tt-primary text-center">
        {{ prizeName }}
      </div>
      <div class="flex items-center">
        <span class="text-4 leading-6 tt-secondary text-center">{{ prize.prizeContent }}</span>
        <SvgIcon v-if="prize.desc" v-tooltip="prize.desc" class="cursor-pointer" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
      </div>
    </div>

    <div class="-mt-2 flex items-center justify-center gap-1">
      <SvgIcon name="base/rx_ic_check_fill" size="18" color="var(--colors-icon-icon-success)" />
      <span class="tt-secondary text-3.5 font-500 leading-normal">{{ $t('权益已发放至您的账户') }}</span>
    </div>

    <div class="flex flex-col gap-3">
      <RxButton severity="secondary" variant="outlined" size="lg" class="w-full" :label="$t('查看我的奖品')" @click="emit('viewPrizes')" />
      <RxButton size="lg" class="w-full" :label="$t('继续抽奖')" @click="emit('continueDraw')" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.result {
  background-image: v-bind(imgSrc);
  background-size: 100% auto;
  background-position: top right;
  background-repeat: no-repeat;
}
</style>
