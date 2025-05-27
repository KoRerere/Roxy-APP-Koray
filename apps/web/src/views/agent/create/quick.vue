<script lang="ts" setup>
import { getFormData } from '/@/utils'
import { getInputs } from '/@/views/agent/create/components/form-inputs'
import ProxiesForm from '/@/views/agent/create/components/proxies-form.vue'

interface Props {
  data?: Record<string, any>
  onConfirm?: (formData: Record<string, any>) => void | Promise<void>
}

const { data, onConfirm = () => { } } = defineProps<Props>()

const proxiesFormRef = useTemplateRef('proxiesForm')
const formInputs = ref()
const original = ref(data)

async function _onConfirm() {
  try {
    if (!proxiesFormRef.value?.visible) {
      await proxiesFormRef.value?.testProxy()
    }
    const formData = getFormData(formInputs.value, original.value)
    await onConfirm({ ...formData })
  }
  catch (error) {
    console.log(error)
  }
}
onBeforeMount(async () => {
  formInputs.value = await getInputs(data)
})
</script>

<template>
  <div class="flex flex-col h-full account-content">
    <div class="flex-1 overflow-hidden">
      <ProxiesForm ref="proxiesForm" v-model:original="original" :inputs="formInputs" />
    </div>
    <div class="flex items-end">
      <div class="w-full flex justify-end gap-3 button-group">
        <RxButton class="mx-auto mr-0" size="sm" :label="$t('保存')" @click="_onConfirm" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-content {
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  min-width: var(--width-xs, 384px);
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
