<script lang="ts" setup>
import { API } from '/@/api'
import rxEditDiv from '/@/components/rx-edit-div'
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
  const { code, msg } = await API.window.userMdfWindowInfoSingleCreate(params)
  showToast(code, msg)
  if (code === 0) {
    router.replace({ name: 'browser-list' })
  }
}

onMounted(() => {
  const data = JSON.parse(localStorage.getItem(`$editWindow_${route.query.id}`) || '{}')
  const [_inputsGroup, _original] = getInputsGroup(data)
  inputsGroup.value = _inputsGroup
  original.value = _original
  windowName.value = data.windowName
  metaData.value = {
    projectName: data.projectName,
    projectId: data.projectId,
    labelIds: data.labelIds,
    windowRemark: data.windowRemark,
  }
})

onUnmounted(() => {
  localStorage.removeItem(`$editWindow_${original.value.id}`)
})
</script>

<template>
  <div class="flex justify-between h-full">
    <div class="flex-ovh-1 flex-col">
      <div class="top-content">
        <rxEditDiv v-model="windowName" class="window-name" />
      </div>
      <div class="flex-ovh-1">
        <accordionInputs v-model:metadata="metaData" :accordions="accordions" :inputs-group="inputsGroup"
          :open-browser="false" is-edit @create="createProfile" />
      </div>
    </div>
    <previewCard :inputs-group="inputsGroup" @shuffle="onShuffle" />
  </div>
</template>

<style lang="scss" scoped>
.top-content {
  padding: var(--spacing-md, 16px) var(--spacing-sm, 12px);

  &-windown-name {
    padding: var(--spacing-md, 6px) 8px;
  }
}
</style>
