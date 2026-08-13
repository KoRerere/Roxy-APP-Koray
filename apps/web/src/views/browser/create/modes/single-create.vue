<script lang="ts" setup>
import type { CreatePageShared } from './useCreatePageShared'
import MateGroup from '../components/mate-group.vue'
import AccordionInputs from '../components/accordion-inputs.vue'
import BasicInfo from '../components/basic-info.vue'
import PreviewCard from '../components/preview-card.vue'
import RxButton from '/@/components/rx-button'
import LastPayModal from '../components/last-pay-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { createSingleWindowAccordions } from './createDefaultAccordions'
import { h } from 'vue'

const props = defineProps<{
  shared: CreatePageShared
}>()

const [showModal] = useDialog()

const accordions = ref(createSingleWindowAccordions())

const {
  collapsed,
  inputsGroup,
  previewInputs,
  isBatch,
  createCount,
  shuffleFingerprint,
  choosePreset,
  profileTemplate,
  showTemplates,
  metaData,
  items,
  saveTemplatePopup,
  canSubmit,
  loading,
  formGate,
  clearDriver,
  buildCreateParams,
  presetTemplate,
  executeSingleCreate,
  onBack,
  workspaceStore,
  userStore,
} = props.shared

const windowInputs = computed(() => inputsGroup.value?.[0] ?? [])

async function createProfile(openBrowser: boolean) {
  await formGate.waitUntilReady()
  clearDriver()
  const params = buildCreateParams({
    inputs: inputsGroup.value,
    metadata: metaData.value,
    createCount: createCount.value,
  })
  return checkPresetTemplate(params, openBrowser)
}

function checkPresetTemplate(params: any, openBrowser: boolean) {
  if (!presetTemplate.value) {
    return singleCreateProfile(params, openBrowser)
  }

  return showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(LastPayModal, {
        data: { ...toRaw(presetTemplate.value.proxyInfo), description: presetTemplate.value.description },
        isDirect: presetTemplate!.value.isDirect,
        onClose: hideModal,
        onSuccess: ({ id: moduleId, lastCity, lastCountry, lastIp }: any) => {
          singleCreateProfile({ ...params, moduleId, lastCity, lastCountry, lastIp, proxyMethod: 'choose' }, openBrowser)
        },
      }),
    },
  })
}

async function singleCreateProfile(params: any, openBrowser: boolean) {
  return executeSingleCreate({
    params,
    onSuccess: (data) => {
      onBack(data, openBrowser)
      workspaceStore.getWorkspaceList()
      userStore.fetchUserInfo()
    },
  })
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="px-16 flex flex-1 min-h-0 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex min-h-0 gap-8 ma-auto" :class="[collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285']">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <AccordionInputs class="flex-1 min-h-0" :accordions="accordions" :inputs-group="inputsGroup">
            <template #before>
              <BasicInfo :window-inputs="windowInputs" show-template :template-label="profileTemplate.label" @show-templates="showTemplates" />
            </template>
          </AccordionInputs>
        </div>
        <PreviewCard v-model:collapsed="collapsed" :inputs-group="previewInputs" :is-batch="isBatch" :create-count="createCount" :is-import="false" :on-shuffle="shuffleFingerprint"
                     :choose-preset="choosePreset"
        />
      </div>
    </div>
    <div class="px-16">
      <div class="mx-auto relative flex items-center justify-end gap-2 py-4 min-h-16 footer" :class="[collapsed ? 'max-w-192' : 'max-w-285']">
        <MateGroup v-model="metaData" class="flex-1" />
        <SplitButton severity="secondary" :label="$t('存为新模板')" :model="items" @click.stop="saveTemplatePopup($event)" />
        <RxButton v-tooltip.top="canSubmit ? '' : $t('正在生成新指纹，请稍后')" class="guide2" :label="$t('创建窗口')" :disabled="!canSubmit" :loading="loading" @click.stop="createProfile(false)" />
      </div>
    </div>
    <div class="foot-separator" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-splitbutton) {
  .p-button {
    padding: var(--spacing-md, 6px) 10px;
    font-size: var(--Font-Size-text-sm, 12px);
    line-height: var(--Line-Height-text-lg, 20px);
    border-width: 1px;

    &:not(:disabled):hover {
      border-width: 1px;
    }
  }

  .p-splitbutton-button {
    border-top-left-radius: var(--radius-md, 6px);
    border-bottom-left-radius: var(--radius-md, 6px);
    border-right-width: 0;
  }

  .p-splitbutton-dropdown {
    border-top-right-radius: var(--radius-md, 6px);
    border-bottom-right-radius: var(--radius-md, 6px);
    border-left-width: 0;
  }
}

.footer {
  :deep(.p-button) {
    max-width: 150px;
  }

  :deep(.p-button-label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.foot-separator {
  position: absolute;
  bottom: 65.6px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 1px;
  background-color: var(--colors-border-divider);
}
</style>
