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
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="extensions-header">
      {{ $route.meta.title }}
    </div>
    <Tabs class="flex-1 overflow-hidden" :value="tabsValue" @update:value="onChange">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
      <TabPanels class="flex flex-1 !pa-0 overflow-hidden">
        <TabPanel class="flex-1" value="Installed">
          <!-- eslint-disable-next-line vue/no-unused-refs -->
          <list ref="listref" v-model:needsync="syncHub" />
        </TabPanel>
        <TabPanel class="flex flex-1" value="hub">
          <!-- eslint-disable-next-line vue/no-unused-refs -->
          <hub ref="hubref" v-model:needsync="syncList" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style lang="scss" scoped>
.extensions-header {
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
  gap: 10px;
  height: 48px;
  color: #000;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);
  border-bottom: none;
}
</style>
