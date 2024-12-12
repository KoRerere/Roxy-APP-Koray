<script setup lang="ts">
import ExcelJS from 'exceljs';
import { ExcelAccept } from '/@/utils/constants';
import { useConfirm } from 'primevue/useconfirm'
import { $t } from '/@/locales';
import { format } from 'date-fns'
import { columns, downloadTemplate } from '../browser/create/utils';

const confirm = useConfirm()

const randomString = () => Math.random().toString(36).slice(6);
const datas = Array.from({ length: Math.floor(Math.random() * 100) + 10 }, () => ({
  windowName: '窗口名称11' + randomString(),
  windowPlatformList: '窗口账号平台列表' + randomString(),
  os: '系统' + randomString(),
  osVersion: '系统版本' + randomString(),
  efa: '2fa' + randomString(),
  cookie: 'cookie 666' + randomString(),
  defaultOpenUrl: '自定义打开 URL' + randomString(),
  proxyMethod: '代理类型' + randomString(),
  proxyInfo: '代理信息' + randomString(),
  refreshUrl: '刷新URL' + randomString(),
  windowRemark: '窗口备注' + randomString(),
  userAgent: 'userAgent' + randomString(),
  windowSize:  '窗口尺寸' + randomString(),
}))

async function download() {
  downloadTemplate({
    afterAddExplain(worksheet) {
      worksheet.addRows(datas);//批量添加数据行
    },
  })
}

async function parse() {
  try {
    const result: any = []
    const workbook = new ExcelJS.Workbook();
    const file = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'Excel Files',
          accept: ExcelAccept,
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    }).then((handleFile: FileSystemFileHandle[]) => handleFile[0].getFile())

    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.eachSheet((worksheet, sheetId) => {
      worksheet.eachRow((row, rowIndex) => {
        console.log("🚀 ~ worksheet.eachRow ~ rowIndex:", rowIndex)
        if (rowIndex >= 5) {
          const data = Object.fromEntries(columns.map((column, index) => [column.key, (row.values as ExcelJS.CellValue[])[index + 1]]))//excel 索引从1开始
          result.push(data)
        }
      });
    });
    return result
  } catch (error) {
    console.log(error)
  }
}

async function dialog() {
  confirm.require({
    group: 'deleteConfirmDialog',
    header: $t('离开空间'),
    message: $t('您确认要离开该空间吗？离开后将无法查看该空间内的任何内容'),
    checkProps: {
      label: 'label',
      value: false,
    },
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {

    },
  } as any)
}
</script>

<template>
  <div class="flex justify-end gap-5">
    <RxButton label="弹窗" @click="dialog" />
    <RxButton label="下载" @click="download" />
    <RxButton label="解析" @click="parse" />
  </div>
</template>
