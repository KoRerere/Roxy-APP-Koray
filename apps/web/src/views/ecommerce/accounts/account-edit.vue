<script lang="ts" setup>
import AccordionInputs from '/@/views/browser/create/components/accordion-inputs.vue'
import MateGroup from '/@/views/browser/create/components/mate-group.vue'
import type { WindowMetaData } from '/@/views/browser/create/components/type'
import { toLabelId } from '/@/views/browser/create/hooks/useMate'
import { getInputsGroup } from '/@/views/browser/create/form-inputs'
import { createFormAsyncGate } from '/@/views/browser/create/hooks/useAsyncGate'
import { createTableContext } from '/@/views/browser/create/hooks/useContext'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { getFormDataByList } from '/@/utils'
import EcommerceBasicInfoForm from './components/basic-info.vue'
import { buildBindRiskOriginalContext, createEcommerceBasicInfo, createEcommerceWindowAccordions, stripEcommerceLegacyTopLevelFields } from './ecommerce-window-mode'
import type { BindRiskOriginalContext } from './ecommerce-window-mode'
import { useEcommerceAccountNavigation } from './hooks/useEcommerceAccountNavigation'
import type { EcommerceBasicInfoFormExpose } from './hooks/useEcommerceBasicInfoForm'

const route = useRoute()
const { mixpanelTrack } = useUserStore()
const [showToast, onlyErrorToast] = useResponseToast()
const { invalidateEcommerceAccountListCache, navigateBackAfterSave } = useEcommerceAccountNavigation()

createTableContext({ isBatch: ref(false), createCount: ref(0) })

const accordions = createEcommerceWindowAccordions()
const inputsGroup = ref<any[][]>([])
const original = ref<Record<string, any>>({})
const metaData = ref<WindowMetaData>()
const basicInfo = ref(createEcommerceBasicInfo())
/** 加载时的绑定上下文，供提交前对比是否变更设备/平台 */
const bindRiskOriginalContext = ref<BindRiskOriginalContext>()
const basicInfoFormRef = ref<EcommerceBasicInfoFormExpose>()
const loading = ref(false)
const formGate = createFormAsyncGate()
const formInitialized = ref(false)

const canSave = computed(() => formInitialized.value && formGate.isReady.value && !loading.value)

onBeforeMount(async () => {
  formInitialized.value = false
  const { code, data: { rows: [data] }, msg } = await API.window.userGetWindowInfoV2List({
    windowIds: route.query.id as string,
    isDelete: 0,
    page_index: 1,
    page_size: 1,
  })

  if (code !== 0) {
    onlyErrorToast(code, msg)
    return
  }

  const [_inputsGroup, _original] = await getInputsGroup(data, showToast, formGate)
  inputsGroup.value = _inputsGroup
  original.value = _original
  basicInfo.value = createEcommerceBasicInfo(data as unknown as Record<string, unknown>)
  bindRiskOriginalContext.value = buildBindRiskOriginalContext(basicInfo.value)
  oldFieldsFormat()
  metaData.value = {
    projectName: data!.projectName,
    projectId: data!.projectId == null || data!.projectId === '' ? undefined : String(data!.projectId),
    labelIds: (data!.labelIds || []).map(id => toLabelId(id)),
    windowRemark: data!.windowRemark,
  }
  formInitialized.value = true
})

async function saveAccount() {
  if (!formInitialized.value || !inputsGroup.value || !metaData.value) {
    return
  }

  const form = basicInfoFormRef.value
  if (!form) {
    return
  }

  const queryWindowId = Array.isArray(route.query.id) ? route.query.id[0] : route.query.id
  const windowId = queryWindowId ? queryWindowId : undefined
  if (!await form.confirmBindRiskBeforeSubmit({
    original: bindRiskOriginalContext.value,
    windowId,
  })) {
    return
  }

  const requestFields = form.getRequestFields()

  await formGate.waitUntilReady()
  const formData = getFormDataByList(inputsGroup.value, toRaw(metaData.value))
  const params = {
    ...original.value,
    ...formData,
    ...requestFields,
  }
  stripEcommerceLegacyTopLevelFields(params)

  loading.value = true
  try {
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params as any)
    onlyErrorToast(code, msg)

    if (code === 0) {
      mixpanelTrack('profile_edit')
      invalidateEcommerceAccountListCache(metaData.value.projectId)
      navigateBackAfterSave({
        projectId: metaData.value.projectId,
        projectName: metaData.value.projectName,
      })
    }
  }
  finally {
    loading.value = false
  }
}

function oldFieldsFormat() {
  stripEcommerceLegacyTopLevelFields(original.value)
  Reflect.deleteProperty(original.value, 'windowPlatformList')
}
</script>

<template>
  <div class="relative flex min-h-0 flex-col h-full">
    <ViewsHeader show-back :title="$t('编辑账号')" />
    <div class="px-32 flex flex-1 min-h-0 overflow-hidden overflow-x-auto">
      <div class="w-full h-full mx-auto min-w-192 max-w-240 flex min-h-0 min-w-0 flex-col">
        <AccordionInputs class="min-h-0 min-w-0 flex-1" :accordions="accordions" :inputs-group="inputsGroup">
          <template #before>
            <EcommerceBasicInfoForm v-if="formInitialized" ref="basicInfoFormRef" v-model="basicInfo" />
          </template>
        </AccordionInputs>
      </div>
    </div>
    <div class="px-32">
      <div class="mx-auto relative flex items-center justify-end gap-2 py-4 min-h-16 max-w-240 w-full footer">
        <MateGroup v-model="metaData" class="flex-1" is-edit />
        <RxButton v-tooltip.top="canSave ? '' : $t('正在同步指纹，请稍后')" severity="primary" :label="$t('保存')" :disabled="!canSave" :loading="loading" @click="saveAccount" />
      </div>
    </div>
    <div class="foot-separator" />
  </div>
</template>

<style lang="scss" scoped>
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
