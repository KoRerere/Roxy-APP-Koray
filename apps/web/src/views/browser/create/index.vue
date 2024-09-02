<script lang="ts" setup>
import accordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { getFormDataByList, setInputVisible } from '/@/utils'
import { getAccordions, getDefaultValue, getInputsGroup } from './form-inputs'
import { API } from '/@/api'

const router = useRouter()

const tabs = ref([
  { title: '单个创建', value: 'single' },
  { title: '批量创建', value: 'batch' },
  { title: '批量导入', value: 'import' },
])
const tabsValue = ref('single')

const windowName = ref('Untitled profile')

const accordions = ref(getAccordions())
const inputsGroup = ref(getInputsGroup())
const original = ref(getDefaultValue())
const previewData = computed(() => getFormDataByList(inputsGroup.value, {}, { keyName: 'label', valueName: 'value' }))

// watch(() => tabsValue.value, (value) => {
//   setInputVisible(inputsGroup.value, 'windowPlatformList', value === 'single')
// })

async function createProfile(formData: any, openBrowser: boolean) {
  const params = {
    windowName: windowName.value,
    ...original.value,
    ...formData,
  }
  const { data } = await API.window.userAddWindowInfoCreate(params)
  router.replace({
    name: 'browser-list',
    query: {
      browser: JSON.stringify({ windowId: data.windowId, openBrowser }),
    },
  })
}

function cancel() {
  router.back()
}
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
      <div class="flex-1 overflow-hidden">
        <accordionInputs v-model:windowName="windowName" :accordions="accordions" :inputs-group="inputsGroup"
          @cancel="cancel" @create-open="(formData: any) => createProfile(formData, true)"
          @create="(formData: any) => createProfile(formData, false)" />
      </div>
    </div>
    <previewCard :data="previewData" />
  </div>
</template>

<style lang="scss" scoped></style>
