<script lang="ts" setup>
import { format } from 'date-fns'
import { utils, writeFileXLSX } from 'xlsx'
import { excelMap } from '/@/views/browser/create/utils'

const keys = Object.keys(excelMap)
const values = Object.values(excelMap)

function exportData() {
  // 示例数据
  const data = [
    keys,
    values,
  ]

  const workbook = utils.book_new()
  const worksheet = utils.aoa_to_sheet(data)

  worksheet['!cols'] = Array.from({ length: keys.length }, () => ({ wch: 30 }))
  worksheet['!rows'] = Array.from({ length: keys.length }, () => ({ hpx: 20 }))

  utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  const filename = `RoxyBrowser_${format(new Date(), 'yyyy-MM-dd HH_mm_ss')}.xlsx`
  writeFileXLSX(workbook, filename) // 保存文件
}
</script>

<template>
  <div class="w-80">
    <RxButton label="export data" @click="exportData" />
  </div>
</template>
