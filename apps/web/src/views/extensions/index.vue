<script setup lang="ts">
import { useTemplateRef } from 'vue'

import Hub from './hub/index.vue'
import Install from './install/index.vue'

const tabs = ref([
  {
    title: $t('已安装扩展'),
    value: 'installed',
    slot: 'installed',
  },
  {
    title: $t('扩展推荐'),
    value: 'hub',
    slot: 'hub',
  },
]
)

const tabsValue = ref('installed')

const listRef = useTemplateRef('listref')
const hubRef = useTemplateRef('hubref')

const syncList = ref(false)
const syncHub = ref(false)

function onChange(value: any) {
  if (value === 'installed' && syncList.value) {
    listRef.value?.refresh()
    syncList.value = false
  }
  else if (value === 'hub') {
    hubRef.value?.getRecommendPluginList()
    if (syncHub.value) {
      hubRef.value?.refresh()
      syncHub.value = false
    }
  }
}
function onSearch() {
  if (tabs.value[1]) {
    hubRef.value?.getRecommendPluginList()
    tabsValue.value = tabs.value[1].value
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full extensions">
    <RxTabs class="flex-1 overflow-hidden" v-model:value="tabsValue" :tabs="tabs" head-tabs @update:value="onChange">
      <template #installed>
        <Install ref="listref" v-model:needsync="syncHub" @search="onSearch" />
      </template>
      <template #hub>
        <Hub ref="hubref" v-model:needsync="syncList" />
      </template>
    </RxTabs>
  </div>
</template>

<style lang="scss" scoped></style>
