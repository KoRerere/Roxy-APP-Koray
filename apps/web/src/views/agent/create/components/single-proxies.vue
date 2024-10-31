<script lang="ts" setup>
import RemarkIcon from '/@/components/remark-icon'
// import { useResponseToast } from '/@/hooks/useResponseToast'
import { getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { getInputs } from './form-inputs'
import ProxiesForm from './proxies-form.vue'

const emit = defineEmits(['cancel', 'save'])

const [checkProxy, checkeResult] = useCheckProxy()
// const [_, onlyErrorToast] = useResponseToast()

const formInputs: any = ref(getInputs())

const remark = ref()

async function testProxy() {
  try {
    const data = getFormData(formInputs.value)
    await checkProxy(toRaw(data))
  }
  catch (error) {
    console.log(error)
  }
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
  <div class="flex items-center flex-col max-w-50% mt-5 mx-auto">
    <div class="flex-1 overflow-y-auto proxies">
      <ProxiesForm :inputs="formInputs" />
    </div>
    <div class="flex justify-between w-full">
      <div class="flex items-center gap-3">
        <RxButton size="sm" outlined severity="secondary" :label="$t('测试代理')" icon="base/rx_ic_speed_test" @click="testProxy" />
        <RemarkIcon class="ma-auto ml-0" mode="button" :value="remark" :on-confirm="addRemark" />
      </div>
      <div class="flex gap-3 py-4">
        <RxButton size="sm" severity="info" :label="$t('保存')" @click="save" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies {
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
