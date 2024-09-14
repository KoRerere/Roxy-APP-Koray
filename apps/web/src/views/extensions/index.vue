<script setup lang="ts">
import hub from './hub/index.vue'
import list from './install/index.vue'
import { API } from '/@/api'

const tabs = ref([
  { title: 'Intalled', value: 'intalled' },
  { title: 'Extension Hub', value: 'hub' },
])

const tabsValue = ref('intalled')

const categoryList = ref()

const extensionList = ref()

const userExtensionList = ref()

onBeforeMount(() => {
  getExtensionHubCategory()
  // getUserExtensionList()
})

/**
 * 获取插件列表
 */
async function getExtensionList(params: any) {
  const { data } = await API.plugins.userGetSystemPluginList(params)
  extensionList.value = data.rows
  getDataOfgCateGoryGroup()
  return data.rows
}

/**
 * 请求插件目录
 */
async function getExtensionHubCategory() {
  const { data } = await API.plugins.userGetPluginCategoryList()
  categoryList.value = data.rows
  getExtensionList({})
  return data.rows
}

/**
 * 根据分类组合数据
 */
function getDataOfgCateGoryGroup() {
  for (let i = 0; i < categoryList.value.length; i++) {
    categoryList.value[i].arr = []
    for (let j = 0; j < extensionList.value.length; j++) {
      if (categoryList.value[i].id === extensionList.value[j].category) {
        categoryList.value[i].arr.push(extensionList.value[j])
      }
    }
  }
}

/**
 * 仓库触发搜索时间
 */
function searchMethod(e: any) {
  const params = {
    pluginName: e.value,
  }
  getExtensionList(params)
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="extensions-header">
      Extensions
    </div>
    <Tabs class="flex-1" :value="tabsValue">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
      <TabPanels class="flex flex-1 !pa-0">
        <TabPanel class="flex-1" value="intalled">
          <list :data-list="userExtensionList" />
        </TabPanel>
        <TabPanel value="hub">
          <hub :data-list="categoryList" @search-method="searchMethod" />
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
