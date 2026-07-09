<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue'
import { API } from '/@/api'
import { deepClone } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'

const { onNext } = defineProps<{
  onNext: (type: 'proxy') => void
  onClose: () => void
}>()

const { realTheme } = storeToRefs(useThemeStore())

const platformData = defineModel<Record<string, any>>()

const formRef = useTemplateRef('tsform')
const original = ref()

const inputs = [
  {
    type: 'select',
    label: $t('所属平台'),
    name: 'platformUrl',
    value: platformData.value?.platformUrl,
    props: {
      placeholder: $t('请输入或选择平台网址'),
      size: 'lg',
      optionValue: 'value',
      editable: true,
      filter: true,
      darkMode: realTheme.value === 'dark',
      onChange: ({ value, props }: any) => {
        const platform = props.options.find((item: any) => item.value === value)
        Reflect.set(original.value, 'platformIcon', platform?.image || '')
        Reflect.set(original.value, 'platformIconDark', platform?.darkImage || '')
      },
    },
    resolver: (zod: any) => zod.string().url($t('请输入正确的平台网址')),
  },
  {
    type: 'text',
    label: $t('登录账号'),
    name: 'platformUserName',
    value: platformData.value?.platformUserName,
    props: {
      placeholder: $t('请输入账号'),
      size: 'lg',
    },
  },
  {
    type: 'password',
    label: $t('登录密码'),
    name: 'platformPassword',
    value: platformData.value?.platformPassword,
    props: {
      placeholder: $t('请输入密码'),
      size: 'lg',
    },
  },
  {
    type: 'text',
    label: '2FA',
    name: 'platformEfa',
    value: platformData.value?.platformEfa,
    props: {
      placeholder: $t('请输入 2FA 密钥'),
      size: 'lg',
    },
  },
]

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
  original.value = deepClone(platformData)
  formRef.value?.setInputsProps({
    platformUrl: {
      options: rows.map(item => ({
        image: item.platformIcon,
        darkImage: item.platformIconDark,
        label: item.platformUrl,
        value: item.platformUrl,
      })),
    },
  })
}

async function onFormSubmit({ intelligent: _, platformUserName, platformPassword, ...values }: Record<string, any>) {
  const formData = {
    ...original.value,
    platformUserName: platformUserName?.trim(),
    platformPassword: platformPassword?.trim(),
    ...values,
  }

  platformData.value = formData
  onNext('proxy')
}
</script>

<template>
  <div class="flex flex-col justify-center h-full min-w-96 gap-8">
    <TsForm id="platform" ref="tsform" :validate-on-value-update="false" validate-on-blur :inputs="inputs" @submit="onFormSubmit" />
    <div class="flex justify-end">
      <RxButton :label="$t('确认添加')" form="platform" type="submit" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
