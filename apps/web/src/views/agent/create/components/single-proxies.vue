<script lang="ts" setup>
import RemarkIcon from '/@/components/remark-icon'
import { getFormData } from '/@/utils'
import { getInputs } from '/@/views/agent/create/components/form-inputs'
import ProxiesForm from '/@/views/agent/create/components/proxies-form.vue'

const emit = defineEmits(['cancel', 'save'])

const formInputs = ref()
const original = ref()
const remark = ref()

function addRemark(platformRemarks: string) {
  remark.value = platformRemarks
}

function save() {
  const formData = getFormData(formInputs.value, original.value)
  emit('save', [{
    ...formData,
    remark: remark.value,
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }])
}

onBeforeMount(async () => {
  formInputs.value = await getInputs()
})
</script>

<template>
  <div class="flex items-center flex-col max-w-50% mt-5 mx-auto">
    <div class="flex-1 overflow-hidden">
      <ProxiesForm v-model:original="original" :inputs="formInputs" />
    </div>
    <div class="flex justify-between w-full">
      <div class="flex items-center gap-3">
        <RemarkIcon class="ma-auto ml-0" :title="$t('请为代理添加备注')" :label="$t('备注')" mode="button" :value="remark"
          :on-confirm="addRemark" />
      </div>
      <div class="flex gap-3 py-4">
        <RxButton size="sm" severity="info" :label="$t('保存')" @click="save" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
