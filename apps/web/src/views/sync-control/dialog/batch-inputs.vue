<script setup lang="ts">
import BaseDialog from './base-dialog.vue'
import SameText from './batch-inputs-components/same-text.vue'
import DiffText from './batch-inputs-components/diff-text.vue'
import RandomText from './batch-inputs-components/random-text.vue'

import { useToast } from 'primevue/usetoast'

const toast = useToast()
const route = useRoute()

let syncWindowCount = 0
const tabRefMap = ref<Recordable>({})
const syncWindows = ref([])
// append：false表示清空
const append = ref(true)
const tabs = ref([
  { id: 'same', label: $t('相同文本'), component: markRaw(SameText) },
  { id: 'diff', label: $t('差异文本'), component: markRaw(DiffText) },
  { id: 'random', label: $t('随机数字'), component: markRaw(RandomText) },
])
const defaultActiveTabId = tabs.value.find(tab => tab.id === route.query.tab)?.id || tabs.value[0].id
const activeTab = ref(defaultActiveTabId)

watch(activeTab, (val) => {
  if (val === 'diff') {
    electronAPI.send('syncControl:resizeBatchInputsDialog', { width: 480, height: Math.min(60 * syncWindowCount + 220, 660) })
  }
  else if (val === 'random') {
    electronAPI.send('syncControl:resizeBatchInputsDialog', { width: 480, height: 340 })
  }
  else {
    electronAPI.send('syncControl:resizeBatchInputsDialog', { width: 480, height: 366 })
  }
}, { immediate: true })

function handleHide() {
  electronAPI.send('syncControl:closeBatchInputsDialog')
}

async function startBatchInputs(tab) {
  console.log('startBatchInputs', tab, tabRefMap.value[tab.id])
  const params = {
    mode: tab.id,
    data: tabRefMap.value[tab.id].formData,
    append: append.value,
  }

  if (params.mode === 'same') {
    if (params.data?.trim() === '') {
      toast.add({ severity: 'warn', summary: $t('操作失败'), detail: $t('请输入文本'), life: 1500 })
      return
    }
  }

  console.log('startBatchInputs params', params)
  const result = await electronAPI.send('syncControl:batchInputText', params)
  console.log('startBatchInputs result', result)
}

async function getOpenedBrowser() {
  syncWindows.value = await window.electronAPI.send('syncControl:getAllSyncingWindows')
  syncWindowCount = syncWindows.value.length
  console.log('syncWindows.value', syncWindows.value)
}

window.electronAPI.on('browser:on-close', (dirId) => {
  getOpenedBrowser()
})

onMounted(() => {
  getOpenedBrowser()
})
</script>

<template>
  <BaseDialog :header="$t('批量输入')" @hide="handleHide">
    <Tabs v-model:value="activeTab">
      <TabList :pt="{ root: 'overflow-visible!' }">
        <template v-for="(tab) in tabs" :key="tab.id">
          <Tab :value="tab.id">
            {{ tab.label }}
          </Tab>
        </template>
      </TabList>
      <TabPanels>
        <template v-for="(tab) in tabs" :key="tab.id">
          <TabPanel :value="tab.id">
            <component :is="tab.component" :ref="(ins) => tabRefMap[tab.id] = ins" :sync-windows="syncWindows" />
            <div class="footer">
              <div class="flex items-center gap-2">
                <RxCheckbox v-model="append" input-id="append" binary size="small" :true-value="false" :false-value="true" />
                <label for="append"> {{ $t('输入前清空内容') }} </label>
              </div>
              <RxButton class="save-button" @click="startBatchInputs(tab)">
                {{ $t('输入') }}
              </RxButton>
            </div>
          </TabPanel>
        </template>
      </TabPanels>
    </Tabs>
  </BaseDialog>
</template>

<style lang="scss">
.p-dialog-content {
  height: 100%;
}
</style>

<style lang="scss" scoped>
:deep(.p-tabpanels) {
  height: 100%;

  .p-tabpanel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
}

.footer {
  margin-top: 24px;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}
</style>
