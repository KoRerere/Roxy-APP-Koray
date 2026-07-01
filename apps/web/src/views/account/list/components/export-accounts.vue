<script setup lang="ts">
import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { formatAccountCopyText, parseWindowInfo } from '../utils'

const dialogRef = inject<any>('dialogRef')

const exportType = ref(true)
const _props = ref<{ data?: any[], workspaceName?: string, canViewPassword?: boolean }>({})

onMounted(() => {
  _props.value = dialogRef?.value?.data?.props ?? {}
})

function getExcelSchema() {
  const schema: Array<{ key: string, name: string, getText?: (item: any) => string }> = [
    { key: 'platformUrl', name: $t('平台') },
    { key: 'platformUserName', name: $t('账号') },
  ]
  if (_props.value.canViewPassword)
    schema.push({ key: 'platformPassword', name: $t('密码') })
  schema.push(
    { key: 'platformEfa', name: '2FA' },
    // { key: 'platformEmail', name: $t('关联邮箱') },
    { key: 'platformRemarks', name: $t('备注') },
    {
      key: 'window_info',
      name: $t('已关联窗口'),
      getText: (item: any) => {
        const ids = parseWindowInfo(item.window_info)
        return ids.map((id: number) => `${_props.value.workspaceName}-${id}`).join(', ')
      },
    },
  )
  return schema
}

function getExportRows() {
  const excelSchema = getExcelSchema()
  return (_props.value.data ?? []).map((item) => {
    return excelSchema.reduce((acc, schema) => {
      acc[schema.key] = schema.getText?.(item) ?? item[schema.key] ?? ''
      return acc
    }, {} as Record<string, string>)
  })
}

async function exportExcel() {
  const excelSchema = getExcelSchema()
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Accounts')
  worksheet.columns = excelSchema.map(({ key, name }) => ({
    key,
    header: name,
    width: 24,
  }))
  worksheet.addRows(getExportRows())
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `accounts_${format(new Date(), 'yyyy-MM-dd HH_mm_ss')}.xlsx`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function exportTxt() {
  const rows = (_props.value.data ?? []).map((item) => {
    return formatAccountCopyText(item, _props.value.canViewPassword)
  })
  const blob = new Blob([rows.join('\n')], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `accounts_${format(new Date(), 'yyyy-MM-dd HH_mm_ss')}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function onConfirm() {
  if (exportType.value)
    await exportExcel()
  else
    await exportTxt()
  dialogRef?.value?.close()
}
</script>

<template>
  <div class="flex flex-col gap-5 pt-6 export-accounts">
    <div class="flex justify-between items-center">
      <span class="title">{{ $t('导出数据') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="dialogRef?.close()" />
    </div>
    <div class="desc">
      {{ $t('请选择您要导出的数据:') }}
    </div>
    <RxInputRadio v-model="exportType" :options="[
      { label: 'Excel (.xlsx)', value: true },
      { label: 'Text (.txt)', value: false },
    ]"
    />
    <div class="flex justify-end gap-2">
      <RxButton severity="secondary" outlined :label="$t('取消')" @click="dialogRef?.close()" />
      <RxButton :label="$t('导出数据')" @click="onConfirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.export-accounts {
  width: 480px;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: 20px;
}
</style>
