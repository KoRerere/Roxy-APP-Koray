<script lang="ts" setup>
import { API } from '/@/api'
import rxEditDiv from '/@/components/rx-edit-div'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { MetaData } from './components/type'
import accordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'

const router = useRouter()
const route = useRoute()
const [showToast] = useResponseToast()

createTableContext({ isBatch: ref(false), createCount: ref(0) })

const windowName = ref('edit profile')
const accordions = ref({
  value: ['0'],
  panels: ['window', 'Basic', 'highLevel', 'other']
    .map((title, index) => ({ title, value: index.toString() })),
})
const inputsGroup = ref()
const original = ref()
const metaData = ref<MetaData>()
const loading = ref(false)

function onShuffle() {
  ceateRandomFinger(inputsGroup.value).then((data) => {
    Object.assign(original.value, data[0])
  })
}

async function createProfile(formData: any) {
  const params = {
    ...original.value,
    ...formData,
    windowName: windowName.value,
  }
  loading.value = true
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  showToast(code, msg)
  if (code === 0) {
    router.replace({ name: 'browser-list' })
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

function onBack() {
  router.back()
}

onBeforeMount(() => {
  API.window.userGetWindowInfoV2List({ windowIds: route.query.id as string, isDelete: 0, page_index: 1, page_size: 1 })
    .then(({ data: { rows: [data] } }) => {
      const [_inputsGroup, _original] = getInputsGroup(data)
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
})
</script>

<template>
  <div class="flex justify-between h-full">
    <div class="flex flex-1 flex-col">
      <div class="profile-header">
        <RxSvgIcon class="cursor-pointer" name="base/rx_ic_chevron_left" :size="24" @click="onBack" />
        <span>Edit profile</span>
      </div>
      <div class="flex-ovh-1 flex-col">
        <div class="profile-basic">
          <rxEditDiv v-model="windowName" />
        </div>
        <div class="flex-ovh-1">
          <accordionInputs v-model:metadata="metaData" v-model:loading="loading" :accordions="accordions" :inputs-group="inputsGroup" :open-browser="false" is-edit @create="createProfile" />
        </div>
      </div>
    </div>
    <previewCard :inputs-group="inputsGroup" @shuffle="onShuffle" />
  </div>
</template>

<style lang="scss" scoped>
.profile-header {
  display: flex;
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
  align-items: center;
  gap: 10px;
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);
}

.profile-basic {
  padding: var(--spacing-md, 16px) 66px;
}
</style>
