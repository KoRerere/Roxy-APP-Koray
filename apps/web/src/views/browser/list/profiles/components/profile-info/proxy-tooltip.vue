<script setup lang="ts">
defineProps<{
  lastCountry?: string
  lastCity?: string
  lastIp?: string
  checkTime?: string
  beforeCountry?: string
  beforeCity?: string
  beforeIp?: string
  beforeTime?: string
}>()
</script>

<template>
  <div class="w-216px flex flex-col gap-12px">
    <template v-if="beforeCountry !== '--' && beforeIp !== lastIp">
      <div class="flex flex-col gap-4px">
        <div class="flex gap-8px items-center">
          <SvgIcon class="size-16px" fallback="base/rx_ic_earth" :name="(`country-code/${beforeCountry}` as any)" />
          <div class="flex-1 text-12px text-[var(--component-tooltip-text-secondary)] font-600 ellipsis-1">
            {{ beforeCountry }}{{ beforeCity }}
          </div>
          <div class="text-12px text-[var(--component-tooltip-text-secondary)] font-400">
            {{ beforeTime }}
          </div>
        </div>
        <div class="pl-24px text-12px text-[var(--component-tooltip-text-secondary)] font-600 ellipsis-1">
          IP: {{ beforeIp }}
        </div>
      </div>

      <div class="border-0 border-t-0.5 border-dashed border-[var(--component-tooltip-divider)]" />
    </template>

    <div class="flex flex-col gap-4px">
      <div class="flex gap-8px items-center">
        <SvgIcon class="size-16px" fallback="base/rx_ic_earth" :name="(`country-code/${lastCountry}` as any)" />
        <div class="flex-1 text-12px text-[var(--component-tooltip-text-primary)] font-600 ellipsis-1">
          {{ lastCountry }}{{ lastCity }}
        </div>
        <div class="text-12px text-[var(--component-tooltip-text-secondary)] font-400">
          {{ checkTime }}
        </div>
      </div>
      <div class="pl-24px text-12px text-[var(--component-tooltip-text-primary)] font-600 ellipsis-1">
        IP: {{ lastIp }}
      </div>
    </div>
  </div>
</template>
