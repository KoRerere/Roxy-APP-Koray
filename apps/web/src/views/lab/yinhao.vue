<script setup lang="ts">
import ExcelJS from 'exceljs';
import { ExcelAccept } from '/@/utils/constants';
import { useConfirm } from 'primevue/useconfirm'
import { $t } from '/@/locales';
import { format } from 'date-fns'

const confirm = useConfirm()

const columns = [
  {
    header: '窗口名称',
    key: 'windowName',
    required: true,
    placeholder: '为浏览器窗口命名（必填项）',
    example: '举例:\nRoxytest'
  },
  {
    header: '系统',
    key: 'system',
    required: true,
    placeholder: '操作系统（必填项）\n如: Windows',
    example: '举例1: Windows\n举例2: macOS\n举例3: Android\n举例4: IOS'
  },
  {
    header: '系统版本',
    key: 'osVersion',
    width: 50,
    placeholder: '操作系统版本, 如: 11\n每行只能填写一个, 留空则自动使用对应操作系统最新版本',
    example: '举例1: Windows: 11、10、8、7\n举例2: macOS: ALL\n举例3: Android: 13、12、11、10、9\n举例4: IOS: 17.0、16.6、16.5、16.4、16.3、16.2、16.1、16.0、15.7、15.6、15.5、15.4、15.3、15.2、15.1、15.0、14.7、14.6、14.5、14.4、14.3、14.2、14.1、14.0'
  },
  {
    header: '代理类型',
    key: 'proxyCategory',
    placeholder: '代理类型, 如: SOCKS5, 留空则自动使用 "直连"',
    example: '举例1: 直连\n举例2: SOCKS5\n举例3: HTTP\n举例4: HTTPS\n举例5: SSH'
  },
  {
    header: '代理信息',
    key: 'proxyInfo',
    width: 70,
    placeholder: 'richText',
    example: '举例1: 192.168.0.1:8800\n举例2: 192.168.0.1:8800:roxytest:roxypass\n举例3: 192.168.0.1:8800:roxytest:roxypass[http://refresh.roxy.com]\n举例4: ipv6:192.168.0.1:8800:roxytest:roxypass',
    richText: [
      { 'text': '请务必按照此顺序格式填写:\n' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': '【代理主机:代理端口:代理用户名:代理密码[刷新URL]】\n' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': '其中 代理用户名、代理密码、[刷新URL] 为选填\n' },
      { 'text': '若网络协议为ipv6, 请在代理信息最前端添加 ipv6:' },
    ]
  },
  {
    header: '平台账号',
    key: 'platformUrl',
    width: 70,
    placeholder: 'richText',
    example: '举例:\n[{"platformUrl": "xxx", "platformUserName": "xxx", "platformPassword": "xxx", "platformEfa": "xxx"}]',
    richText: [
      { 'text': '仅支持JSON格式的数组, ' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': '需要用 [ ] 包含！' },
      { 'text': '请务必按照示例填写, 其中\n' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': 'platformUrl: 平台网址\n' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': 'platformUserName: 平台账号\n' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': 'platformPassword: 平台密码\n' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': 'platformEfa: 平台2FA' },
    ]
  },
  {
    header: '自定义打开 URL',
    key: 'defaultOpenUrl',
    width: 60,
    placeholder: 'richText',
    example: '举例:\n["https://www.facebook.com", "https://www.tiktok.com"]',
    richText: [
      { 'text': '启动浏览器时同时打开的标签页，需要用 ' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': '需要用 [ ] 包含！' },
      { 'text': '多个标签页请使用英文逗号隔开!\n网址前请加 http:// 或 https:// 否则无效!' },
    ]
  },
  {
    header: 'Cookie',
    key: 'cookie',
    placeholder: 'richText',
    example: '例子:\n[{"name":"fb","path":"/","domain":".facebook.com"},{"name":"ma","path":"/","domain":".amazon.com"}]',
    richText: [
      { 'text': '仅支持JSON格式的Cookie! ' },
      { 'font': { 'color': { 'argb': 'FFFF6600' } }, 'text': '需要用 [ ] 包含！' },
    ]
  },
  {
    header: '窗口备注',
    key: 'windowRemark',
    placeholder: '此处填写该浏览器窗口的备注信息! ',
  },
  {
    header: '窗口尺寸',
    key: 'windowSize',
    placeholder: '浏览器窗口打开时的默认窗口大小, 留空则按默认1280*720打开。\n格式为: 长度*高度',
    example: '举例:\n1280*720'
  }
]

// const randomString = () => Math.random().toString(36).slice(6);
// const datas = Array.from({ length: Math.floor(Math.random() * 100) + 10 }, () => ({
//   windowName: randomString(),
//   platformUrl: randomString(),
//   platformUserName: randomString(),
//   platformPassword: randomString(),
//   efa: randomString(),
//   cookie: randomString(),
//   defaultOpenUrl: randomString(),
//   proxyMethod: randomString(),
//   proxyInfo: randomString(),
//   refreshUrl: randomString(),
//   windowRemark: `${randomString()}\n${randomString()}\n${randomString()}`,
//   userAgent: randomString(),
//   windowSize: randomString(),
// }))

async function download() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.properties.defaultRowHeight = 30;

  worksheet.columns = columns.map(column => {
    const { key, header, width } = column;
    return {
      key,
      header,
      width: width || 40,
      style: {
        alignment: { wrapText: true, horizontal: 'left', vertical: 'top' },
      }
    }
  });

  const row = worksheet.getRow(1)
  row.height = 30;
  row.eachCell((cell, colIndex) => {
    const col = columns[colIndex - 1]
    cell.style = {
      font: {
        bold: true,
        name: 'Arial',
        color: { argb: col.required ? 'FFFFFF' : '000000' }
      },
      alignment: {
        horizontal: 'center',
        vertical: 'middle'
      },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: col.required ? 'ed7676' : 'fef08a' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    }
  })

  await addExplain(worksheet)

  // worksheet.addRows(datas);//批量添加数据行

  // 将工作簿转换为 Blob 并下载
  const uint8Array = await workbook.xlsx.writeBuffer();
  const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `roxy_template_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function addExplain(worksheet: ExcelJS.Worksheet) {
  worksheet.addRow(columns.map(column => column.placeholder));// 示例行
  worksheet.addRow(columns.map(column => column.example));// 示例行

  const pRow = worksheet.getRow(2)
  pRow.eachCell({ includeEmpty: true }, (cell, colIndex) => {
    if (cell.value === 'richText') {
      cell.value = {
        richText: columns[colIndex - 1]!.richText as ExcelJS.RichText[],
      }
    }
  })


  const mergeIndex = 4
  worksheet.mergeCells(mergeIndex, 1, mergeIndex, columns.length);
  worksheet.getRow(mergeIndex).height = 80;
  const mergedCell = worksheet.getCell(mergeIndex, 1);
  mergedCell.value = '说明: \n1. 数据请从第 5 行开始录入, 前 4 行不要删除和处理, 系统会默认从第 5 行开始导入, 务必严格按照说明规范录入, 否则无法导入成功! \n2. 红色列为必填项, 其他为选填项, 每次导入不可超过 500 条, 数据过多, 请分次导入!';
  mergedCell.alignment = {
    wrapText: true,
    horizontal: 'left',
    vertical: 'middle'
  };
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
