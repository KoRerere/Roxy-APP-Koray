<script setup lang="ts">
defineEmits(['close'])

function onRaffle() {
  console.log('onRaffle')
}
</script>

<template>
  <div class="w-120 flex flex-col gap-4 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('抽奖获取窗口订阅大奖') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col self-stretch gap-6">
      <div class=" tt-tertiary text-3.5 leading-5">
        {{ $t('点击下面抽奖的按钮进行抽奖，当中间的三个图标均为 💰💰💰 时，即可获得我们的一等奖：(每次抽取获奖概率约 5.1%)') }}
      </div>

      <div class=" tt-primary text-3.5 font-700 leading-5">
        {{ $t('🎁 专业版（1000 窗口）1 年使用权') }}
      </div>

      <RxButton :label="$t('开始抽奖')" size="lg" @click="onRaffle" />
    </div>
  </div>
</template>

<style lang="scss" module></style>

<style lang="scss" scoped></style>
