<script lang="ts" setup>
import rxEditDiv from '/@/components/rx-edit-div'
import accordionInputs from './components/accordion-inputs.vue'
import previewCard from './components/preview-card.vue'
import { getFormDataByList } from '/@/utils'
import { getInputsGroup } from './form-inputs'
import { API } from '/@/api'
import { createTableContext } from './hooks/useContext'

const router = useRouter()
const route = useRoute()

const windowName = ref('edit profile')
const accordions = ref({
  value: ['0'],
  panels: ['window', 'Basic', 'highLevel', 'other']
    .map((title, index) => ({ title, value: index.toString() })),
})
const inputsGroup = ref()
const original = ref()

const previewData = computed(() => getFormDataByList(inputsGroup.value, {}, { keyName: 'label', valueName: 'value' }))

createTableContext({ isBatch: ref(false), createCount: ref(0) })

async function createProfile(formData: any) {
  const params = {
    windowName: windowName.value,
    ...original.value,
    ...formData,
  }
  await API.window.userMdfWindowInfoSingleCreate(params)
  router.replace({ name: 'browser-list' })
}

function cancel() {
  router.back()
}

onMounted(() => {
  const data = JSON.parse(localStorage.getItem(`$editWindow_${route.query.id}`) || '{}')

  windowName.value = data.windowName
  inputsGroup.value = getInputsGroup(data)
  original.value = {
    ...data,
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
        <accordionInputs v-model:windowName="windowName" :accordions="accordions" :inputs-group="inputsGroup"
          :open-browser="false" @cancel="cancel" @create="createProfile" />
      </div>
    </div>
    <previewCard :data="previewData" />
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
