<script lang="ts" setup>
import AccordionInputs from '/@/views/browser/create/components/accordion-inputs.vue'
import MateGroup from '/@/views/browser/create/components/mate-group.vue'
import type { WindowMetaData } from '/@/views/browser/create/components/type'
import { useWindowCreateCore } from '/@/views/browser/create/hooks/useWindowCreateCore'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { createTableContext } from '/@/views/browser/create/hooks/useContext'
import EcommerceBasicInfoForm from './components/basic-info.vue'
import {
  createEcommerceWindowAccordions,
  createEmptyEcommerceBasicInfo,
  stripEcommerceLegacyTopLevelFields,
} from './ecommerce-window-mode'
import type { EcommerceBasicInfoFormExpose } from './hooks/useEcommerceBasicInfoForm'
import { useEcommerceAccountNavigation } from './hooks/useEcommerceAccountNavigation'
import { useEcommerceSkipCreateGuide } from './hooks/useEcommerceSkipCreateGuide'
import { useProjectEntityLabels } from '/@/composables/useProjectEntityLabels'

const workspaceStore = useWorkspaceStore()
const userStore = useUserStore()
const { invalidateEcommerceAccountListCache, navigateBackAfterSave } = useEcommerceAccountNavigation()
const { startBasicInfoGuide, markPostCreateGuide } = useEcommerceSkipCreateGuide()
const projectLabels = useProjectEntityLabels()

createTableContext({ isBatch: ref(false), createCount: ref(1) })

const accordions = createEcommerceWindowAccordions()
const basicInfo = ref(createEmptyEcommerceBasicInfo())
const basicInfoFormRef = ref<EcommerceBasicInfoFormExpose>()
const metaData = ref<WindowMetaData>({
  projectName: projectLabels.value.unspecified,
  projectId: undefined,
  labelIds: [],
  windowRemark: '',
})
const {
  inputsGroup,
  loading,
  canSubmit: canCreate,
  initialize,
  buildCreateParams,
  executeSingleCreate,
} = useWindowCreateCore()

onBeforeMount(() => {
  initialize()
})

onMounted(() => {
  void startBasicInfoGuide()
})

async function createAccount() {
  const form = basicInfoFormRef.value
  if (!form)
    return

  if (!await form.confirmBindRiskBeforeSubmit())
    return

  let boundDuringCreate = false

  await executeSingleCreate({
    buildParams: () => buildCreateParams({
      metadata: metaData.value,
      createCount: 1,
    }),
    collectAdditionalParams: (baseParams) => {
      stripEcommerceLegacyTopLevelFields(baseParams)
      const fields = form.getRequestFields()
      // 记录是否在创建表单内完成设备绑定，供返回列表后跳过绑定引导
      boundDuringCreate = fields.moduleId != null && fields.moduleId !== '' && fields.moduleId !== 0 && String(fields.moduleId) !== '0'
      return fields
    },
    onSuccess: () => {
      markPostCreateGuide(boundDuringCreate)
      invalidateEcommerceAccountListCache(metaData.value.projectId)
      navigateBackAfterSave({
        projectId: metaData.value.projectId,
        projectName: metaData.value.projectName,
      })
      workspaceStore.getWorkspaceList()
      userStore.fetchUserInfo()
    },
  })
}
</script>

<template>
  <div class="relative flex min-h-0 flex-col h-full">
    <ViewsHeader show-back :title="$t('创建账号')" />
    <div class="px-48 flex flex-1 min-h-0 overflow-hidden overflow-x-auto">
      <div class="w-full h-full mx-auto min-w-160 max-w-208 flex min-h-0 min-w-0 flex-col">
        <AccordionInputs class="flex-1 min-h-0 min-w-0" :accordions="accordions" :inputs-group="inputsGroup">
          <template #before>
            <EcommerceBasicInfoForm ref="basicInfoFormRef" v-model="basicInfo" />
          </template>
        </AccordionInputs>
      </div>
    </div>
    <div class="px-48">
      <div class="mx-auto relative flex items-center justify-end gap-2 py-4 min-h-16 max-w-208 w-full footer">
        <MateGroup v-model="metaData" class="flex-1" />
        <RxButton v-tooltip.top="canCreate ? '' : $t('正在生成新指纹，请稍后')" :label="$t('创建')" :disabled="!canCreate" :loading="loading" @click.stop="createAccount" />
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
