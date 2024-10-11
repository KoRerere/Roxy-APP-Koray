<script lang="ts" setup>
import drawerContent from '/@/components/drawer-content.vue'
import { getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { getInputs } from './components/form-inputs'
import proxiesForm from './components/proxies-form.vue'

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

const formInputs = ref(getInputs(props.data || {}))
const original = ref(props.data)
const [checkProxy] = useCheckProxy()

async function testProxy() {
  const data = getFormData(formInputs.value)

  await checkProxy(data)
}

function onConfirm() {
  try {
    const formData = getFormData(formInputs.value, original.value)
    emits('confirm', formData)
  }
  catch (error) {
    console.log(error)
  }
}
</script>

<template>
  <drawer-content :title="title" v-bind="$attrs">
    <div class="h-full flex flex-col">
      <proxiesForm :inputs="formInputs" />
    </div>
    <template #footer>
      <div class="flex items-center w-full gap-3">
        <ry-button size="small" label="Test Proxy" icon="base/rx_ic_internet" severity="secondary" outlined
          @click="testProxy" />
        <span class="mdi mdi-list-box-outline remark cursor-pointer" />
        <ry-button class="mx-auto mr-0" size="small" :label="original?.id ? 'Update Proxy' : 'Create Proxy'"
          severity="info" @click="onConfirm" />
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
