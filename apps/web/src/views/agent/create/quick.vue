<script lang="ts" setup>
import { getFormData } from '/@/utils'
import { getInputs } from './components/form-inputs'
import ProxiesForm from './components/proxies-form.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['confirm'])

const formInputs = ref(getInputs(props.data || {}))
const original = ref(props.data)

function onConfirm() {
  try {
    const formData = getFormData(formInputs.value, original.value)
    emits('confirm', { ...formData })
  }
  catch (error) {
    console.log(error)
  }
}
</script>

<template>
  <div class="flex flex-col h-full account-content">
    <div class="flex-1 overflow-hidden">
      <ProxiesForm v-model:original="original" :inputs="formInputs" />
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
