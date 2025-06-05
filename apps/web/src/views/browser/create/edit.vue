<script lang="ts" setup>
import MateGroup from './components/mate-group.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import type { WindowMetaData } from './components/type'
import accordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'
import { useBackRoute } from '/@/router/utils'
import WindowNameEdit from './components/window-name-edit.vue'
import { getDefaultWindowName } from './utils'
import { getFormDataByList } from '/@/utils'

const defaultWindowName = getDefaultWindowName()

const router = useRouter()
const route = useRoute()
const [showToast, onlyErrorToast] = useResponseToast()
const { path, query } = useBackRoute()

createTableContext({ isBatch: ref(false), createCount: ref(0) })

const windowName = ref()
const accordions = ref({
  value: ['0'],
  panels: [$t('窗口信息'), $t('基础设置'), $t('高级指纹设置'), $t('偏好设置')]
    .map((title, index) => ({ title, value: index.toString() })),
})
const inputsGroup = ref()
const original = ref()
const metaData = ref<WindowMetaData>()
const loading = ref(false)
const windowInfo = ref({})

onBeforeMount(async () => {
  const { code, data: { rows: [data] }, msg } = await API.window.userGetWindowInfoV2List({ windowIds: route.query.id as string, isDelete: 0, page_index: 1, page_size: 1 })

  if (code !== 0) {
    onlyErrorToast(code, msg)
    return
  }

  windowInfo.value = data
  const [_inputsGroup, _original] = await getInputsGroup(data, showToast)
  inputsGroup.value = _inputsGroup
  original.value = _original
  oldFieldsFormat()
  windowName.value = data.windowName as string
  metaData.value = {
    projectName: data.projectName,
    projectId: data.projectId as number | undefined,
    labelIds: data.labelIds,
    windowRemark: data.windowRemark,
  }
})

async function onShuffle() {
  const data = await ceateRandomFinger(inputsGroup.value)
  Object.assign(original.value, data[0])
  showToast(0, $t('指纹刷新成功'))
}

async function createProfile() {
  const formData = getFormDataByList(inputsGroup.value, toRaw(metaData.value))
  const params = {
    ...original.value,
    ...formData,
    windowName: windowName.value?.startsWith(defaultWindowName) ? '' : windowName.value,
  }
  loading.value = true
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    router.replace({ path, query })
  }
  loading.value = false
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
  <div class="flex flex-col h-full">
    <ViewsHeader show-back :divider="false" :title="$t('编辑窗口')" />
    <div class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex flex-col">
        <div class="profile-basic">
          <WindowNameEdit v-model="windowName" />
        </div>
        <div class="flex-ovh-1">
          <accordionInputs :windowInfo="windowInfo" :accordions="accordions" :inputs-group="inputsGroup" />
        </div>
      </div>
      <previewCard :inputs-group="inputsGroup" :on-shuffle="onShuffle" />
    </div>
    <div class="flex items-center gap-2 footer">
      <MateGroup v-model="metaData" class="flex-1" />
      <RxButton severity="primary" :label="$t('保存')" @click="createProfile" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.profile-basic {
  padding: 16px 48px 16px 124px;
}

.footer {
  padding: 16px 124px;
  max-height: 64px;
  border-top: 1px solid var(--colors-border-border-subtle);

  :deep(.p-button) {
    max-width: 150px;
  }

  :deep(.p-button-label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
