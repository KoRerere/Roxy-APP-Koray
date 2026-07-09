<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  badge?: string
}>()
</script>

<template>
  <div class="ecommerce-page flex flex-col h-full w-full">
    <header class="ecommerce-page__header flex-shrink-0 px-6 pt-5 pb-4 border-b border-[var(--colors-border-border-base)]">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold text-[var(--colors-text-text-primary)]">
          {{ title }}
        </h1>
        <span v-if="badge" class="px-2 py-0.5 text-xs rounded-full bg-[var(--colors-background-bg-brand-subtle)] text-[var(--colors-text-text-brand)]">
          {{ badge }}
        </span>
      </div>
      <p v-if="description" class="mt-1 text-sm text-[var(--colors-text-text-secondary)]">
        {{ description }}
      </p>
    </header>
    <main class="ecommerce-page__body flex-1 min-h-0 overflow-hidden">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.ecommerce-page {
  background: var(--colors-background-bg-base);
}
</style>
