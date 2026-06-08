<script lang="ts" setup>
import AutoThemeImage from '/@/views/account/list/components/platform-icon.vue'
import { useMcpDataStore } from '../pinia-store/mcp-data-store'

const emit = defineEmits(['select'])

const store = useMcpDataStore()

const promptPreset = computed(() => store.promptPresets || [])

const groupedPresets = computed(() => {
  const map = new Map<string, any[]>()
  for (const item of promptPreset.value) {
    const category = item.promptTemplateCategory || ''
    if (!map.has(category))
      map.set(category, [])
    map.get(category)!.push(item)
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }))
})

onMounted(() => {
  store.fetchPromptPresets()
})
</script>

<template>
  <div class="flex flex-col gap-5 select-none">
    <div class="text-[var(--colors-text-text-primary)] font-500 leading-20px text-14px">
      {{ $t('常用快捷提示词') }}
    </div>
    <div v-for="group in groupedPresets" :key="group.category" class="flex flex-col gap-2 items-start w-full">
      <div v-if="group.category" class="flex items-center gap-1.5 text-xs leading-4 text-[var(--colors-text-text-secondary)]">
        <AutoThemeImage class="h-4" :platform-icon="group.items[0].promptTemplateIconLight" :platform-icon-dark="group.items[0].promptTemplateIconDark" />
        {{ group.category }}
      </div>
      <div class="flex flex-wrap gap-1.5 w-full">
        <RxButton v-for="item in group.items" :key="item.id" class="cursor-pointer" severity="secondary" variant="outlined" :label="item.promptTemplateTitle" @click="emit('select', item)" />
      </div>
    </div>
  </div>
</template>
