<script lang="ts" setup>
import ryForm from '/@/components/ry-form'
import ryButton from '/@/components/ry-button'
import inputLabel from '/@/components/ry-form/input-label.vue'
import rxEditDiv from '/@/components/rx-edit-div'
import proxyItem from './components/proxy.vue'
import accountItem from './components/account.vue'
import previewCard from './components/preview-card.vue'
import { formatInputsByList } from '/@/utils'
import { basicInputs, hardwareInputs, otherInputs, windowInputs } from './form-inputs'
import { API } from '/@/api'

const tabs = ref([
  { title: '单个创建', content: 'Tab 1 Content', value: '0' },
  { title: '批量创建', content: 'Tab 2 Content', value: '1' },
  { title: '批量导入', content: 'Tab 3 Content', value: '2' },
])

const windowName = ref('Untitled profile')

const accordions = reactive({
  value: ['1'],
  panels: [
    {
      title: 'window',
      value: '1',
      inputs: windowInputs,
    },
    {
      title: 'Basic',
      value: '2',
      inputs: basicInputs,
    },
    {
      title: 'highLevel',
      value: '3',
      inputs: hardwareInputs,
    },
    {
      title: 'other',
      value: '4',
      inputs: otherInputs,
    },
  ],
})

const tabValue = ref('0')

function handleIconClick(_input: any) {
  console.log('🚀 ~ handleIconClick ~ fromData:', formatInputsByList(accordions.panels.map(item => item.inputs)))
}
// ======================

async function xxxx() {
  const { data } = await API.base.userGetDictVersionList()
  const { os, language } = data
  const xxx = await API.base.userGetSystemDictV2List({ type: [os, language] })
  console.log('🚀 ~ xxxx ~ xxx:', xxx)
}

onMounted(() => {
  xxxx()
})
</script>

<template>
  <div class="flex justify-between h-full">
    <div class="flex flex-col flex-1 h-full">
      <Tabs v-model:value="tabValue">
        <TabList>
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
      </Tabs>
      <rxEditDiv v-model="windowName" class="window-name" />
      <div class="flex-1 overflow-auto">
        <Accordion :value="accordions.value" multiple>
          <AccordionPanel v-for="panels in accordions.panels" :key="panels.title" :value="panels.value">
            <AccordionHeader as="div" class="accordion-header">
              {{ panels.title }}
            </AccordionHeader>
            <AccordionContent>
              <ry-form :inputs="panels.inputs" label-position="left" @icon-click="handleIconClick">
                <template #System="{ input }">
                  <div class="flex flex-row">
                    <input-label v-bind="input" />
                    <InputGroup>
                      <template v-for="(item, index) in input.items" :key="index">
                        <Select v-if="item.type === 'select'" v-bind="item" v-model="item.value" option-label="label"
                          option-value="value" show-clear />
                        <InputText v-else v-bind="item" v-model="item.value" type="text" />
                      </template>
                    </InputGroup>
                  </div>
                </template>
                <template #Proxy="{ input }">
                  <div class="flex flex-row">
                    <input-label v-bind="input" />
                    <proxy-item class="flex-1" />
                  </div>
                </template>
                <template #urls="{ input }">
                  <div class="flex flex-row">
                    <input-label v-bind="input" />
                    <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add URLs" />
                  </div>
                </template>
                <template #accounts="{ input }">
                  <div class="flex flex-row">
                    <input-label v-bind="input" />
                    <account-item class="flex-1" />
                  </div>
                </template>
                <template #windowSize="{ input }">
                  <div class="flex flex-row">
                    <input-label v-bind="input" />
                    <InputGroup>
                      <template v-for="(item, idx) in input.items" :key="idx">
                        <InputText v-bind="item" v-model="item.value" type="text" />
                      </template>
                    </InputGroup>
                  </div>
                </template>
              </ry-form>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>
      <div class="footer">
        <ry-button class="ma-auto ml-0" size="small" severity="secondary" label="Cancel" text />
        <ry-button size="small" severity="secondary" outlined label="Carete & Open" />
        <ry-button size="small" severity="primary" label="Create profile" />
      </div>
    </div>
    <previewCard />
  </div>
</template>

<style lang="scss" scoped>
.window-name {
  padding: var(--spacing-md, 6px) 8px;
}

.accordion-header {
  padding: var(--spacing-md, 6px) 8px;
  background: var(--Color-neutrals-100, #f0f3f5) !important;
  border-radius: 4px;
}

:deep(.p-accordioncontent-content) {
  padding: 16px 8px;
}

.footer {
  display: flex;
  gap: var(--spacing-xl, 12px);
  padding: var(--spacing-md, 6px) 8px;
}
</style>
