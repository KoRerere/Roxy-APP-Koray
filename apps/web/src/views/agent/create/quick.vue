<script lang="ts" setup>
import drawerContent from '/@/components/drawer-content.vue'
import { getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { getInputs } from './components/form-inputs'
import proxiesForm from './components/proxies-form.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '创建代理',
  },
})
const emits = defineEmits(['confirm'])
console.log('🚀 ~ props.data:', props.data)

const formInputs = ref(getInputs(props.data || {}))
const original = ref({ id: props.data?.id })
const [checkProxy, checkResult] = useCheckProxy()

async function testProxy() {
  const data = getFormData(formInputs.value)
  await checkProxy(data)
}

function onConfirm() {
  try {
    const formData = getFormData(formInputs.value, original.value)
    emits('confirm', { ...formData, ...checkResult })
  }
  catch (error) {
    console.log(error)
  }
}
</script>

<template>
  <drawer-content :title="title" v-bind="$attrs">
    <div class="h-full flex flex-col">
      <proxiesForm :inputs="formInputs" />
    </div>
    <template #footer>
      <div class="flex items-center w-full gap-3">
        <RyButton size="small" label="Test Proxy" icon="base/rx_ic_internet" severity="secondary" outlined
          @click="testProxy" />
        <RyButton class="mx-auto mr-0" size="small" :label="original?.id ? 'Update Proxy' : 'Create Proxy'"
          severity="info" @click="onConfirm" />
      </div>
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped></style>
