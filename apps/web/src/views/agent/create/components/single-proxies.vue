<script lang="ts" setup>
import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { getInputs } from './form-inputs'
import proxiesForm from './proxies-form.vue'
import { ProxyCheckStatus } from '/@/enums'

import { getFormData } from '/@/utils'

const emit = defineEmits(['cancel', 'save'])

const toast = useToast()

const formInputs: any = ref(getInputs())
const checkeResult = ref({
  checkStatus: ProxyCheckStatus.failure,
  lastIp: '',
  lastCity: '',
  lastCountry: '',
  checkTime: '',
})

const loading = ref(false)

async function testProxy() {
  const data = getFormData(formInputs.value)

  loading.value = true
  window.electronAPI.send('proxy:detection', toRaw(data)).then(async (checkRes) => {
    loading.value = false

    if (!checkRes.ip) {
      toast.add({ severity: 'error', summary: 'Errors occur', detail: 'Please checkout your IP configuration and local network then try again.', life: 5000 })
    }
    else {
      toast.add({ severity: 'success', summary: 'Proxy test success', detail: `Location: ${checkRes.continent_code}/${checkRes.country}\nIP: ${checkRes.ip}`, life: 5000 })
    }

    checkeResult.value = {
      checkStatus: !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success,
      lastIp: checkRes.ip ?? '',
      lastCity: checkRes.city ?? '',
      lastCountry: checkRes.continent_code ?? '',
      checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    }
  })
}

function save() {
  const formData = getFormData(formInputs.value)
  emit('save', [{
    ...checkeResult.value,
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
        <Button size="small" severity="secondary" :loading="loading" label="Test proxies" icon="base/rx_ic_speed_test"
          @click="testProxy" />
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
