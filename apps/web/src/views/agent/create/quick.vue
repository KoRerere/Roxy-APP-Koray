<script lang="ts" setup>
import { getFormData } from '/@/utils'
import { getInputs } from '/@/views/agent/create/components/form-inputs'
import ProxiesForm from '/@/views/agent/create/components/proxies-form.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['confirm'])

const formInputs = ref()
const original = ref(props.data)
const proxiesFormRef = useTemplateRef('proxiesForm')

async function onConfirm() {
  try {
    if (!proxiesFormRef.value?.visible) {
      await proxiesFormRef.value?.testProxy()
    }
    const formData = getFormData(formInputs.value, original.value)
    emits('confirm', { ...formData })
  }
  catch (error) {
    console.log(error)
  }
}
onBeforeMount(async () => {
  formInputs.value = await getInputs(props.data || {})
})
</script>

<template>
  <div class="flex flex-col h-full account-content">
    <div class="flex-1 overflow-hidden">
      <ProxiesForm ref="proxiesForm" v-model:original="original" :inputs="formInputs" />
    </div>
    <div class="flex items-end">
      <div class="w-full flex justify-end gap-3 button-group">
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

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
