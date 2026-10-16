<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue'
import PlatformUrlFormField from '/@/views/account/create/components/platform-url-form-field.vue'
import { resolveAccountLoginLabels } from '/@/views/account/create/account-login-labels'
import { toPlatformSelectOptions } from '/@/views/account/create/components/platform-select'
import type { PlatformIconValue } from '/@/views/account/create/components/platform-select'
import { toPlatformAbbrOptions } from '/@/views/browser/create/window-name'
import type { PlatformAbbrOption } from '/@/views/browser/create/window-name'
import { API } from '/@/api'

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
  onConfirm,
} = defineProps<Props>()

const emit = defineEmits(['close'])

const { realTheme } = storeToRefs(useThemeStore())

const formRef = useTemplateRef('tsform')

/** 平台库缩写，用来把当前网址换成 FB / TK 这类登录字段标签 */
const platformAbbrCatalog = ref<PlatformAbbrOption[]>([])
const needMore = ref(false)
const loading = ref(false)
const original = ref()
/** 继续添加后重置表单时递增，让图标下拉回到初始账号的图标 */
const platformSyncKey = ref(0)
/** 图标不进表单字段，提交时用这里的值覆盖账号上的旧图标 */
const platformIcons = ref<PlatformIconValue>({
  platformIcon: data.platformIcon || '',
  platformIconDark: data.platformIconDark || '',
  fromUser: false,
})
const parseFormat = `${$t('账号')}:${$t('密码')}:2FA${showRemark ? `{${$t('备注')}}` : ''}`

/** 记录图标下拉当前值，保存时不再按网址重新匹配 */
function onPlatformIcons(icons: PlatformIconValue) {
  platformIcons.value = icons
}

/**
 * 按当前网址刷新账号、密码标签。
 * 网址还停在原账号上时沿用账号自带缩写；一旦改成别的平台，就按新网址重新匹配。
 */
function syncLoginLabels(platformUrl?: string) {
  const currentUrl = platformUrl ?? String(formRef.value?.getFieldState('platformUrl')?.value ?? data.platformUrl ?? '')
  const storedUrl = String(data.platformUrl ?? '')
  const labels = resolveAccountLoginLabels({
    platformUrl: currentUrl,
    platformAbbr: currentUrl === storedUrl ? data.platformAbbr : undefined,
  }, platformAbbrCatalog.value)
  formRef.value?.setInputsProps({
    platformUserName: { label: labels.account },
    platformPassword: { label: labels.password },
  })
}

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
        if (isEmptyValue(Object.values(result).filter(Boolean))) {
          return
        }

        const { username, password, twoFactor, /* linkedEmail, */ remark } = result
        formRef.value?.setValues({
          platformUserName: username ?? '',
          platformPassword: password ?? '',
          platformEfa: twoFactor ?? '',
          // platformEmail: linkedEmail ?? '',
          platformRemarks: remark ?? '',
          intelligent: '',
        })
      },
    },
    resolver: (zod: any) => zod
      .string()
      .refine((value: string) => {
        if (isEmptyValue(value)) {
          return true
        }
        return !isEmptyValue(Object.values(parseIntelligent(value)).filter(Boolean))
      }, { message: $t('解析错误,请检查格式：{text}', { text: parseFormat }) }),
  },
  {
    separator: true,
  },
  {
    label: $t('平台'),
    name: 'platformUrl',
    value: data.platformUrl,
    render: PlatformUrlFormField,
    props: {
      placeholder: $t('请输入或选择平台网址'),
      darkMode: realTheme.value === 'dark',
      icon: data.platformIcon || '',
      iconDark: data.platformIconDark || '',
      syncKey: platformSyncKey.value,
      options: [],
      onIcons: onPlatformIcons,
      onUrlChange: syncLoginLabels,
    },
    resolver: (zod: any) => zod.string().url($t('请输入正确的平台网址')),
  },
  // {
  //   type: 'text',
  //   label: $t('平台名'),
  //   name: 'platformName',
  //   value: data.platformName,
  //   props: {
  //     placeholder: $t('请输入平台名'),
  //   },
  // },
  {
    type: 'text',
    label: $t('平台登录账号'),
    name: 'platformUserName',
    value: data.platformUserName,
    props: {
      placeholder: $t('请输入账号'),
    },
  },
  {
    type: 'password',
    label: $t('平台登录密码'),
    name: 'platformPassword',
    value: data.platformPassword,
    props: {
      placeholder: $t('请输入密码'),
    },
  },
  {
    type: 'text',
    label: '2FA',
    name: 'platformEfa',
    value: data.platformEfa,
    props: {
      placeholder: $t('请输入 2FA 密钥'),
    },
  },
  // {
  //   type: 'text',
  //   label: $t('关联邮箱'),
  //   name: 'platformEmail',
  //   value: data.platformEmail,
  //   props: {
  //     placeholder: $t('请输入关联邮箱'),
  //   },
  // },
  {
    type: 'textarea',
    label: $t('备注'),
    name: 'platformRemarks',
    value: data.platformRemarks,
    visible: showRemark,
    props: {
      placeholder: $t('请输入备注'),
      rows: 3,
    },
  },
].filter(item => item.visible !== false)

watch(() => realTheme.value, () => {
  formRef.value?.setInputsProps({
    platformUrl: {
      darkMode: realTheme.value === 'dark',
    },
  })
})

onBeforeMount(() => {
  getPlatformOptions()
})

async function getPlatformOptions() {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
  platformAbbrCatalog.value = toPlatformAbbrOptions(rows)
  original.value = deepClone(data)
  formRef.value?.setInputsProps({
    platformUrl: {
      options: toPlatformSelectOptions(rows),
    },
  })
  syncLoginLabels()
}

function onSave(more: boolean) {
  needMore.value = more
  formRef.value?.submit()
}

async function onFormSubmit({ intelligent: _, platformUserName, platformPassword, ...values }: Record<string, any>) {
  const formData = {
    ...original.value,
    platformUserName: platformUserName?.trim(),
    platformPassword: platformPassword?.trim(),
    ...values,
    platformIcon: platformIcons.value.platformIcon,
    platformIconDark: platformIcons.value.platformIconDark,
  }
  loading.value = true
  await onConfirm?.(formData)
  loading.value = false
  formRef.value?.reset()
  platformIcons.value = {
    platformIcon: data.platformIcon || '',
    platformIconDark: data.platformIconDark || '',
    fromUser: false,
  }
  platformSyncKey.value += 1
  formRef.value?.setInputsProps({
    platformUrl: {
      icon: platformIcons.value.platformIcon,
      iconDark: platformIcons.value.platformIconDark,
      syncKey: platformSyncKey.value,
    },
  })
  syncLoginLabels(String(data.platformUrl ?? ''))
  if (!needMore.value) {
    emit('close')
  }
}
</script>

<template>
  <div class="flex flex-col h-full min-w-96 px-4 pt-4">
    <div class="flex-1 overflow-y-auto scrollbar">
      <TsForm id="account" ref="tsform" :validate-on-value-update="false" validate-on-blur :inputs="inputs" @submit="onFormSubmit" />
    </div>
    <div class="flex flex-row-reverse justify-between gap-3 pt-4 pb-5">
      <RxButton :label="$t('保存')" :loading="loading" @click="onSave(false)" />
      <RxButton v-if="!data.id && !data._tempId && showCreateMore" :label="$t('保存 & 继续添加')" severity="secondary" outlined :loading="loading" @click="onSave(true)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
