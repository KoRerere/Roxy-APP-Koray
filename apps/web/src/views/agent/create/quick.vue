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
    default: '',
  },
})
const emits = defineEmits(['confirm'])

const formInputs = ref(getInputs(props.data || {}))
const original = ref(props.data)
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
        <RxButton size="sm" icon="base/rx_ic_internet" :label="$t('测试代理')" severity="secondary" outlined @click="testProxy" />
        <RxButton class="mx-auto mr-0" size="sm" :label="$t('保存')" severity="info" @click="onConfirm" />
      </div>
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped></style>
