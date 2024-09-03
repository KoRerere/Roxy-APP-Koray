<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import ryPopover from '/@/components/ry-popover'
import { API } from '/@/api'

const tabs = ref([
  { label: '所有窗口', icon: 'mdi mdi-google-downasaur', id: '1000', routeName: 'browser-list' },
  { label: '回收站', icon: 'mdi mdi-delete-empty-outline', id: '1001', routeName: 'browser-recycle' },
])

window.electronAPI.on('browser:on-close', (dirId) => {
  console.log('browser:on-close', dirId)
})
const activeTab = ref()

provide('activeTab', activeTab)

async function getFilterList() {
  const { data } = await API.window.userGetWindowFilterNameListList()
  const list = data.map((item, index) => ({ ...item, label: item.filter_name, icon: '', id: `${index}`, routeName: 'browser-list' }))

  if (tabs.value.length > 2) {
    tabs.value = tabs.value.filter(tab => ['1000', '1001'].includes(tab.id))
  }
  tabs.value.splice(1, 0, ...list)
}

function handleTabChange(id: string | number) {
  activeTab.value = tabs.value.find(item => item.id === id)
}

onMounted(() => {
  getFilterList()
  activeTab.value = tabs.value[0]
})

const popRef = ref()
function showPopover(event: Event) {
  popRef.value.getRef().show(event)
}
</script>

<template>
  <div class="h-full">
    <div class="position-relative w-full overflow-hidden">
      <span class="position-absolute top-3 right-4 z-1 cursor-pointer mdi mdi-cog" @click="showPopover" />
      <Tabs :value="tabs[0].id" scrollable @update:value="handleTabChange">
        <TabList>
          <Tab v-for="item in tabs" :key="item.label" :value="item.id">
            <router-link v-if="item.routeName" v-slot="{ href, navigate }" :to="{ name: item.routeName }" custom>
              <a :href="href" class="flex items-center text-inherit decoration-none" @click="navigate">
                <span :class="item.icon" />
                <span>{{ item.label }}</span>
              </a>
            </router-link>
          </Tab>
        </TabList>
      </Tabs>
    </div>
    <div class="browser-content">
      <router-view @update-filter-tabs="getFilterList" />
    </div>
  </div>

  <ry-popover ref="popRef" class="table-popover">
    <VueDraggable v-model="tabs" :animation="150" handle=".handle">
      <div v-for="item in tabs" :key="item.id" class="flex items-center table-popover-column">
        <span class="cursor-grab mdi mdi-drag handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <span class="cursor-pointer mdi mdi-pencil-outline" />
        <span class="cursor-pointer mdi mdi-delete-empty-outline" />
      </div>
    </VueDraggable>
  </ry-popover>
</template>

<style scoped lang="scss">
.browser {
  &-content {
    height: calc(100% - 48px);
  }
}
</style>
