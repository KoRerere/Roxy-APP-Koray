<script lang="ts" setup>
import AutoThemeImage from '/@/views/account/list/components/platform-icon.vue'
import { API } from '/@/api'

const emit = defineEmits(['select'])

const promptPreset = ref<any[]>([])

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

async function getPromptPreset() {
  const { code, data } = await API.base.userGetPromptTemplateListList()
  if (code !== 0)
    return
  promptPreset.value = data
}

onMounted(() => {
  getPromptPreset()
})
</script>

<template>
  <div class="flex flex-col gap-5 select-none">
    <div v-for="group in groupedPresets" :key="group.category" class="flex flex-col gap-2 items-start w-full">
      <div v-if="group.category" class="flex items-center gap-1.5 font-['Inter'] text-xs leading-4 text-[var(--colors-text-text-secondary)]">
        <AutoThemeImage class="h-4" :platform-icon="group.items[0].promptTemplateIconLight" :platform-icon-dark="group.items[0].promptTemplateIconDark" />
        {{ group.category }}
      </div>
      <div class="flex flex-wrap gap-1.5 w-full">
        <RxButton v-for="item in group.items" :key="item.id" class="cursor-pointer" severity="secondary" variant="outlined" :label="item.promptTemplateTitle" @click="emit('select', item)" />
      </div>
    </div>
  </div>
</template>
