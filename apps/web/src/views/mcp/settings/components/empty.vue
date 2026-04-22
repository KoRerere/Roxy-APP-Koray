<script setup lang="ts">
defineProps<{
  icon: string
  title: string
}>()
</script>

<template>
  <div class="px-12 py-3 min-h-235px flex items-center justify-center bg-[var(--colors-background-bg-block)] rounded-2">
    <div class="flex flex-col items-center gap-3">
      <SvgIcon :name="icon" size="42" color="var(--colors-icon-icon-tertiary)" />
      <div class="text-center flex flex-col gap-1">
        <div class="font-['Inter'] text-4 font-bold text-[var(--colors-text-text-inactive)]">
          {{ title }}
        </div>
        <div class="font-['Inter'] text-3 text-[var(--colors-text-text-inactive)] leading-[1.4]">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
