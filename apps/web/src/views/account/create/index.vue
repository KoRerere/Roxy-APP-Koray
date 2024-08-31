<script lang="ts" setup>
import ryForm from '/@/components/ry-form'
import drawerContent from '/@/components/drawer-content.vue'
import { clearInputsValue, getFormData } from '/@/utils'
import { API } from '/@/api'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '创建账号',
  },
})

const emits = defineEmits(['confirm', 'close'])

const formInputs = ref<any>()
const original = ref<any>()

async function getInputs(data: any) {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})

  const platformOptions = rows.map(item => ({
    image: item.platformIcon,
    label: item.platformUrl,
    value: item.platformUrl,
  }))

  formInputs.value = [
    {
      type: 'text',
      label: '平台名称',
      name: 'platformName',
      value: '',
      placeholder: 'Better name to identify',
      tooltip: 'man!',
    },
    {
      type: 'select',
      label: '平台URL',
      name: 'platformUrl',
      placeholder: 'Search or enter your platform URL',
      value: null,
      options: platformOptions,
      required: true,
      editable: true,
      tooltip: 'man!',
      change(value: any, self: any) {
        self.invalid = false
        original.value.platformIcon = value?.image || ''
      },
    },
    {
      type: 'text',
      label: '平台账号',
      name: 'platformUserName',
      value: '',
      placeholder: 'Username for your website',
      tooltip: 'mamba out!',
    },
    {
      type: 'password',
      label: '平台密码',
      name: 'platformPassword',
      value: '',
      placeholder: 'Password for your server',
      tooltip: 'man!',
    },
    {
      type: 'text',
      label: '2FA密钥',
      name: 'platformEfa',
      value: '',
      placeholder: '32-digit Keys',
      tooltip: 'mamba out!',
    },
    {
      type: 'textarea',
      label: '平台cookeies',
      name: 'platformCookies',
      value: '',
      placeholder: 'Paste JSON format or upload cookies JSON file',
      tooltip: 'man!',
      icon: 'mdi mdi-paperclip',
      formatValue: (self: any) => {
        return self.value
        // ? JSON.parse(value).map(({ name, value, domain }) => ({ name, value, domain }))
        // : value
      },
    },
  ]

  original.value = { id: data.id, dirId: data.dirId, windowPlatformList: data.windowPlatformList }
}

function confirm(more: boolean) {
  try {
    const formData = getFormData(formInputs.value, original.value)
    if (!more) {
      emits('close')
    }
    clearInputsValue(formInputs.value)
    emits('confirm', formData)
  }
  catch (error) {
    console.log('🚀 ~ confirm ~ error:', error)
  }
}

onMounted(() => {
  getInputs(props.data)
})
</script>

<template>
  <drawer-content :title="title" v-bind="$attrs" @close="$emit('close')">
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
