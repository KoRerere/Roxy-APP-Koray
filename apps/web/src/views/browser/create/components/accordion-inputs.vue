<script lang="ts" setup>
import inputLabel from '/@/components/ry-form/input-label.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales/index.js'
import { filterFieldByValue, getFormDataByList, isEmptyValue, isFunction } from '/@/utils'
import { copyText } from '/@/utils/'
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
const loading = defineModel('loading', { type: Boolean, default: false })

const [showToast] = useResponseToast()

const { metadata: outerMetadata, 'onUpdate:metadata': onUpdateMetadata } = toRefs(reactive(useAttrs()))

const hasOuterMetadata = isFunction(onUpdateMetadata?.value)

const innerMetaData = ref<MetaData>({
  projectName: $t('未指定项目'),
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

function onCopy(dirId: string) {
  copyText(dirId)
  showToast(0, $t('Copy success'))
}
</script>

<template>
  <div class="flex-ovh-1 flex-col">
    <div v-if="accordions" class="flex-1 overflow-auto content">
      <Accordion :value="accordions.value" multiple :pt="{ root: 'flex flex-col gap-4' }">
        <AccordionPanel v-for="(panels, index) in accordions.panels" :key="panels.title" :value="panels.value" :pt="{ root: '!border-none' }">
          <AccordionHeader as="div" class="accordion-header">
            {{ panels.title }}
          </AccordionHeader>
          <AccordionContent :pt="{ content: '!py-4 !px-2' }">
            <RyForm :inputs="inputsGroup[index]" label-position="left">
              <template #profileId="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <span class="text-3">{{ input.value }}</span>
                  <span class="text-3 color-blue-500 ml-2 cursor-pointer" @click="onCopy(input.value)">Copy</span>
                </div>
              </template>
              <template #system="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <InputGroup>
                    <template v-for="item in input.items" :key="item.name">
                      <RxInputSelect v-bind="item" v-model="item.value" :filter="false" @change="item.change?.(item, input.items)" />
                    </template>
                  </InputGroup>
                </div>
              </template>
              <template #proxy="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <proxyItem v-model="input.value" class="flex-1" />
                </div>
              </template>
              <template #accounts="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <accountItem v-model="input.value" class="flex-1" />
                </div>
              </template>
              <template #urls="{ input }">
                <urlsItem v-model="input.value" v-bind="input" />
              </template>
              <template #windowSize="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <InputGroup>
                    <template v-for="item in input.items" :key="item.name">
                      <InputText v-bind="item" v-model="item.value" type="text" />
                    </template>
                  </InputGroup>
                </div>
              </template>
            </RyForm>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
    <div class="footer">
      <mateGroup v-model="metaData" class="flex-1" />
      <RxButton v-if="openBrowser" outlined severity="secondary" :label="$t('创建 & 打开')" :loading="loading" @click.stop="getFormData(true)" />
      <RxButton severity="primary" :label="`${isEdit ? $t('保存') : $t('创建窗口')}`" :loading="loading" @click.stop="getFormData(false)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
$spacing-x: 66px;

.content {
  padding: 0 $spacing-x 40px;

  &::-webkit-scrollbar {
    display: none;
  }
}

:deep(.p-accordionheader) {
  padding: var(--spacing-md, 6px) 8px;
  background: var(--Color-neutrals-100, #f0f3f5) !important;
  border-radius: 4px;
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}

.footer {
  display: flex;
  align-items: center;
  padding: var(--spacing-2xl, 16px) $spacing-x;
  gap: var(--spacing-lg, 8px);
  max-height: 64px;
  border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
}

:deep(.rx-label) {
  max-width: 120px;
}
</style>
