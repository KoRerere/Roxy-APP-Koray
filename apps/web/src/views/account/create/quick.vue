<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue';
import RemarkIcon from '/@/components/remark-icon'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { deepClone, isEmptyValue } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'
import { parseIntelligent } from '/@/views/account/create/utils'

interface Props {
  data?: Record<string, any>
  showRemark?: boolean
  showCreateMore?: boolean
  onConfirm?: (formData: Record<string, any>) => void | Promise<void>
}

const {
  data = {},
  showRemark = true,
  showCreateMore = true,
  onConfirm
} = defineProps<Props>()

const emit = defineEmits(['close'])

const { realTheme } = storeToRefs(useThemeStore())

const formRef = useTemplateRef('tsform')

const needMore = ref(false)
const loading = ref(false)
const original = ref()
const parseFormat = `${$t('账号')}:${$t('密码')}:2FA${showRemark ? `{${$t('备注')}}` : ''}`
const inputs = [
  {
    type: 'textarea',
    label: $t('智能识别'),
    name: 'intelligent',
    props: {
      placeholder: parseFormat,
      rows: 2,
      onBlur: (event: Event) => {
        const result = parseIntelligent((event.target as HTMLTextAreaElement).value)
        if (isEmptyValue(Object.values(result).filter(Boolean))) return

        const { username, password, twoFactor, remark } = result
        formRef.value?.setValues({
          platformUserName: username ?? '',
          platformPassword: password ?? '',
          platformEfa: twoFactor ?? '',
          intelligent: '',
        })
        Reflect.set(original.value, 'platformRemarks', remark ?? '')
      },
    },
    resolver: (zod: any) => zod
      .string()
      .refine((value: string) => {
        if (isEmptyValue(value)) return true
        return !isEmptyValue(Object.values(parseIntelligent(value)).filter(Boolean))
      }, { message: $t('解析错误,请检查格式：{text}', { text: parseFormat }) })
  },
  {
    separator: true,
  },
  {
    type: 'select',
    label: $t('平台'),
    name: 'platformUrl',
    value: data.platformUrl,
    props: {
      placeholder: $t('请输入或选择平台网址'),
      optionValue: 'value',
      editable: true,
      filter: true,
      darkMode: realTheme.value === 'dark',
      onChange: ({ value, props }: any) => {
        const platform = props.options.find((item: any) => item.value === value)
        Reflect.set(original.value, 'platformIcon', platform?.image || "")
        Reflect.set(original.value, 'platformIconDark', platform?.darkImage || "")
      }
    },
    resolver: (zod: any) => zod.string().url($t('请输入正确的平台网址'))
  },
  {
    type: 'text',
    label: $t('账号'),
    name: 'platformUserName',
    value: data.platformUserName,
    props: {
      placeholder: $t('请输入账号'),
    }
  },
  {
    type: 'password',
    label: $t('密码'),
    name: 'platformPassword',
    value: data.platformPassword,
    props: {
      placeholder: $t('请输入密码'),
    }
  },
  {
    type: 'text',
    label: '2FA',
    name: 'platformEfa',
    value: data.platformEfa,
    props: {
      placeholder: $t('请输入 2FA 密钥'),
    }
  }
]

watch(() => realTheme.value, () => {
  formRef.value?.setInputsProps({
    platformUrl: {
      darkMode: realTheme.value === 'dark',
    }
  })
})

onBeforeMount(() => {
  getPlatformOptions()
})

async function getPlatformOptions() {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
  original.value = deepClone(data)
  formRef.value?.setInputsProps({
    platformUrl: {
      options: rows.map(item => ({
        image: item.platformIcon,
        darkImage: item.platformIconDark,
        label: item.platformUrl,
        value: item.platformUrl,
      }))
    }
  })
}

function addRemark(platformRemarks: string) {
  Reflect.set(original.value, 'platformRemarks', platformRemarks)
}

function onSave(more: boolean) {
  needMore.value = more
  formRef.value?.submit()
}

async function onFormSubmit({ intelligent, ...values }: Record<string, any>) {
  const formData = { ...original.value, ...values }
  loading.value = true
  await onConfirm?.(formData)
  loading.value = false
  formRef.value?.reset()
  if (!needMore.value) {
    emit('close')
  }
}
</script>

<template>
  <div class="flex flex-col h-full pt-4 px-4 content">
    <TsForm ref="tsform" id="account" :validate-on-value-update="false" validate-on-blur :inputs="inputs" @submit="onFormSubmit"></TsForm>
    <div class="flex flex-1 items-end">
      <div class="w-full flex justify-end gap-3 pt-4 pb-5">
        <RemarkIcon v-if="showRemark" class="ma-auto ml-0" mode="button" :title="$t('请为账号添加备注')" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RxButton v-if="!data.id && showCreateMore" :label="$t('保存 & 继续添加')" severity="secondary" outlined :loading="loading" @click="onSave(true)" />
        <RxButton :label="$t('保存')" :loading="loading" @click="onSave(false)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  min-width: 384px;
}
</style>
