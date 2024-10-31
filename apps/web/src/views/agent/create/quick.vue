<script lang="ts" setup>
import { getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { getInputs } from './components/form-inputs'
import proxiesForm from './components/proxies-form.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
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
  <div class="flex flex-col h-full account-content">
    <div class="flex-1 overflow-y-auto account-body">
      <proxiesForm :inputs="formInputs" />
    </div>
    <div class="flex items-end">
      <div class="w-full flex justify-end gap-3 button-group">
        <RxButton size="sm" icon="base/rx_ic_internet" :label="$t('测试代理')" severity="secondary" outlined @click="testProxy" />
        <RxButton class="mx-auto mr-0" size="sm" :label="$t('保存')" severity="info" @click="onConfirm" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-content {
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  width: var(--width-xs, 384px);
}

.account-body {
  &::-webkit-scrollbar {
    display: none;
  }
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
