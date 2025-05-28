<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue';
import RemarkIcon from '/@/components/remark-icon'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { deepClone, validateURL } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'

interface Props {
  data?: Record<string, any>
  showRemark?: boolean
  showCreateMore?: boolean
}

const {
  data = {},
  showRemark = true,
  showCreateMore = true
} = defineProps<Props>()

const emit = defineEmits(['confirm', 'close'])

// const cache = SimpleCache.getInstance()
const platformRow = ref<any[]>([])
const themeStore = useThemeStore()

const inputs = reactive([
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
      options: [],
      onChange: ({ value, props }: any) => {
        const platform = props.options.find((item: any) => item.value === value)
        Reflect.set(original.value, 'platformIcon', platform?.platformIcon || "")
        Reflect.set(original.value, 'platformIconDark', platform?.platformIconDark || "")
      }
    },
    resolver: (zod: any) => zod.string().refine(validateURL, $t('请输入正确的平台网址'))
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
])
const original = ref(deepClone(data))
const needMore = ref(false)
const formRef = useTemplateRef<any>('tsform')

function addRemark(platformRemarks: string) {
  Reflect.set(original.value, 'platformRemarks', platformRemarks)
}

function onConfirm(more: boolean) {
  needMore.value = more
  formRef.value?.submit()
}

function onFormSubmit(values: Record<string, any>) {
  const formData = { ...original.value, ...values }
  if (!needMore.value) {
    emit('close')
  }
  formRef.value?.reset()
  emit('confirm', formData)
}

watch(() => themeStore.realTheme, () => {
  formRef.value?.setInputsProps({
    platformUrl: {
      options: platformRow.value.map(item => ({
        image: themeStore.realTheme === 'dark' ? item.platformIconDark : item.platformIcon,
        platformIconDark: item.platformIconDark,
        platformIcon: item.platformIcon,
        label: item.platformUrl,
        value: item.platformUrl,
      }))
    }
  })
})

onMounted(async () => {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({});
  platformRow.value = rows;
  formRef.value?.setInputsProps({
    platformUrl: {
      options: rows.map(item => ({
        image: themeStore.realTheme === 'dark' ? item.platformIconDark : item.platformIcon,
        platformIconDark: item.platformIconDark,
        platformIcon: item.platformIcon,
        label: item.platformUrl,
        value: item.platformUrl,
      }))
    }
  })
})
</script>

<template>
  <div class="flex flex-col h-full pt-4 px-4 content">
    <TsForm ref="tsform" id="account" :inputs="inputs" @submit="onFormSubmit"></TsForm>
    <div class="flex flex-1 items-end">
      <div class="w-full flex justify-end gap-3 pt-4 pb-5">
        <RemarkIcon v-if="showRemark" class="ma-auto ml-0" mode="button" :title="$t('请为账号添加备注')" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RxButton v-if="!data.id && showCreateMore" size="sm" :label="$t('保存 & 继续添加')" severity="secondary" outlined @click="onConfirm(true)" />
        <RxButton size="sm" :label="$t('保存')" @click="onConfirm(false)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  min-width: 384px;
}
</style>
