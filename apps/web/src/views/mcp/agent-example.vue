<script lang="ts" setup>
import AutoThemeImage from '/@/views/account/list/components/platform-icon.vue'
import { API } from '/@/api'

const emit = defineEmits(['select'])

const promptPreset = ref<any[]>([])

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
  <div class="flex items-center flex-wrap gap-2 select-none cursor-pointer min-h-[34px]">
    <RxButton v-for="item in promptPreset" :key="item.id" severity="secondary" variant="outlined" :label="item.promptTemplateTitle" @click="emit('select', item)">
      <template #icon>
        <AutoThemeImage class="h-4" :platform-icon="item.promptTemplateIconLight" :platform-icon-dark="item.promptTemplateIconDark" />
      </template>
    </RxButton>
  </div>
</template>
