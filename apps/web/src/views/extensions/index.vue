<script setup lang="ts">
import type { UserGetPluginListListData } from '@roxy/backend-api'
import Hub from './hub/index.vue'
import Install from './install/index.vue'
import { RxAlert } from '/@/components/rx-alert'

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
])
// 进入页面，没装插件优先展示扩展推荐tab,已装插件优先展示已装列表tab
let isFirstInto = true

const tabsValue = ref('installed')

const listRef = useTemplateRef('listref')
const hubRef = useTemplateRef('hubref')

const syncList = ref(false)
const syncHub = ref(false)

function onChange(value: any) {
  isFirstInto = false
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

function onInstalledDataChange(result: UserGetPluginListListData) {
  if (!isFirstInto) {
    return
  }

  isFirstInto = false
  if (result?.data?.rows?.length === 0) {
    tabsValue.value = 'hub'
    onChange('hub')
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full extensions">
    <RxTabs v-model:value="tabsValue" class="flex-1 overflow-hidden" :tabs="tabs" head-tabs @update:value="onChange">
      <template #installed>
        <div class="w-full flex flex-col">
          <div class="flex-1 overflow-hidden">
            <Install ref="listref" v-model:needsync="syncHub" @search="onSearch" @data-change="onInstalledDataChange" />
          </div>
        </div>
      </template>
      <template #hub>
        <div class="w-full flex flex-col">
          <div class="flex flex-1 overflow-hidden">
            <Hub ref="hubref" v-model:needsync="syncList" />
          </div>
        </div>
      </template>
    </RxTabs>
  </div>
</template>

<style lang="scss" scoped></style>
