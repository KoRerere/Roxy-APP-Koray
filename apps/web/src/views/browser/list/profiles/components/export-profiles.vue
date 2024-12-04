<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { utils, writeFile } from 'xlsx'
import { API } from '/@/api'
import { strConcat } from '/@/utils'
import { $t } from '/@/locales'
import { useToast } from 'primevue/usetoast'

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
    name: '窗口名称',
  },
  {
    key: 'platformUrl',
    name: '账号平台',
    getText: (item: Data) => platformFormat(item, 'platformUrl'),
  },
  {
    key: 'platformUserName',
    name: '用户名',
    getText: (item: Data) => platformFormat(item, 'platformUserName'),
  },
  {
    key: 'platformPassword',
    name: '密码',
    getText: (item: Data) => platformFormat(item, 'platformPassword'),
  },
  {
    key: 'platformEfa',
    name: '2FA秘钥',
    getText: (item: Data) => platformFormat(item, 'platformEfa'),
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
    name: '打开指定网址',
    getText: (item: Data) => item.defaultOpenUrl ? item.defaultOpenUrl.join('; ') : '',
  },
  {
    key: 'proxyCategory',
    name: '代理类型',
  },
  {
    key: 'proxyInfo',
    name: '代理信息',
    getText: (item: Data) => {
      const ipType = item.ipType!.toLocaleLowerCase() === 'ipv4' ? '' : 'ipv6:'
      return `${ipType}${item.host}:${item.port}${strConcat(':', item.proxyUserName as string)}${strConcat(':', item.proxyPassword as string)}`
    },
  },
  {
    key: 'refreshUrl',
    name: '刷新URL',
  },
  {
    key: 'windowRemark',
    name: '窗口备注',
  },
  {
    key: 'userAgent',
    name: 'User Agent',
  },
  {
    key: 'windowSize',
    name: '窗口尺寸',
    getText: (item: Data) => `${item.openWidth}*${item.openHeight}`,
  },
].map((item, _index) => ({ ...item, _index }))
const selection = ref(excelSchema.slice())

function platformFormat(data: Data, key: string) {
  return data.windowPlatformList!.map((item, index: number) => `(${index + 1})${item[key as keyof typeof item] || '--'}`).join('; ')
}

async function getExportData() {
  const ids = _props.value.data.map((item: any) => item.id)
  const { data: { rows } } = await API.window.userGetWindowInfoV2List({ windowIds: ids.join(','), isDelete: 0, page_index: 1, page_size: ids.length })
  return rows.map(data => selection.value.sort((a, b) => a._index - b._index).map(schema => [schema.name, schema.getText?.(data) || data[schema.key as keyof typeof data]]))
}

async function exportExcel() {
  const data = await getExportData()
  const excelData = [
    selection.value.map(item => item.name),
    ...data.map(row => row.map(cell => cell[1])),
  ]

  const workbook = utils.book_new()
  const worksheet = utils.aoa_to_sheet(excelData)

  worksheet['!cols'] = Array.from({ length: excelData[0].length }, () => ({ wch: 30 }))
  worksheet['!rows'] = Array.from({ length: excelData.length }, () => ({ hpx: 40 }))

  utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  const filename = `rx_profiles_${format(new Date(), 'yyyy-MM-dd HH_mm_ss')}.xlsx`
  writeFile(workbook, filename) // 保存文件
}

async function exportText() {
  const data = await getExportData()
  const textData = data.map(row => row.map(cell => cell.join('=')).join('\n')).join('\n\n\n\n')
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
          Profiles to export:
        </div>
        <div class="popup-block__description">
          {{ description }}
        </div>
      </div>
      <div class="flex flex-col popup-block">
        <div class="popup-block__title">
          Select your file format:
        </div>
        <RxInputRadio v-model="exportType" size="xs" name="proxySwitch" :options="[{ label: 'Excel (.xls)', value: true }, { label: 'Text (.txt)', value: false }]" />
        <div class="popup-block__tip">
          * For profiles with large cookies, please choose .txt format.
        </div>
      </div>
      <div class="h-80 flex flex-col popup-block">
        <div class="popup-block__title">
          Select datas you want to export:
        </div>
        <div class="flex-ovh-1 table-container">
          <RyTable v-model:selection="selection" data-key="key" :columns="[{ title: 'All', key: 'name' }]" :data-list="excelSchema" :show-table-header="false" :show-actions="false" :paginator="false"
            :multiple-operation="false" selection-mode="multiple" size="small" />
        </div>
      </div>
    </div>
    <div class="footer">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" @click="close" />
      <RxButton size="sm" :label="$t('导出数据')" severity="info" @click="confirm" />
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
