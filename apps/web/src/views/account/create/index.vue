<script lang="ts" setup>
import { API } from '/@/api'
import drawerContent from '/@/components/drawer-content.vue'
import RemarkIcon from '/@/components/remark-icon'
import { $t } from '/@/locales'
import { checkCookieFormat, clearInputsValue, getFormData, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData } from '/@/utils'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '',
  },
  showCreateMore: {
    type: Boolean,
    default: true,
  },
})

const emits = defineEmits(['confirm', 'close'])

const isEdit = computed(() => !!props.data.id)

const formInputs = ref()
const original = ref(props.data)

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
      label: $t('Alias'),
      placeholder: $t('Better name to identify'),
      name: 'platformName',
      tooltip: 'man!',
    },
    {
      type: 'select',
      label: $t('Website'),
      placeholder: $t('Search or enter your platform URL'),
      name: 'platformUrl',
      value: null,
      options: platformOptions,
      required: true,
      editable: true,
      tooltip: 'man!',
      change(input: any) {
        input.invalid = false
        Reflect.set(original.value, 'platformIcon', input.value?.image || '')
      },
    },
    {
      type: 'text',
      label: $t('Account name'),
      placeholder: $t('Username for your website'),
      name: 'platformUserName',
      tooltip: 'mamba out!',
    },
    {
      type: 'password',
      label: $t('Password'),
      placeholder: $t('Password for your server'),
      name: 'platformPassword',
      tooltip: 'man!',
    },
    {
      type: 'text',
      label: '2FA',
      placeholder: $t('32-character Keys'),
      name: 'platformEfa',
      tooltip: 'mamba out!',
    },
    {
      type: 'textarea',
      label: 'Cookies',
      name: 'platformCookies',
      placeholder: $t('Paste JSON format or upload cookies JSON file'),
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
  Reflect.set(original.value, 'platformRemarks', platformRemarks)
}

function onConfirm(more: boolean) {
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

onBeforeMount(() => {
  getInputs(props.data)
    .then((inputs) => {
      formInputs.value = inputs
    })
})
</script>

<template>
  <drawer-content :title="title" v-bind="$attrs" @close="$emit('close')">
    <RyForm :inputs="formInputs" />
    <template #footer>
      <div class="flex flex-1 justify-end gap-3">
        <RemarkIcon class="remark" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RxButton v-if="!isEdit && showCreateMore" size="sm" :label="$t('Save & Create more')" severity="secondary" outlined @click="onConfirm(true)" />
        <RxButton size="sm" :label="$t('Save Account')" severity="info" @click="onConfirm(false)" />
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
