<script lang="ts" setup>
import rxEditDiv from '/@/components/rx-edit-div'
import accordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { getFormDataByList, setInputValueByInputKey, setInputVisible } from '/@/utils'
import { getAccordions, getDefaultValue, getInputsGroup } from './form-inputs'
import { API } from '/@/api'

const router = useRouter()

const tabs = ref([
  { title: '单个创建', value: 'single' },
  { title: '批量创建', value: 'batch' },
  { title: '批量导入', value: 'import' },
])
const tabsValue = ref('single')
const isBatch = ref(false)

const windowName = ref('Untitled profile')
const createCount = ref(1)
const maxWindowCount = ref()

provide('isBatch', isBatch)
provide('createCount', createCount)

// [{
//   id:0
//   proxyCategory: 'noproxy',
// }]

const accordions = ref(getAccordions())
const inputsGroup = ref(getInputsGroup())
const original = ref(getDefaultValue())
const previewData = computed(() => getFormDataByList(inputsGroup.value, {}, { keyName: 'label', valueName: 'value' }))

watch(() => tabsValue.value, (value) => {
  setInputVisible(inputsGroup.value[0], 'windowPlatformList', value === 'single')
  setInputValueByInputKey(inputsGroup.value[0], 'proxyInfoList', 'value', [])
  isBatch.value = tabsValue.value === 'batch'
  if (isBatch.value) {
    getUserInfo()
  }
})

async function getUserInfo() {
  try {
    const { data } = await API.base.userGetUserInfoList()
    maxWindowCount.value = Math.min(data.maxWindowCount, 100)
  }
  catch (error) {
    console.log('🚀 ~ getUserInfo ~ error:', error)
  }
}

async function createProfile(formData: any, openBrowser: boolean) {
  const params = {
    windowName: windowName.value,
    ...original.value,
    ...formData,
  }

  if (isBatch.value) {
    return batchCreateProfile(params)
  }

  const { data } = await API.window.userAddWindowInfoCreate(params)
  toBrowserList({ browser: JSON.stringify({ windowId: data.windowId, openBrowser }) })
}

async function batchCreateProfile(params: any) {
  const diffCount = createCount.value - params.proxyInfoList.length
  params.proxyInfoList = params.proxyInfoList.concat(Array.from({ length: diffCount }, () => ({ id: 0, proxyCategory: 'noproxy' })))
  params.createCount = createCount.value

  const { data } = await API.window.userBatchWindowInfoCreate(params)
  console.log('🚀 ~ batchCreateProfile ~ data:', data)
  // toBrowserList()
}

function toBrowserList(query?: any) {
  router.replace({
    name: 'browser-list',
    query,
  })
}

function cancel() {
  router.back()
}

onUnmounted(() => {

})
</script>

<template>
  <div class="flex justify-between h-full">
    <div class="flex flex-col flex-1 h-full">
      <Tabs v-model:value="tabsValue">
        <TabList>
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
      </Tabs>
      <div v-if="isBatch" class="flex items-center justify-between batch">
        <div>Profiles amount</div>
        <div class="flex flex-col items-end">
          <InputNumber v-model="createCount" :max="maxWindowCount" class="batch-input" show-buttons
            button-layout="horizontal" :step="1" fluid>
            <template #incrementicon>
              <span class="mdi mdi-plus" />
            </template>
            <template #decrementicon>
              <span class="mdi mdi-minus" />
            </template>
          </InputNumber>
          <div>Max profiles: {{ maxWindowCount }}. For more profiles please import profiles.</div>
        </div>
      </div>
      <rxEditDiv v-else v-model="windowName" class="window-name" />
      <div class="flex-1 overflow-hidden">
        <accordionInputs :accordions="accordions" :inputs-group="inputsGroup" :open-browser="!isBatch" @cancel="cancel"
          @create-open="(formData: any) => createProfile(formData, true)"
          @create="(formData: any) => createProfile(formData, false)" />
      </div>
    </div>
    <previewCard :data="previewData" />
  </div>
</template>

<style lang="scss" scoped>
.batch {
  padding: var(--spacing-none, 0px) 8px;

  &-input {
    margin-bottom: var(--spacing-xs, 4px);
    width: 150px;

    :deep(.p-inputnumber-input) {
      text-align: center;
    }
  }
}
</style>
