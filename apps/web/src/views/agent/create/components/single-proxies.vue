<script lang="ts" setup>
import { getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { getInputs } from './form-inputs'
import proxiesForm from './proxies-form.vue'

const emit = defineEmits(['cancel', 'save'])

const [checkProxy, checkeResult] = useCheckProxy()

const formInputs: any = ref(getInputs())

function testProxy() {
  const data = getFormData(formInputs.value)
  checkProxy(toRaw(data))
}

function save() {
  const formData = getFormData(formInputs.value)
  emit('save', [{
    ...checkeResult,
    ...formData,
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }])
}
</script>

<template>
  <div class="flex items-center flex-col w-50% mx-auto">
    <proxiesForm :inputs="formInputs" />
    <div class="flex flex-1 items-end justify-between w-full">
      <div class="flex items-center gap-3">
        <Button size="small" severity="secondary" :loading="checkeResult.loading" label="Test proxies"
          icon="base/rx_ic_speed_test" @click="testProxy" />
        <span class="mdi mdi-list-box-outline remark cursor-pointer" />
      </div>
      <div class="flex gap-3">
        <ryButton text size="small" severity="secondary" label="Cancel" @click="$emit('cancel')" />
        <ryButton size="small" severity="info" label="Save proxies" @click="save" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.remark {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md, 6px);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);

  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
