<script lang="ts" setup>
import { API } from '/@/api'
import drawerContent from '/@/components/drawer-content.vue'
import remarkIcon from '/@/components/remark-icon'
import ryForm from '/@/components/ry-form'
import { clearInputsValue, getFormData, setInputValueByFormData } from '/@/utils'
import { SimpleCache } from '/@/utils/cache'

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

const isEdit = computed(() => !!props.data.id)
const cache = SimpleCache.getInstance()

const formInputs = ref()
const original = ref()

async function getInputs(data: any = {}) {
  const { data: { rows } } = await cache.fetch(API.platform.userGetPlatformInfoList, {})

  const platformOptions = rows.map((item: any) => ({
    image: item.platformIcon,
    label: item.platformUrl,
    value: item.platformUrl,
  }))

  const inputs = [
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
  setInputValueByFormData(inputs, data)
  return inputs
}

function addRemark([platformRemarks, close]: [string, () => void]) {
  original.value.platformRemarks = platformRemarks
  close()
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
  getInputs(props.data).then((inputs) => {
    formInputs.value = inputs
  })
  original.value = props.data
})
</script>

<template>
  <drawer-content :title="title" v-bind="$attrs" @close="$emit('close')">
    <ry-form :inputs="formInputs" />
    <template #footer>
      <div class="button-group">
        <remarkIcon class="ma-auto ml-0 button-group-remark" :value="original?.platformRemarks"
          @on-confirm="addRemark" />
        <ry-button v-if="!isEdit" label="Save & Create more" severity="secondary" outlined @click="confirm(true)" />
        <ry-button :label="isEdit ? 'Edit account' : 'Create account'" severity="info" @click="confirm(false)" />
      </div>
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  gap: var(--spacing-xl, 12px);

  &-remark {
    padding: var(--spacing-md, 6px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
    background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  }
}
</style>
