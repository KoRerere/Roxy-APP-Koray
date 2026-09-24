<script lang="ts" setup>
import MateGroup from './components/mate-group.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

import type { WindowMetaData } from './components/type'
import { toLabelId } from './hooks/useMate'
import AccordionInputs from './components/accordion-inputs.vue'
import BasicInfo from './components/basic-info.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createFormAsyncGate } from './hooks/useAsyncGate'
import { createTableContext } from './hooks/useContext'
import { createSingleWindowAccordions } from './modes/createDefaultAccordions'
import { ensureApiExtractProxyInfo } from './components/proxy-info/api-extract'
import { buildUiProxyInfoList, toSingleWindowProxyParams } from './components/proxy-info/proxy-params'
import { useBackRoute } from '/@/router/navigation'
import { LIST_CACHE_NAMESPACE, useListCacheActions } from '/@/stores/listCache'
import { findInputByName, getFormDataByList } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'

const router = useRouter()
const route = useRoute()
const { mixpanelTrack } = useUserStore()
const { userConfig, userPayInfo } = storeToRefs(useUserStore())
const { testProxy } = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()
const { path, query } = useBackRoute()
const { invalidateCache } = useListCacheActions()

createTableContext({ isBatch: ref(false), createCount: ref(0) })
const accordions = ref(createSingleWindowAccordions())
const inputsGroup = ref()
const original = ref()
const metaData = ref<WindowMetaData>()
const collapsed = ref(false)
const loading = ref(false)
const formGate = createFormAsyncGate()
const formInitialized = ref(false)
const windowInfo = ref({})

const canSave = computed(() => formInitialized.value && formGate.isReady.value && !loading.value)
const windowInputs = computed(() => inputsGroup.value?.[0] ?? [])

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
    labelIds: (data!.labelIds || []).map(id => toLabelId(id)),
    windowRemark: data!.windowRemark,
  }
  formInitialized.value = true
})

async function onShuffle() {
  const data = await formGate.run(() => ceateRandomFinger(inputsGroup.value))
  Object.assign(original.value, data[0])
  showToast(0, $t('指纹刷新成功'))
}

/** 保存后失效窗口列表缓存，避免返回时 restore 到编辑前的旧行数据 */
function invalidateBrowserListCache() {
  invalidateCache(LIST_CACHE_NAMESPACE.BROWSER_LIST, { projectId: '' })
  const projectIds = new Set(
    [metaData.value?.projectId, (windowInfo.value as { projectId?: string | number })?.projectId]
      .filter(id => id != null && String(id) !== '')
      .map(String),
  )
  for (const projectId of projectIds)
    invalidateCache(LIST_CACHE_NAMESPACE.BROWSER_LIST, { projectId })
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
  const ensured = await ensureApiExtractProxyInfo(params, {
    checkChannel: userConfig.value.ipChecker,
    isDirect: userPayInfo.value.isDirectWhitelist,
    testProxy,
  })
  // 仅 API 静默提取成功时写回，避免 choose/custom 的 UI 草稿被扁平重建冲掉
  if (ensured !== params) {
    const proxyInput = findInputByName(inputsGroup.value[0] ?? [], 'proxyInfoList')
    if (proxyInput)
      proxyInput.value = buildUiProxyInfoList(ensured)
  }

  const requestParams = toSingleWindowProxyParams(ensured)
  loading.value = true
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(requestParams as any)
  loading.value = false
  onlyErrorToast(code, msg)
  if (code === 0) {
    mixpanelTrack('profile_edit')
    invalidateBrowserListCache()
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
  <div class="relative flex min-h-0 flex-col h-full">
    <ViewsHeader show-back :title="$t('编辑窗口')" />
    <div class="px-16 flex flex-1 min-h-0 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex min-h-0 gap-8 ma-auto" :class="[collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285']">
        <AccordionInputs class="min-h-0 min-w-0 flex-1" :accordions="accordions" :inputs-group="inputsGroup">
          <template #before>
            <BasicInfo :window-inputs="windowInputs" />
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
