<script lang="ts" setup>
import ryForm from '/@/components/ry-form'
import ryButton from '/@/components/ry-button'
import inputLabel from '/@/components/ry-form/input-label.vue'
import rxEditDiv from '/@/components/rx-edit-div'
import proxyItem from './proxy.vue'
import accountItem from './account.vue'
import urlsItem from './urls.vue'

import { useVModels } from '@vueuse/core'
import { getFormDataByList } from '/@/utils'

interface Accordions {
  value: string[]
  panels: {
    title: string
    value: string
  }[]
}

const props = defineProps({
  openBrowser: {
    type: Boolean,
    default: true,
  },
  windowName: {
    tyep: String,
    default: '',
  },
  accordions: {
    type: Object as PropType<Accordions>,
    default: undefined,
  },
  inputsGroup: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})
const emits = defineEmits(['update:windowName', 'cancel', 'createOpen', 'create'])

const { windowName } = useVModels(props, emits)

function getFormData(isOpen: boolean) {
  const formData = getFormDataByList(props!.inputsGroup)
  emits(isOpen ? 'createOpen' : 'create', formData)
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div v-if="accordions" class="flex-1 overflow-auto">
      <rxEditDiv v-model="windowName" class="window-name" />
      <Accordion :value="accordions.value" multiple>
        <AccordionPanel v-for="(panels, index) in accordions.panels" :key="index" :value="panels.value">
          <AccordionHeader as="div" class="accordion-header">
            {{ panels.title }}
          </AccordionHeader>
          <AccordionContent>
            <ryForm :inputs="inputsGroup[index]" label-position="left">
              <template #System="{ input }">
                <div class="flex flex-row">
                  <inputLabel v-bind="input" />
                  <InputGroup>
                    <template v-for="item in input.items" :key="item.name">
                      <Select v-bind="item" v-model="item.value" option-label="label" option-value="value" show-clear
                        @change="() => item.change?.(item, input.items)" />
                    </template>
                  </InputGroup>
                </div>
              </template>
              <template #proxy="{ input }">
                <div class="flex flex-row">
                  <inputLabel v-bind="input" />
                  <proxyItem v-model="input.value" class="flex-1" />
                </div>
              </template>
              <template #accounts="{ input }">
                <div class="flex flex-row">
                  <inputLabel v-bind="input" />
                  <accountItem v-model="input.value" class="flex-1" />
                </div>
              </template>
              <template #urls="{ input }">
                <urlsItem v-model="input.value" v-bind="input" />
              </template>
              <template #windowSize="{ input }">
                <div class="flex flex-row">
                  <inputLabel v-bind="input" />
                  <InputGroup>
                    <template v-for="(item, idx) in input.items" :key="idx">
                      <InputText v-bind="item" v-model="item.value" type="text" />
                    </template>
                  </InputGroup>
                </div>
              </template>
            </ryForm>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
    <div class="footer">
      <ryButton class="ma-auto ml-0" size="small" severity="secondary" label="Cancel" text
        @click.stop="$emit('cancel')" />
      <ryButton v-if="openBrowser" size="small" severity="secondary" outlined label="Carete & Open"
        @click.stop="getFormData(true)" />
      <ryButton size="small" severity="primary" label="Create profile" @click.stop="getFormData(false)" />
    </div>
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
