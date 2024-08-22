<script lang="ts" setup>
import ryForm from '/@/components/ry-form'
import inputLabel from '/@/components/ry-form/input-label.vue'
import proxyItem from './components/proxy.vue'

const tabs = ref([
  { title: '单个创建', content: 'Tab 1 Content', value: '0' },
  { title: '批量创建', content: 'Tab 2 Content', value: '1' },
  { title: '批量导入', content: 'Tab 3 Content', value: '2' },
])

const formInputs = ref([
  {
    label: 'System',
    value: null,
    items: [
      {
        type: 'select',
        name: 'type1',
        placeholder: 'select type1',
        options: [
          { label: 'aaa', value: 'A' },
          { label: 'bbb', value: 'B' },
        ],
      },
      {
        type: 'select',
        name: 'type2',
        placeholder: 'select type2',
        options: [
          { label: 'ccc', value: 'C' },
          { label: 'ddd', value: 'D' },
        ],
      },
    ],
    slot: 'System',
  },
  {
    type: 'select',
    label: 'Kernel',
    name: 'kernel',
    value: null,
    placeholder: 'Username for your server',
    options: [
      { icon: 'mdi mdi-currency-eur', label: 'Australia', value: 'AU' },
      { icon: 'mdi mdi-currency-fra', label: 'Brazil', value: 'BR' },
      { icon: 'mdi mdi-currency-gbp', label: 'China', value: 'CN' },
      { icon: 'mdi mdi-currency-ils', label: 'Egypt', value: 'EG' },
      { icon: 'mdi mdi-currency-inr', label: 'France', value: 'FR' },
      { icon: 'mdi mdi-currency-jpy', label: 'Germany', value: 'DE' },
    ],
  },
  {
    type: 'textarea',
    label: 'User-Agent',
    name: 'UserAgent',
    value: null,
    placeholder: 'placeholder',
    icon: 'mdi mdi-refresh',
  },
  {
    separator: true,
  },
  {
    label: 'Proxy(Direct)',
    value: null,
    slot: 'Proxy',
  },
  {
    separator: true,
  },
  {
    label: 'URLs',
    value: null,
    slot: 'urls',
    tooltip: 'man!',
  },
  {
    label: 'Accounts',
    value: null,
    slot: 'accounts',
  },
  {
    type: 'textarea',
    label: 'Cookies',
    name: 'cookies',
    value: null,
    placeholder: 'Paste your cookies with JSON format',
    icon: 'mdi mdi-refresh',
  },
])

const accordions = reactive({
  value: ['1'],
  panels: [
    {
      title: 'Basic',
      value: '1',
      inputs: formInputs,
    },
    {
      title: 'Hardware',
      value: '2',
      inputs: [],
    },
  ],
})

const tabValue = ref('0')

function handleIconClick(input: any) {
  console.log('🚀 ~ handleIconClick ~ input:', toRaw(input))
}
</script>

<template>
  <div class="card">
    <Tabs v-model:value="tabValue">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
    </Tabs>
    <div>
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
                </div>
              </template>
              <template #accounts="{ input }">
                <div class="flex flex-row">
                  <input-label v-bind="input" />
                </div>
              </template>
            </ry-form>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.accordion-header {
  padding: var(--spacing-md, 6px) 8px;
  background: var(--Color-neutrals-100, #f0f3f5) !important;
  border-radius: 4px;
}

:deep(.p-accordioncontent-content) {
  padding: 16px 8px;
}
</style>
