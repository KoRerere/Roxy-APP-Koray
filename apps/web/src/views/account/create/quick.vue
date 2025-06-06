<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue';
import RemarkIcon from '/@/components/remark-icon'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { deepClone } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'
import { usePlatformForm } from '/@/views/account/create/hook'

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

const { getInputs, original } = usePlatformForm()

// const cache = SimpleCache.getInstance()
const platformRow = ref<any[]>([])
const themeStore = useThemeStore()

const inputs = getInputs(data)
const needMore = ref(false)
const loading = ref(false)
const formRef = useTemplateRef<any>('tsform')

watch(() => themeStore.realTheme, () => {
  updatePlatformOptions(platformRow.value)
})

onBeforeMount(async () => {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
  platformRow.value = rows
  original.value = deepClone(data)
  updatePlatformOptions(platformRow.value)
})

function updatePlatformOptions(data: any[]) {
  formRef.value?.setInputsProps({
    platformUrl: {
      options: data.map(item => ({
        image: themeStore.realTheme === 'dark' ? item.platformIconDark : item.platformIcon,
        platformIconDark: item.platformIconDark,
        platformIcon: item.platformIcon,
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

async function onFormSubmit(values: Record<string, any>) {
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
    <TsForm ref="tsform" id="account" :inputs="inputs" @submit="onFormSubmit"></TsForm>
    <div class="flex flex-1 items-end">
      <div class="w-full flex justify-end gap-3 pt-4 pb-5">
        <RemarkIcon v-if="showRemark" class="ma-auto ml-0" mode="button" :title="$t('请为账号添加备注')" :value="original?.platformRemarks" :on-confirm="addRemark" />
        <RxButton v-if="!data.id && showCreateMore" size="sm" :label="$t('保存 & 继续添加')" severity="secondary" outlined :loading="loading" @click="onSave(true)" />
        <RxButton size="sm" :label="$t('保存')" :loading="loading" @click="onSave(false)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  min-width: 384px;
}
</style>
