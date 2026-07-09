<script lang="ts" setup>
import MateGroup from './components/mate-group.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

import type { WindowMetaData } from './components/type'
import AccordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createFormAsyncGate } from './hooks/useAsyncGate'
import { createTableContext } from './hooks/useContext'
import { useBackRoute } from '/@/router/navigation'
import { getFormDataByList } from '/@/utils'
import { useUserStore } from '/@/stores/user'

const router = useRouter()
const route = useRoute()
const { mixpanelTrack } = useUserStore()
const [showToast, onlyErrorToast] = useResponseToast()
const { path, query } = useBackRoute()

createTableContext({ isBatch: ref(false), createCount: ref(0) })
const accordions = ref({
  value: [],
  panels: [$t('基础设置'), $t('高级指纹设置'), $t('偏好设置')]
    .map((title, index) => ({ title, value: index.toString() })),
})
const inputsGroup = ref()
const original = ref()
const metaData = ref<WindowMetaData>()
const collapsed = ref(false)
const loading = ref(false)
const formGate = createFormAsyncGate()
const formInitialized = ref(false)
const windowInfo = ref({})

const canSave = computed(() => formInitialized.value && formGate.isReady.value && !loading.value)

onBeforeMount(async () => {
  formInitialized.value = false
  const { code, data: { rows: [data] }, msg } = await API.window.userGetWindowInfoV2List({ windowIds: route.query.id as string, isDelete: 0, page_index: 1, page_size: 1 })

  if (code !== 0) {
    onlyErrorToast(code, msg)
    return
  }

  windowInfo.value = data!
  const [_inputsGroup, _original] = await getInputsGroup(data, showToast, formGate)
  inputsGroup.value = _inputsGroup
  original.value = _original
  oldFieldsFormat()
  metaData.value = {
    projectName: data!.projectName,
    projectId: Number(data!.projectId),
    labelIds: data!.labelIds,
    windowRemark: data!.windowRemark,
  }
  formInitialized.value = true
})

async function onShuffle() {
  const data = await formGate.run(() => ceateRandomFinger(inputsGroup.value))
  Object.assign(original.value, data[0])
  showToast(0, $t('指纹刷新成功'))
}

async function createProfile() {
  if (!formInitialized.value || !inputsGroup.value)
    return

  await formGate.waitUntilReady()
  const formData = getFormDataByList(inputsGroup.value, toRaw(metaData.value))
  const params = {
    ...original.value,
    ...formData,
  }
  loading.value = true
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  loading.value = false
  onlyErrorToast(code, msg)
  if (code === 0) {
    mixpanelTrack('profile_edit')
    if (path === '/browser/edit') {
      router.replace({ path: '/browser' })
    }
    else {
      router.replace({ path, query })
    }
  }
}

function oldFieldsFormat() {
  // 删除旧版本字段多余数据
  const oldFields = ['platformUrl', 'platformUserName', 'platformPassword']
  oldFields.forEach((key) => {
    Reflect.set(original.value, key, '')
  })
}
</script>

<template>
  <div class="relative flex flex-col h-full">
    <ViewsHeader show-back :title="$t('编辑窗口')" />
    <div class="px-16 flex flex-1 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex gap-8 ma-auto" :class="[collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285']">
        <AccordionInputs class="min-w-0 flex-1" :window-info="windowInfo" :accordions="accordions" :inputs-group="inputsGroup">
          <template #before>
            <div class="flex items-center justify-between px-4 py-4 subtitle">
              {{ $t('窗口信息') }}
            </div>
          </template>
        </AccordionInputs>
        <previewCard v-model:collapsed="collapsed" :inputs-group="inputsGroup" is-edit :on-shuffle="onShuffle" />
      </div>
    </div>
    <div class="px-16">
      <div class="mx-auto relative flex items-center justify-end gap-2 py-4 min-h-16 footer" :class="[collapsed ? 'max-w-192' : 'max-w-285']">
        <MateGroup v-model="metaData" class="flex-1" is-edit />
        <RxButton v-tooltip.top="canSave ? '' : $t('正在同步指纹，请稍后')" severity="primary" :label="$t('保存')" :disabled="!canSave" :loading="loading" @click="createProfile" />
      </div>
    </div>
    <div class="foot-separator" />
  </div>
</template>

<style lang="scss" scoped>
.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
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
