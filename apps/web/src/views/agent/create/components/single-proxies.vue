<script lang="ts" setup>
import RemarkIcon from '/@/components/remark-icon'
import { getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { getInputs } from './form-inputs'
import ProxiesForm from './proxies-form.vue'

const emit = defineEmits(['cancel', 'save'])

const [checkProxy, checkeResult] = useCheckProxy()

const formInputs: any = ref(getInputs())

const remark = ref()

async function testProxy() {
  const data = getFormData(formInputs.value)
  await checkProxy(toRaw(data))
}

function addRemark(platformRemarks: string) {
  remark.value = platformRemarks
}

function save() {
  const formData = getFormData(formInputs.value)
  emit('save', [{
    ...checkeResult,
    ...formData,
    remark: remark.value,
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }])
}
</script>

<template>
  <div class="flex items-center flex-col w-50% mx-auto">
    <div class="flex-1 overflow-y-auto">
      <ProxiesForm :inputs="formInputs" />
    </div>
    <div class="flex justify-between w-full">
      <div class="flex items-center gap-3">
        <RxButton size="sm" severity="secondary" :label="$t('Test proxies')" icon="base/rx_ic_speed_test" @click="testProxy" />
        <RemarkIcon class="ma-auto ml-0" mode="button" :value="remark" :on-confirm="addRemark" />
      </div>
      <div class="flex gap-3 py-4">
        <RxButton text size="sm" severity="secondary" :label="$t('Cancel')" @click="$emit('cancel')" />
        <RxButton size="sm" severity="info" :label="$t('Save proxies')" @click="save" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
