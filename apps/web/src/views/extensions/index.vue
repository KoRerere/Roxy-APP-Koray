<script setup lang="ts">
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
    <RxTabs v-model:value="tabsValue" class="flex-1 overflow-hidden" :tabs="tabs" head-tabs @update:value="onChange">
      <template #installed>
        <div class="w-full flex flex-col">
          <RxAlert class="!w-full pl-6 rounded-0" type="info" :title="$t('仅支持在 Google 内核窗口中安装或上传扩展。火狐内核窗口请打开浏览器后完成安装。')" :closable="false" />
          <div class="flex-1 overflow-hidden">
            <Install ref="listref" v-model:needsync="syncHub" @search="onSearch" />
          </div>
        </div>
      </template>
      <template #hub>
        <div class="w-full flex flex-col">
          <RxAlert class="!w-full pl-6 rounded-0" type="info" :title="$t('仅支持在 Google 内核窗口中安装或上传扩展。火狐内核窗口请打开浏览器后完成安装。')" :closable="false" />
          <div class="flex flex-1 overflow-hidden">
            <Hub ref="hubref" v-model:needsync="syncList" />
          </div>
        </div>
      </template>
    </RxTabs>
  </div>
</template>

<style lang="scss" scoped></style>
