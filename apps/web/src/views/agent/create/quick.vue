<script lang="ts" setup>
import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { getInputs } from './components/form-inputs'
import proxiesForm from './components/proxies-form.vue'
import drawerContent from '/@/components/drawer-content.vue'
import { ProxyCheckStatus } from '/@/enums'

import { getFormData } from '/@/utils'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '创建代理',
  },
})
const emits = defineEmits(['confirm'])
const toast = useToast()

const formInputs = ref<any>([])
const original = ref<any>()
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

function createProxy() {
  try {
    const formData = getFormData(formInputs.value, original.value)
    emits('confirm', formData)
  }
  catch (error) {
    console.log(error)
  }
}

onMounted(() => {
  formInputs.value = getInputs(props.data || {})
})
</script>

<template>
  <drawer-content :title="title" v-bind="$attrs">
    <div class="h-full flex flex-col">
      <proxiesForm :inputs="formInputs" />
    </div>
    <template #footer>
      <div class="flex items-center w-full gap-3">
        <ry-button size="small" label="Test Proxy" icon="mdi mdi-wifi" severity="secondary" outlined
          @click="testProxy" />
        <span class="mdi mdi-list-box-outline remark cursor-pointer" />
        <ry-button class="mx-auto mr-0" size="small" label="Save selected" severity="info" @click="createProxy" />
      </div>
    </template>
  </drawer-content>
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
