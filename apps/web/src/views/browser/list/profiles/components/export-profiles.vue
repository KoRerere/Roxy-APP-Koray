<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'

import { useToast } from 'primevue/usetoast'
import { downloadTemplate } from '/@/views/browser/create/utils'
import { isDev } from '/@/utils'

type Data = UnwrapRowType<UserGetWindowInfoV2ListData>

const dialogRef = inject<any>('dialogRef')
const toast = useToast()

const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()
const limit = 5
const description = ref()
const exportType = ref(true)
const excelSchema = [
  {
    key: 'windowName',
    name: $t('窗口名称'),
  },
  {
    key: 'os',
    name: $t('操作系统'),
    getText: (item: Data) => item.os === 'IOS' ? 'iOS' : item.os, // 历史原因ios特殊处理
  },
  ...(isDev
    ? [
        {
          key: 'coreType',
          name: $t('浏览器内核'),
        },
        {
          key: 'coreVersion',
          name: $t('内核版本'),
        },
      ]
    : []),
  {
    key: 'osVersion',
    name: $t('系统版本'),
  },
  {
    key: 'proxyCategory',
    name: $t('代理 IP 类型'),
    getText: (item: Data) => item.proxyCategory === 'noproxy' ? '直连' : item.proxyCategory?.toLocaleUpperCase(),
  },
  {
    key: 'proxyInfo',
    name: $t('代理 IP 信息'),
    getText: (item: Data) => {
      if (!item.host)
        return ''
      const ipType = item.ipType!.toLocaleLowerCase() === 'ipv4' ? '' : 'ipv6:'
      const proxyAccount = item.proxyUserName ? `:${item.proxyUserName}:${item.proxyPassword}` : ''
      const refreshUrl = item.refreshUrl ? `[${item.refreshUrl}]` : ''
      return `${ipType}${item.host}:${item.port}${proxyAccount}${refreshUrl}`
    },
  },
  {
    key: 'windowPlatformList',
    name: $t('平台账号'),
    getText: (item: Data) => {
      const data = item.windowPlatformList?.map(it => [it.platformUrl, it.platformUserName, it.platformPassword, it.platformEfa].filter(Boolean).join(':'))
      return exportType.value ? JSON.stringify(data, null, 2) : JSON.stringify(data)// 导出 txt 不能换行
    },
  },
  {
    key: 'defaultOpenUrl',
    name: $t('自定义打开 URL'),
    getText: (item: Data) => JSON.stringify(item.defaultOpenUrl || '[]'),
  },
  {
    key: 'cookie',
    name: 'Cookie',
    getText: (item: Data) => {
      const value = item.cookie ? JSON.stringify(item.cookie) : ''
      if (exportType.value && value.length >= 32767) {
        const message = $t('[{name}] 的 cookies 长度超过 Excel 文档限制，请使用 txt 格式进行导出。', { name: `${_props.value.workspaceName}-${item.windowSortNum}` })
        toast.add({ severity: 'warn', summary: $t('操作失败'), detail: message, life: 5000 })
        throw new Error(message)
      }
      return value
    },
  },
  {
    key: 'windowRemark',
    name: $t('备注'),
  },
  {
    key: 'userAgent',
    name: 'User-Agent',
  },
  {
    key: 'searchEngine',
    name: $t('搜索引擎'),
  },
  {
    key: 'dirId',
    name: $t('窗口 ID'),
  },
].map((item, _index) => ({ ...item, _index }))
const selection = ref(excelSchema.slice(0, -1))

async function getExportData() {
  const ids = _props.value.data.map((item: any) => item.id)
  const { data: { rows } } = await API.window.userGetWindowInfoV2List({ windowIds: ids.join(','), isDelete: 0, page_index: 1, page_size: ids.length })
  return rows.map((item) => {
    const sortArr = selection.value.sort((a, b) => a._index - b._index)
    return sortArr.reduce((acc, schema) => {
      if (acc[schema.key]) {
        return acc
      }
      acc[schema.key] = schema.getText?.(item) ?? item[schema.key as keyof typeof item] ?? ''
      return acc
    }, {} as Record<string, any>)
  })
}

async function exportExcel() {
  const data = await getExportData()
  const hasDirId = data.some((item: any) => item.dirId)

  downloadTemplate({
    afterAddColumns: (columns) => {
      return !hasDirId ? columns : [...columns, { header: $t('窗口 ID (仅导出用)'), key: 'dirId' }]
    },
    afterAddExplain: (worksheet) => {
      worksheet.addRows(data)// 批量添加数据行
    },
  })
}

async function exportText() {
  const data = await getExportData()
  const textData = data.map((cell) => {
    return Object.entries(cell).map(([key, value]) => `${key}=${value}`).join('\n')
  }).join(`\n\n${'#'.repeat(40)}\n\n`)
  const blob = new Blob([textData], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `rx_profiles_${format(new Date(), 'yyyy-MM-dd HH_mm_ss')}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

async function confirm() {
  try {
    exportType.value
      ? await exportExcel()
      : await exportText()
    close()
  }
  catch (error) {
    console.warn(error)
  }
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
  description.value = props.data.slice(0, limit).map((item: any) => `${_props.value.workspaceName}-${item.windowSortNum}`).join(', ') + (props.data.length > limit ? `, ...(${props.data.length - limit} more)` : '')
})
</script>

<template>
  <div class="flex flex-col popup">
    <div class="flex flex-col popup-content">
      <div class="flex flex-col popup-block">
        <div class="popup-block__title">
          {{ $t('要导出的窗口:') }}
        </div>
        <div class="popup-block__description">
          {{ description }}
        </div>
      </div>
      <div class="flex flex-col popup-block">
        <div class="popup-block__title">
          {{ $t('请选择您的文件格式:') }}
        </div>
        <RxInputRadio v-model="exportType" size="xs" name="proxySwitch" :options="[{ label: 'Excel (.xls)', value: true }, { label: 'Text (.txt)', value: false }]" />
        <div class="popup-block__tip">
          {{ $t('*对于具有大量 cookie 的窗口，请选择 .txt 格式') }}
        </div>
      </div>
      <div class="h-80 flex flex-col popup-block">
        <div class="popup-block__title">
          {{ $t('请选择您要导出的数据:') }}
        </div>
        <div class="flex-ovh-1 table-container">
          <RyTable v-model:selection="selection" data-key="key" :columns="[{ title: 'All', key: 'name' }]" :data-list="excelSchema" :show-table-header="false" :show-actions="false" :paginator="false"
                   :multiple-operation="false" selection-mode="multiple" size="small"
          />
        </div>
      </div>
    </div>
    <div class="footer">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" @click.stop="close" />
      <RxButton size="sm" :label="$t('导出数据')" @click.stop="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 400px;
  padding-top: 1.25rem;

  &-content {
    padding-bottom: 1.25rem;
    gap: var(--spacing-4xl, 24px);
  }

  &-block {
    gap: var(--spacing-lg, 8px);

    &__title {
      color: var(--colors-text-text-primary, #fafafa);
      font-family: Inter;
      font-size: 14px;
      font-weight: 600;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &__description {
      color: var(--colors-text-text-tertiary, #575d60);
      font-family: Inter;
      font-size: 13px;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &__tip {
      color: var(--colors-text-text-tertiary, #575d60);
      font-family: Inter;
      font-size: 12px;
      line-height: 16px;
    }
  }
}

.table-container {
  border-radius: 6px;
  border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
  background: var(--colors-background-bg-action, #fff);
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
