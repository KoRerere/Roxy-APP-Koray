<script setup lang="tsx">
import TsForm from '/@/views/lab/components/form/index.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales';

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

const inputs = [
  {
    type: 'select',
    name: 'format',
    label: $t('代理格式:'),
    value: {
      value: 'host_:_port_:_username_:_password',
      label: $t('主机:端口:用户名:密码'),
    },
    props: {
      options: [
        {
          value: 'host_:_port_:_username_:_password',
          label: $t('主机:端口:用户名:密码'),
        },
        {
          value: 'username_:_password_@_host_:_port',
          label: $t('账号:密码{separator}主机:端口', { separator: '@' }),
        }
      ]
    },
    afterRender: () => <div class="flex items-center gap-1">
      <RxSvgIcon name="base/rx_ic_info" size="12" color="var(--colors-icon-icon-note)" />
      <span class={styles.tips}>{$t('代理支持 HTTP 和 SOCKS5 协议')}</span>
    </div>
  },
  {
    type: 'select',
    name: 'fileType',
    label: $t('文件格式:'),
    value: { icon: 'base/rx_ic_file_csv', label: 'Excel file (*.csv)', value: 'csv' },
    props: {
      iconColor: "var(--colors-icon-icon-success)",
      options: [
        { icon: 'base/rx_ic_file_csv', label: 'Excel file (*.csv)', value: 'csv' },
        { icon: 'base/rx_ic_file_txt', label: 'Text file (*.txt)', value: 'txt' },
      ],
    },
  }
]

function formatParse(data: any, formatTemplate: string, separator?: string) {
  return formatTemplate
    .replace(/([a-zA-Z]+)(?=_|$)/g, (match, key) => data[key] !== undefined ? data[key] : match)
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
      <span class="header">{{ $t('下载选中的代理信息') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="onClose" />
    </div>
    <TsForm id="download" :inputs="inputs" @submit="onSubmit" />
    <RxButton type="submit" form="download" :loading="loading" :label="$t('下载')"></RxButton>
  </div>
</template>

<style lang="scss" module>
.tips {
  color: var(--colors-text-text-tertiary, #575D60);
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

.description {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
}

.subtitle {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.help {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);

  &-item {
    border-color: transparent;
    background: var(--colors-background-bg-block);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 18px;
  }
}

.tips {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}
</style>
