<script lang="ts" setup>
import ryForm from '/@/components/ry-form'
import drawerContent from '/@/components/drawer-content.vue'
import { clearInputsValue, getFormData } from '/@/utils'

const props = defineProps({
  closeDrawer: {
    type: Function,
    default: () => () => { },
  },
})

const emits = defineEmits(['confirm'])

const formInputs = ref([
  {
    type: 'text',
    label: 'Website',
    name: 'website',
    value: null,
    tooltip: 'man!',
  },
  {
    type: 'text',
    label: 'Account name',
    name: 'accountname',
    value: null,
    placeholder: 'Username for your website',
    tooltip: 'mamba out!',
    icon: 'mdi mdi-refresh',
  },
  {
    type: 'password',
    name: 'SOCKS5',
    label: 'Password',
    value: null,
    placeholder: 'Password for your server',
    tooltip: 'man!',
  },
  {
    type: 'text',
    label: '2FA',
    name: '2FA',
    value: null,
    placeholder: '32-digit Keys',
    tooltip: 'mamba out!',
  },
  {
    type: 'textarea',
    label: 'Smart detection',
    name: 'SOCKS7',
    value: null,
    placeholder: 'Paste JSON format or upload cookies JSON file',
    tooltip: 'man!',
    icon: 'mdi mdi-refresh',
  },
])

function confirm(more: boolean) {
  if (!more) {
    props.closeDrawer()
  }
  const formData = getFormData(formInputs.value)
  clearInputsValue(formInputs.value)
  emits('confirm', formData)
}
</script>

<template>
  <drawer-content title="创建账号" @close="() => closeDrawer()">
    <ry-form :inputs="formInputs" />
    <template #footer>
      <ry-button label="Save & Create more" severity="secondary" outlined @click="confirm(true)" />
      <ry-button label="Create account" severity="info" @click="confirm(false)" />
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped>
.form-protocol {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);

  &-item {
    display: flex;
    min-width: 120px;
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    align-items: center;
    gap: var(--spacing-lg, 8px);
    border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #ffffff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  }
}
</style>
