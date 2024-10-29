<script lang="ts" setup>
import { API } from '/@/api'
import RemarkIcon from '/@/components/remark-icon'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { checkCookieFormat, clearInputsValue, getFormData, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData } from '/@/utils'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  showRemark: {
    type: Boolean,
    default: true,
  },
  showCreateMore: {
    type: Boolean,
    default: true,
  },
})
const emits = defineEmits(['confirm', 'close'])

const [_, onlyErrorToast] = useResponseToast()

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
    // {
    //   type: 'text',
    //   label: $t('alias'),
    //   placeholder: $t('Better name to identify'),
    //   name: 'platformName',
    // },
    {
      type: 'select',
      label: $t('平台'),
      placeholder: $t('请输入或选择平台网址'),
      name: 'platformUrl',
      value: null,
      options: platformOptions,
      required: true,
      editable: true,
      change(input: any) {
        input.invalid = false
        Reflect.set(original.value, 'platformIcon', input.value?.image || '')
      },
    },
    {
      type: 'text',
      label: $t('账号'),
      placeholder: $t('请输入账号'),
      name: 'platformUserName',
    },
    {
      type: 'password',
      label: $t('密码'),
      placeholder: $t('请输入密码'),
      name: 'platformPassword',
    },
    {
      type: 'text',
      label: '2FA',
      placeholder: $t('请输入 2FA 密钥'),
      name: 'platformEfa',
    },
    {
      type: 'textarea',
      label: 'Cookies',
      name: 'platformCookies',
      placeholder: $t('请以 JSON 格式输入 Cookies'),
      errorMsg: 'Invalid cookie format',
      icon: 'base/rx_ic_attachment',
      autoResize: false,
      formatValue: (input: any) => {
        return input.value ? JSON.parse(input.value) : []
      },
      onBlur(event: any) {
        if (!checkCookieFormat(event.target.value)) {
          setInputFieldByInputKey(inputs, 'platformCookies', 'invalid', true)
        }
      },
      iconClick: async (input: any) => {
        const res = await readCookiesFile()
        if (res) {
          const { code, data, message } = res
          onlyErrorToast(code, message)
          if (data) {
            input.value = res.data
            input.invalid = false
          }
        }
      },
    },
  ])
  setInputValueByFormData(inputs, { ...data, platformCookies: JSON.stringify(data.platformCookies) })
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
  <div class="flex flex-col h-full account-content">
    <RyForm :inputs="formInputs" />
    <div class="flex flex-1 items-end">
      <div class="w-full flex justify-end gap-3 button-group">
        <RemarkIcon v-if="showRemark" class="ma-auto ml-0" mode="button" :title="$t('请为账号添加备注')" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RxButton v-if="!isEdit && showCreateMore" size="sm" :label="$t('保存 & 继续添加')" severity="secondary" outlined @click="onConfirm(true)" />
        <RxButton size="sm" :label="$t('保存')" severity="info" @click="onConfirm(false)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-content {
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  width: var(--width-xs, 384px);
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
