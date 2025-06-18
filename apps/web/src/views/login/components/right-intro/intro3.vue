<script setup lang="ts">
import Marquee from './marquee.vue'

function formatNumber(num: number) {
  return num.toString().padStart(2, '0')
}
</script>

<template>
  <div class="absolute bottom-12% left-0 w-full">
    <Marquee>
      <img v-for="i in 12" :key="i" :src="`/images/login/mq1/${formatNumber(i)}.svg`" alt="" class="size-100px cover">
    </Marquee>

    <Marquee>
      <img v-for="i in 6" :key="i" :src="`/images/login/mq2/${i}.svg`" alt="" class="h-89px cover">
    </Marquee>

    <Marquee reverse class="![--duration:20s]">
      <img v-for="i in 14" :key="i" :src="`/images/login/mq3/${formatNumber(i)}.svg`" alt="" class="size-100px cover">
    </Marquee>

    <Marquee reverse class="![--duration:30s]">
      <img v-for="i in 6" :key="i" :src="`/images/login/mq4/${formatNumber(i)}.svg`" alt="" class="h-89px cover">
    </Marquee>
  </div>
</template>