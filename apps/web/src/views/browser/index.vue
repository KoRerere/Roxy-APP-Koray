<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import ryPopover from '/@/components/ry-popover'
import { API } from '/@/api'

import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

const confirm = useConfirm()
const toast = useToast()

const tabs = ref([
  { label: '所有窗口', icon: 'mdi mdi-google-downasaur', id: '1000', routeName: 'browser-list' },
  { label: '回收站', icon: 'mdi mdi-delete-empty-outline', id: '1001', routeName: 'browser-recycle' },
])

const sortTabs = computed({
  get() {
    return tabs.value.length > 2 ? tabs.value.slice(1, -1) : []
  },
  set(value) {
    tabs.value.splice(1, tabs.value.length - 2, ...value)
  },
})

window.electronAPI.on('browser:on-close', (dirId) => {
  console.log('browser:on-close', dirId)
})
const activeTab = ref()

provide('activeTab', activeTab)

async function getFilterList() {
  const { data } = await API.window.userGetWindowFilterNameListList()
  const list = data.map((item, index: number) => ({ ...item, label: item.filter_name, icon: '', id: `${index}`, routeName: 'browser-list' }))

  if (tabs.value.length > 2) {
    tabs.value = tabs.value.filter(tab => ['1000', '1001'].includes(tab.id))
  }
  tabs.value.splice(1, 0, ...list)
}

async function deleteFilterItem(filter_name: string) {
  confirm.require({
    header: '警告',
    message: '确认删除此筛选组？',
    rejectProps: {
      label: '取消',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '确定',
      severity: 'danger',
    },
    accept: async () => {
      try {
        const { msg } = await API.window.userDeleteWindowFilterNameCreate({ filter_name })
        toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
        getFilterList()
      }
      catch (error) {
        console.log('🚀 ~ accept: ~ error:', error)
      }
    },
  })
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

function hidePopover() {
  console.log('🚀 ~ hidePopover ~ hidePopover:')
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between">
      <Tabs class="flex-1 overflow-hidden" :value="tabs[0].id" scrollable @update:value="handleTabChange">
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
      <ryTag class="mdi mdi-cog" @click="showPopover" />
    </div>
    <div class="flex-1 overflow-hidden">
      <router-view @update-filter-tabs="getFilterList" />
    </div>
  </div>

  <ry-popover ref="popRef" class="table-popover" @hide="hidePopover">
    <div class="table-popover-column">
      所有窗口
    </div>
    <!-- handle=".handle" -->
    <VueDraggable v-model="sortTabs" :animation="150">
      <div v-for="item in sortTabs" :key="item.id" class="flex items-center table-popover-column">
        <span class="cursor-grab mdi mdi-drag handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <span class="cursor-pointer mdi mdi-pencil-outline" />
        <span class="cursor-pointer mdi mdi-delete-empty-outline" @click="deleteFilterItem(item.label)" />
      </div>
    </VueDraggable>
    <div class="table-popover-column">
      回收站
    </div>
  </ry-popover>
</template>

<style scoped lang="scss"></style>
