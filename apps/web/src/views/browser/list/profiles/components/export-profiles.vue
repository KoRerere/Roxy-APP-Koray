<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'
import { strConcat } from '/@/utils'
import { $t } from '/@/locales'
import { useToast } from 'primevue/usetoast'
import { downloadTemplate } from '/@/views/browser/create/utils'

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
    getText: (item: Data) => item.os === 'IOS' ? 'iOS' : item.os// 历史原因ios特殊处理
  },
  {
    key: 'osVersion',
    name: $t('系统版本'),
    getText: (item: Data) => item.osVersion?.toUpperCase()
  },
  {
    key: 'userAgent',
    name: 'User-Agent',
  },
  {
    key: 'platformUrl',
    name: $t('平台账号'),
    mergeKey: 'windowPlatformList',
  },
  {
    key: 'platformUserName',
    name: $t('用户名'),
    mergeKey: 'windowPlatformList',
  },
  {
    key: 'platformPassword',
    name: $t('密码'),
    mergeKey: 'windowPlatformList',
  },
  {
    key: 'platformEfa',
    name: '2FA',
    mergeKey: 'windowPlatformList',
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
    key: 'defaultOpenUrl',
    name: $t('自定义打开 URL'),
    getText: (item: Data) => JSON.stringify(item.defaultOpenUrl || '[]')
  },
  {
    key: 'proxyCategory',
    name: $t('代理类型'),
    getText: (item: Data) => item.proxyCategory === 'noproxy' ? '直连' : item.proxyCategory,
  },
  {
    key: 'proxyInfo',
    name: $t('代理信息'),
    getText: (item: Data) => {
      const ipType = item.ipType!.toLocaleLowerCase() === 'ipv4' ? '' : 'ipv6:'

      if (!item.host) {
        return ''
      }

      return `${ipType}${item.host}:${item.port}${strConcat(':', item.proxyUserName as string)}${strConcat(':', item.proxyPassword as string)}`
    },
  },
  {
    key: 'windowRemark',
    name: $t('备注'),
  },
  {
    key: 'searchEngine',
    name: $t('搜索引擎'),
  },
  // {
  //   key: 'windowSize',
  //   name: $t('窗口大小'),
  //   getText: (item: Data) => `${item.openWidth}*${item.openHeight}`,
  // },
].map((item, _index) => ({ ...item, _index }))
const selection = ref(excelSchema.slice())

async function getExportData() {
  const ids = _props.value.data.map((item: any) => item.id)
  const { data: { rows } } = await API.window.userGetWindowInfoV2List({ windowIds: ids.join(','), isDelete: 0, page_index: 1, page_size: ids.length })
  return rows.map(item => {
    const sortArr = selection.value.sort((a, b) => a._index - b._index)
    return sortArr.reduce((acc, schema) => {

      if (acc[schema.key] || acc[schema.mergeKey!]) {
        return acc
      }

      if (schema.mergeKey) {
        const mergeKeyItems = sortArr.filter(s => s.mergeKey === schema.mergeKey)
        const datalist = (item[schema.mergeKey as keyof typeof item] as any[])?.map((platform: any) =>
          mergeKeyItems.reduce((acc, schema) => {
            acc[schema.key] = schema.getText?.({ ...item, ...platform }) || platform[schema.key]
            return acc
          }, {} as Record<string, any>))

        acc[schema.mergeKey] = JSON.stringify(datalist || [])
      } else {
        acc[schema.key] = schema.getText?.(item) ?? item[schema.key as keyof typeof item] ?? ''
      }
      return acc
    }, {} as Record<string, any>)
  })
}

async function exportExcel() {
  const data = await getExportData()

  downloadTemplate({
    afterAddExplain(worksheet) {
      worksheet.addRows(data);//批量添加数据行
    },
  })
}

async function exportText() {
  const data = await getExportData()
  const textData = data.map(cell => {
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
            :multiple-operation="false" selection-mode="multiple" size="small" />
        </div>
      </div>
    </div>
    <div class="footer">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" @click.stop="close" />
      <RxButton size="sm" :label="$t('导出数据')" severity="info" @click.stop="confirm" />
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
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 14px;
      font-weight: 600;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &__description {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: Inter;
      font-size: 13px;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &__tip {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: Inter;
      font-size: 12px;
      line-height: 16px;
    }
  }
}

.table-container {
  border-radius: 6px;
  border: 0.5px solid var(--Colors-Border-border-container, #C7CDD1);
  background: var(--Component-Colors-TextInput-bg-bg, #FFF);
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
