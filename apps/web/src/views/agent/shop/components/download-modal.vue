<script setup lang="tsx">
import TsForm from '/@/views/lab/components/form/index.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useProxyShopLabels } from '../utils/proxy-shop-labels'

interface Props {
  data: {
    host?: string
    port?: string
    username?: string
    password?: string
  }[]
  onConfirm?: (formData: any) => Promise<void> | void
}

const { data, onConfirm } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const styles = useCssModule()
const loading = ref(false)
const shopLabels = useProxyShopLabels()

const inputs = computed(() => [
  {
    type: 'select',
    name: 'format',
    label: shopLabels.value.downloadFormatLabel,
    value: {
      value: 'host_:_port_:_username_:_password',
      label: $t('代理 IP 主机:代理 IP 端口:代理 IP 用户名:代理 IP 密码'),
    },
    props: {
      options: [
        {
          value: 'host_:_port_:_username_:_password',
          label: $t('代理 IP 主机:代理 IP 端口:代理 IP 用户名:代理 IP 密码'),
        },
        {
          value: 'username_:_password_@_host_:_port',
          label: $t('代理 IP 用户名:代理 IP 密码{separator}代理 IP 主机:代理 IP 端口', { separator: '@' }),
        },
      ],
    },
    afterRender: () => (
      <div class="flex items-center gap-1">
        <RxSvgIcon name="base/rx_ic_info" size="12" color="var(--colors-icon-icon-note)" />
        <span class={styles.tips}>{shopLabels.value.downloadProtocolTip}</span>
      </div>
    ),
  },
  {
    type: 'select',
    name: 'fileType',
    label: $t('文件格式:'),
    value: { icon: 'base/rx_ic_file_csv', label: 'Excel file (*.csv)', value: 'csv' },
    props: {
      iconColor: 'var(--colors-icon-icon-success)',
      options: [
        { icon: 'base/rx_ic_file_csv', label: 'Excel file (*.csv)', value: 'csv' },
        { icon: 'base/rx_ic_file_txt', label: 'Text file (*.txt)', value: 'txt' },
      ],
    },
  },
])

function formatParse(data: any, formatTemplate: string, separator?: string) {
  return formatTemplate
    .replace(/([a-z]+)(?=_|$)/gi, (match, key) => data[key] !== undefined ? data[key] : match)
    .replace(/_([:@])_/g, (_, key) => !separator ? key : `${separator}${key}${separator}`)
}

function onClose() {
  emit('close')
}

async function onSubmit(formData: any) {
  const { format, fileType } = formData
  loading.value = true
  await onConfirm?.({
    data: data.map(item => formatParse(item, format.value)),
    fileType: fileType.value,
  })
  loading.value = false
  emit('close')
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 rounded-lg w-120">
    <div class="h-9 flex items-center justify-between">
      <span class="header">{{ shopLabels.downloadSelectedTitle }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="onClose" />
    </div>
    <TsForm id="download" :inputs="inputs" @submit="onSubmit" />
    <RxButton type="submit" form="download" :loading="loading" :label="$t('下载')" />
  </div>
</template>

<style lang="scss" module>
.tips {
  color: var(--colors-text-text-tertiary, #575d60);
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}
</style>
