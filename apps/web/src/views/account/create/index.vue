<script lang="ts" setup>
import { API } from '/@/api'
import drawerContent from '/@/components/drawer-content.vue'
import RemarkIcon from '/@/components/remark-icon'
import { checkCookieFormat, clearInputsValue, getFormData, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData } from '/@/utils'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '创建账号',
  },
  showCreateMore: {
    type: Boolean,
    default: true,
  },
})

const emits = defineEmits(['confirm', 'close'])

const isEdit = computed(() => !!props.data.id)

const formInputs = ref()
const original = ref()

async function getInputs(data: any = {}) {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})

  const platformOptions = rows.map((item: any) => ({
    image: item.platformIcon,
    label: item.platformUrl,
    value: item.platformUrl,
  }))

  const inputs = reactive([
    {
      type: 'text',
      label: '平台名称',
      name: 'platformName',
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
      change(input: any) {
        input.invalid = false
        original.value.platformIcon = input.value?.image || ''
      },
    },
    {
      type: 'text',
      label: '平台账号',
      name: 'platformUserName',
      placeholder: 'Username for your website',
      tooltip: 'mamba out!',
    },
    {
      type: 'password',
      label: '平台密码',
      name: 'platformPassword',
      placeholder: 'Password for your server',
      tooltip: 'man!',
    },
    {
      type: 'text',
      label: '2FA密钥',
      name: 'platformEfa',
      placeholder: '32-digit Keys',
      tooltip: 'mamba out!',
    },
    {
      type: 'textarea',
      label: '平台cookies',
      name: 'platformCookies',
      placeholder: 'Paste JSON format or upload cookies JSON file',
      errorMsg: 'Invalid cookie format',
      tooltip: 'man!',
      icon: 'base/rx_ic_attachment',
      autoResize: false,
      formatValue: (input: any) => {
        return checkCookieFormat(input.value) ? input.value : ''
      },
      onBlur(event: any) {
        if (!checkCookieFormat(event.target.value)) {
          setInputFieldByInputKey(inputs, 'platformCookies', 'invalid', true)
        }
      },
      iconClick: async (input: any) => {
        const res = await readCookiesFile()
        if (res?.data) {
          input.value = res.data
          input.invalid = false
        }
        else {
          input.value = ''
          input.invalid = true
        }
      },
    },
  ])
  setInputValueByFormData(inputs, data)
  return inputs
}

function addRemark(platformRemarks: string) {
  original.value.platformRemarks = platformRemarks
}

function onConfirm(more: boolean) {
  try {
    const formData = getFormData(formInputs.value, original.value)
    console.log('🚀 ~ onConfirm ~ formData:', formData)

    // if (!more) {
    //   emits('close')
    // }
    // clearInputsValue(formInputs.value)
    // emits('confirm', formData)
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
    <RyForm :inputs="formInputs" />
    <template #footer>
      <div class="flex flex-1 justify-end gap-3">
        <RemarkIcon class="remark" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RyButton v-if="!isEdit && showCreateMore" size="small" label="Save & Create more" severity="secondary" outlined
          @click="onConfirm(true)" />
        <RyButton size="small" :label="isEdit ? 'Edit account' : 'Create account'" severity="info"
          @click="onConfirm(false)" />
      </div>
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped>
.remark {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  margin-left: 0;
  padding: var(--spacing-md, 6px);
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
