<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { $t } from '/@/locales'
import hub from './hub/index.vue'
import list from './install/index.vue'

const tabs = ref([
  { title: $t('已安装扩展'), value: 'Installed' },
  { title: $t('扩展推荐'), value: 'hub' },
])

const tabsValue = ref('Installed')

const listRef = useTemplateRef('listref')
const hubRef = useTemplateRef('hubref')

const syncList = ref(false)
const syncHub = ref(false)

function onChange(value: any) {
  if (value === 'Installed' && syncList.value) {
    listRef.value?.refresh()
    syncList.value = false
  }
  else if (value === 'hub' && syncHub.value) {
    hubRef.value?.refresh()
    syncHub.value = false
  }
}
function onSearch() {
  tabsValue.value = tabs.value[1].value
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <ViewsHeader :title="($route.meta.title as string)" />
    <Tabs v-model:value="tabsValue" class="flex-1 overflow-hidden" @update:value="onChange">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
      <TabPanels class="flex flex-1 !pa-0 overflow-hidden">
        <TabPanel class="flex-1" value="Installed">
          <!-- eslint-disable-next-line vue/no-unused-refs -->
          <list ref="listref" v-model:needsync="syncHub" @search="onSearch" />
        </TabPanel>
        <TabPanel class="flex flex-1" value="hub">
          <!-- eslint-disable-next-line vue/no-unused-refs -->
          <hub ref="hubref" v-model:needsync="syncList" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style lang="scss" scoped></style>
