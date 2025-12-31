<script lang="ts" setup>
import MateGroup from './components/mate-group.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

import type { WindowMetaData } from './components/type'
import AccordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'
import { useBackRoute } from '/@/router/utils'
import { getFormDataByList } from '/@/utils'

const router = useRouter()
const route = useRoute()
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
  }
  loading.value = true
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    if (path === '/browser/edit') {
      router.replace({ path: '/browser' })
    } else {
      router.replace({ path, query })
    }
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
  <div class="relative flex flex-col h-full">
    <ViewsHeader show-back :title="$t('编辑窗口')" />
    <div class="flex flex-1 px-28 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex flex-col ma-auto" :class="[collapsed ? 'min-w-[768px] max-w-[768px]' : 'min-w-[960px] max-w-[1140px]']">
        <div class="flex-1 flex gap-8 overflow-hidden">
          <AccordionInputs :windowInfo="windowInfo" :accordions="accordions" :inputs-group="inputsGroup">
            <template #before>
              <div class="flex items-center justify-between px-4 py-4 subtitle">{{ $t('窗口信息') }}</div>
            </template>
          </AccordionInputs>
          <previewCard v-model:collapsed="collapsed" :inputs-group="inputsGroup" :on-shuffle="onShuffle" />
        </div>
        <div class="relative flex items-center gap-2 py-4 min-h-16 overflow-hidden footer">
          <div class="footer-separator"></div>
          <MateGroup class="flex-1" v-model="metaData" is-edit />
          <RxButton severity="primary" :label="$t('保存')" @click="createProfile" />
        </div>
      </div>
    </div>
    <div class="foot-separator"></div>
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
