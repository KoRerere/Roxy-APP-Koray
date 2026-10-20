<script setup lang="ts">
export interface ActivityCountdownUnit {
  label: string
  value: string
}

defineProps<{
  items: ActivityCountdownUnit[]
}>()
</script>

<template>
  <div class="flex items-start gap-3">
    <template v-for="(item, index) in items" :key="item.label">
      <span v-if="index !== 0" class="w-1 h-14 shrink-0 flex items-center justify-center text-8 leading-none color-white/60" aria-hidden="true">:</span>
      <div class="flex flex-col items-center gap-0.5">
        <div class="size-14 flex items-center justify-center rounded-2 border-2 border-solid border-[#fbd99b] bg-black/10 backdrop-blur-[6px] font-['JetBrains_Mono'] text-6 font-700 leading-9 color-white tabular-nums">
          {{ item.value }}
        </div>
        <div class="color-white text-3.25 leading-5 whitespace-nowrap">
          {{ item.label }}
        </div>
      </div>
    </template>
  </div>
</template>
