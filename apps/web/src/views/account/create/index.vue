<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue';
import RemarkIcon from '/@/components/remark-icon'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { deepClone, validateURL } from '/@/utils'
// import { SimpleCache } from '/@/utils/cache'

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

const inputs = [
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
      getOptions: async () => {
        const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
        return rows.map(item => ({
          image: item.platformIcon,
          label: item.platformUrl,
          value: item.platformUrl,
        }))
      },
      onChange: ({ value, props }: any) => {
        const platformIcon = props.options.find((item: any) => item.value === value)?.image ?? ''
        Reflect.set(original.value, 'platformIcon', platformIcon)
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
]
const original = ref(deepClone(data))
const needMore = ref(false)
const formRef = useTemplateRef<any>('wcisman')

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
</script>

<template>
  <div class="flex flex-col h-full account-content">
    <TsForm ref="wcisman" id="account" :inputs="inputs" @submit="onFormSubmit"></TsForm>
    <div class="flex flex-1 items-end">
      <div class="w-full flex justify-end gap-3 button-group">
        <RemarkIcon v-if="showRemark" class="ma-auto ml-0" mode="button" :title="$t('请为账号添加备注')" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RxButton v-if="!data.id && showCreateMore" size="sm" :label="$t('保存 & 继续添加')" severity="secondary" outlined @click="onConfirm(true)" />
        <RxButton size="sm" :label="$t('保存')" @click="onConfirm(false)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-content {
  padding: 16px 16px 0;
  min-width: 384px;
}

.button-group {
  padding: 16px 0 20px;
}
</style>
