<script lang="ts" setup>
import AccordionInputs from './components/accordion-inputs.vue'
import BasicInfo from './components/basic-info.vue'
import PreviewCard from './components/preview-card.vue'
import LastPayModal from './components/last-pay-modal.vue'
import RxButton from '/@/components/rx-button'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useThemeStore } from '/@/stores/theme'
import { createTableContext } from './hooks/useContext'
import { useWindowCreateCore } from './hooks/useWindowCreateCore'
import { createSingleWindowAccordions } from './modes/createDefaultAccordions'
import { h, toRaw } from 'vue'
import { getImage } from '/@/utils'

const props = defineProps<{
  /** 已存模板回填；无模板时传空对象 */
  template?: Record<string, any>
  onClose?: () => void
  onSaved?: (payload: { formData: Record<string, any>, createAndRun: boolean }) => void | Promise<void>
}>()

const { realTheme } = storeToRefs(useThemeStore())
const [, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()

const presetTemplate = ref()
const oneClickSettings = ref()
createTableContext({
  isBatch: ref(false),
  createCount: ref(1),
  presetTemplate,
  oneClickSettings,
})

const accordions = ref(createSingleWindowAccordions())
const collapsed = ref(true)
const formInitialized = ref(false)
const saving = ref(false)

const {
  inputsGroup,
  loading,
  formGate,
  canSubmit,
  initialize,
  shuffleFingerprint,
  buildCreateParams,
  prepareCreateParams,
} = useWindowCreateCore()

const windowInputs = computed(() => inputsGroup.value?.[0] ?? [])
const canSave = computed(() => formInitialized.value && canSubmit.value && !saving.value)

const bgSrc = computed(() => {
  return realTheme.value === 'light' ? `url('${getImage('browser/quick_create_bg_light.svg')}')` : `url('${getImage('browser/quick_create_bg_dark.svg')}')`
})

onBeforeMount(async () => {
  formInitialized.value = false
  const template = props.template ?? {}
  // 已有模板：保留 proxy / webGLManufacturer / webGLRender 等回填，不要刷指纹覆盖
  await initialize(template, {
    refreshFingerprint: Object.keys(template).length === 0,
  })
  formInitialized.value = true
})

async function saveTemplate(createAndRun: boolean) {
  if (!canSave.value) {
    return
  }

  await formGate.waitUntilReady()
  saving.value = true
  try {
    // 仅保存模板：不走 API 静默提取/测速，避免改写已有代理的 lastIp
    // 保存并运行：创建前才 ensure（prepareCreateParams 内仅 api 未测过时测速）
    const formData = createAndRun
      ? await prepareCreateParams()
      : buildCreateParams()
    await props.onSaved?.({
      formData,
      createAndRun,
    })
  }
  catch (error: any) {
    console.error('[QuickCreate] save template failed', error)
    onlyErrorToast(-1, error?.message || $t('保存配置'))
  }
  finally {
    saving.value = false
  }
}

async function onSaveAndRun() {
  if (!presetTemplate.value) {
    await saveTemplate(true)
    return
  }

  // 付费预设代理：先走支付确认再存模板并创建
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(LastPayModal, {
        data: { ...toRaw(presetTemplate.value.proxyInfo), description: presetTemplate.value.description },
        isDirect: presetTemplate.value.isDirect,
        onClose: hideModal,
        onSuccess: async ({ id: moduleId, lastCity, lastCountry, lastIp }: any) => {
          hideModal()
          await formGate.waitUntilReady()
          saving.value = true
          try {
            const formData = await prepareCreateParams({
              additionalParams: {
                moduleId,
                lastCity,
                lastCountry,
                lastIp,
                proxyMethod: 'choose',
              },
            })
            await props.onSaved?.({
              formData,
              createAndRun: true,
            })
          }
          catch (error: any) {
            console.error('[QuickCreate] save and run failed', error)
            onlyErrorToast(-1, error?.message || $t('保存并运行'))
          }
          finally {
            saving.value = false
          }
        },
      }),
    },
  })
}
</script>

<template>
  <div class="quick-create-editor flex flex-col overflow-hidden popup">
    <div class="flex shrink-0 items-start justify-between gap-4 px-6 pt-4 pb-2">
      <div class="tt-primary text-5 font-600 leading-normal">
        {{ $t('快速创建') }}
      </div>
      <SvgIcon class="mt-1 shrink-0 cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="props.onClose?.()" />
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden overflow-x-auto px-6">
      <div class="ma-auto flex h-full min-h-0 w-full gap-8" :class="[collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285']">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <AccordionInputs class="min-h-0 min-w-0 flex-1" :accordions="accordions" :inputs-group="inputsGroup">
            <template #before>
              <!-- 等 initialize 完成再挂载，避免 async onBeforeMount 竞态下 ProxyInfo 用空列表 hydrate -->
              <BasicInfo v-if="formInitialized" :window-inputs="windowInputs" :autofill-window-name="false" />
            </template>
          </AccordionInputs>
          <div class="footer flex shrink-0 items-center justify-end gap-2 px-4 py-4 min-h-16">
            <RxButton v-tooltip.top="canSave ? '' : $t('正在生成新指纹，请稍后')" severity="secondary" outlined :label="$t('保存并运行')" :disabled="!canSave" :loading="saving || loading" @click="onSaveAndRun" />
            <RxButton v-tooltip.top="canSave ? '' : $t('正在生成新指纹，请稍后')" :label="$t('保存配置')" :disabled="!canSave" :loading="saving || loading" @click="saveTemplate(false)" />
          </div>
        </div>
        <PreviewCard v-model:collapsed="collapsed" :inputs-group="inputsGroup" :is-batch="false" :create-count="1" :is-import="false" :on-shuffle="shuffleFingerprint" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  &::before {
    background-image: v-bind(bgSrc);
    background-size: 100% auto;
    background-repeat: no-repeat;
    background-position: 0 0;
    z-index: -1;
  }

  &::after {
    background-color: var(--colors-background-bg-page);
    z-index: -2;
  }
}

.quick-create-editor {
  width: min(1140px, 92vw);
  height: min(820px, 88vh);
  border-radius: var(--radius-2xl, 8px);
}

.footer {
  border-top: 1px solid var(--colors-border-divider);
}
</style>
