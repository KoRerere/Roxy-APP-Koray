<script lang="ts" setup>
import inputLabel from '/@/components/ry-form/input-label.vue'
import inputSelect from '/@/components/ry-form/input-select.vue'
import { filterFieldByValue, getFormDataByList, isEmptyValue, isFunction } from '/@/utils'
import type { Accordions, MetaData } from './type.ts'
import accountItem from './account.vue'
import mateGroup from './mate-group.vue'
import proxyItem from './proxy.vue'
import urlsItem from './urls.vue'

const props = defineProps({
  openBrowser: {
    type: Boolean,
    default: true,
  },
  isEdit: {
    type: Boolean,
    default: false,
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

const emits = defineEmits(['createOpen', 'create'])

const { metadata: outerMetadata, 'onUpdate:metadata': onUpdateMetadata } = toRefs(reactive(useAttrs()))

const hasOuterMetadata = isFunction(onUpdateMetadata?.value)

const innerMetaData = ref<MetaData>({
  projectName: 'No project',
  projectId: undefined,
  labelIds: [],
  windowRemark: '',
})

const metaData = computed({
  get() {
    return (hasOuterMetadata ? outerMetadata.value : innerMetaData.value) as MetaData
  },
  set(value: MetaData) {
    if (hasOuterMetadata) {
      (onUpdateMetadata?.value as any)(value)
    }
    else {
      innerMetaData.value = value
    }
  },
})

function getFormData(isOpen: boolean) {
  const _metaData = filterFieldByValue(toRaw(metaData.value) as object, v => !isEmptyValue(v))
  const formData = getFormDataByList(props!.inputsGroup, _metaData)
  emits(isOpen ? 'createOpen' : 'create', formData)
}
</script>

<template>
  <div class="flex-ovh-1 flex-col">
    <div v-if="accordions" class="flex-1 overflow-auto content">
      <Accordion :value="accordions.value" multiple :pt="{ root: 'flex flex-col gap-4' }">
        <AccordionPanel v-for="(panels, index) in accordions.panels" :key="panels.title" :value="panels.value"
                        :pt="{ root: '!border-none' }"
        >
          <AccordionHeader as="div" class="accordion-header">
            {{ panels.title }}
          </AccordionHeader>
          <AccordionContent :pt="{ content: '!py-4 !px-2' }">
            <ryForm :inputs="inputsGroup[index]" label-position="left">
              <template #System="{ input }">
                <div class="flex flex-row">
                  <inputLabel v-bind="input" />
                  <InputGroup>
                    <template v-for="item in input.items" :key="item.name">
                      <inputSelect v-bind="item" v-model="item.value" :filter="false"
                                   @change="item.change?.(item, input.items)"
                      />
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
      <mateGroup v-model="metaData" class="flex-1" />
      <ryButton v-if="openBrowser" size="small" severity="secondary" outlined label="Carete & Open"
                @click.stop="getFormData(true)"
      />
      <ryButton size="small" severity="primary" :label="`${isEdit ? 'Save' : 'Create'} profile`"
                @click.stop="getFormData(false)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  padding: 0 var(--spacing-md, 12px) 40px;
}

.accordion-header {
  padding: var(--spacing-md, 6px) 8px;
  background: var(--Color-neutrals-100, #f0f3f5) !important;
  border-radius: 4px;
}

.footer {
  display: flex;
  align-items: center;
  padding: var(--spacing-2xl, 16px) 66px;
  gap: var(--spacing-lg, 8px);
  border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
}
</style>
