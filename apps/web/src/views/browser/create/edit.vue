<script lang="ts" setup>
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

async function createProfile(formData: any) {
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
  <div class="flex justify-between h-full">
    <div class="flex flex-1 flex-col">
      <ViewsHeader show-back :divider="false" :title="$t('编辑窗口')" />
      <div class="flex-ovh-1 flex-col">
        <div class="profile-basic">
          <WindowNameEdit v-model="windowName" />
        </div>
        <div class="flex-ovh-1">
          <accordionInputs v-model:metadata="metaData" v-model:loading="loading" :windowInfo="windowInfo" :accordions="accordions" :inputs-group="inputsGroup" :open-browser="false" is-edit
            @create="createProfile" />
        </div>
      </div>
    </div>
    <previewCard :inputs-group="inputsGroup" :on-shuffle="onShuffle" />
  </div>
</template>

<style lang="scss" scoped>
.profile-basic {
  padding: var(--spacing-md, 16px) 66px;
}
</style>
