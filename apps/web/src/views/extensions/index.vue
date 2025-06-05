<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import hub from './hub/index.vue'
import list from './install/index.vue'

const role = useRoleStore()
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
    visible: role.isOwner || role.isManager
  },
].filter(tab => tab.visible !== false),
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
  else if (value === 'hub' && syncHub.value) {
    hubRef.value?.refresh()
    syncHub.value = false
  }
}
function onSearch() {
  if (tabs.value[1]) {
    tabsValue.value = tabs.value[1].value
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full extensions">
    <RxTabs class="flex-1 overflow-hidden" v-model:value="tabsValue" :tabs="tabs" head-tabs @update:value="onChange">
      <template #installed>
        <list ref="listref" v-model:needsync="syncHub" @search="onSearch" />
      </template>
      <template #hub>
        <hub ref="hubref" v-model:needsync="syncList" />
      </template>
    </RxTabs>
  </div>
</template>

<style lang="scss" scoped></style>
