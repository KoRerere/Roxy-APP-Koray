<script lang="ts" setup>
import accordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { getFormDataByList } from '/@/utils'
import { getAccordions, getDefaultValue } from './form-inputs'
import { API } from '/@/api'

const router = useRouter()

const tabs = ref([
  { title: '单个创建', content: 'Tab 1 Content', value: '0' },
  { title: '批量创建', content: 'Tab 2 Content', value: '1' },
  { title: '批量导入', content: 'Tab 3 Content', value: '2' },
])
const tabsValue = ref('0')

const windowName = ref('Untitled profile')
const accordions = ref()
const original = ref()
const previewData = computed(() => getFormDataByList(accordions.value?.inputsGroup, {}, { keyName: 'label', valueName: 'value' }))

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

onMounted(() => {
  accordions.value = getAccordions()
  original.value = getDefaultValue()
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
      <div class="flex-1 overflow-hidden">
        <accordionInputs v-model:windowName="windowName" :accordions="accordions" @cancel="() => { }"
          @create-open="(formData: any) => createProfile(formData, true)"
          @create="(formData: any) => createProfile(formData, false)" />
      </div>
    </div>
    <previewCard :data="previewData" />
  </div>
</template>

<style lang="scss" scoped></style>
