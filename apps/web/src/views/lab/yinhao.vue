<script setup lang="ts">
import ExcelJS from 'exceljs';
import { ExcelAccept } from '/@/utils/constants';

const columns = [
  {
    header: '窗口名称',
    key: 'windowName',
    required: true,
    placeholder: '为浏览器窗口命名（必填项）',
  },
  {
    header: '账号平台',
    key: 'platformUrl',
    placeholder: '填写账号平台的URL, URL前必须加 http:// 或 https:// , 留空则设定为不设置任何平台',
    example: '举例:\nhttps://www.facebook.com'
  },
  {
    header: '用户名',
    key: 'platformUserName',
    placeholder: '填写后, 打开浏览器窗口, 指定账号平台的用户名将自动填充! ',
  },
  {
    header: '密码',
    key: 'platformPassword',
    placeholder: '填写后, 打开浏览器窗口, 指定账号平台的密码将自动填充! ',
  },
  {
    header: '2FA秘钥',
    key: 'efa',
    placeholder: '填写2FA密钥, 用于生成网站的二次验证码, 类似谷歌身份验证器。',
    example: '举例:\n7Z3BFF5TZGEFVNQ4GJ4SOU2FGOBJACPX'
  },
  {
    header: 'Cookie',
    key: 'cookie',
    placeholder: '支持: 仅支持JSON格式的Cookie! 需要用 [] 包含。',
    example: '例子:\n[{"name":"fb","path":"/","domain":".facebook.com"},{"name":"ma","path":"/","domain":".amazon.com"}]'
  },
  {
    header: '打开指定网址',
    key: 'defaultOpenUrl',
    placeholder: '填写启动浏览器时同时打开的标签页, 注意: \n1.若填写多个标签页, 请使用英文逗号隔开, 最多填写10个, 超出部分不导入。\n2.若不填写, 则默认不导入\n3.网址前请加http://或https://否则无效!',
    example: '举例:\nhttps://www.facebook.com,https://www.tiktok.com'
  },
  {
    header: '代理类型',
    key: 'proxyMethod',
    placeholder: '格式: 直连模式/http/https/socks5 以上几种格式, 每行只能填写其中一个, 留空则自动使用 “直连模式'
  },
  {
    header: '代理信息',
    key: 'proxyInfo',
    placeholder: '请务必按照此顺序格式填写【代理主机: 代理端口: 代理用户名: 代理密码】\n若代理协议为IPV6, 请在代理信息最前端添加  IPV6:',
    example: '举例1:\n192.168.0.1:8800:user:password\n举例2:\nroxybrowser.io:8000:user:password\n举例3:\nipv6:11.22.33.44:8800:user:password'
  },
  {
    header: '刷新URL',
    key: 'refreshUrl',
    placeholder: '填写代理设置中的“刷新URL”'
  },
  {
    header: '窗口备注',
    key: 'windowRemark',
    placeholder: '此处填写该浏览器窗口的备注信息! ',
  },
  {
    header: 'User Agent',
    key: 'userAgent',
    placeholder: '请正确填写UA(UserAgent)值, 不填写则随机生成。',
    example: '举例:\nMozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.5938.92 Safari/537.36'
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
    const { key, header } = column;
    return {
      key,
      header,
      width: 40,
      style: {
        alignment: { wrapText: true, horizontal: 'left', vertical: 'middle' },
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
        size: 16,
        name: 'Arial',
        color: { argb: col.required ? 'FFFFFF' : '000000' }
      },
      alignment: {
        horizontal: 'left',
        vertical: 'middle'
      },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: col.required ? 'ed7676' : '' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    }
  })

  worksheet.addRow(Object.fromEntries(columns.map(column => [column.key, column.placeholder])));// 说明行
  worksheet.addRow(Object.fromEntries(columns.map(column => [column.key, column.example])));// 示例行

  const mergeIndex = 4
  worksheet.mergeCells(mergeIndex, 1, mergeIndex, columns.length);
  worksheet.getRow(mergeIndex).height = 80;
  const mergedCell = worksheet.getCell(mergeIndex, 1);
  mergedCell.value = '说明: \n1. 数据请从第5行开始录入, 前4行不要删除和处理, 系统会默认从第5行开始导入, 务必严格按照说明规范录入, 否则无法导入成功! \n2. 红色列为必填项, 其他为选填项, 每次导入不可超过500条, 数据过多, 请分次导入!';
  mergedCell.alignment = {
    wrapText: true,
    horizontal: 'left',
    vertical: 'middle'
  };

  // datas.forEach(data => {
  //   worksheet.addRow(data);
  // });

  // 将工作簿转换为 Blob 并下载
  const uint8Array = await workbook.xlsx.writeBuffer();
  const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${new Date().getTime()}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function parse() {
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

  try {
    await workbook.xlsx.load(await file.arrayBuffer());

    workbook.eachSheet((worksheet, sheetId) => {
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex >= 5) {
          console.log(`Row ${rowIndex}:`, row.values);
        }
      });
    });
  } catch (error) {
    console.log("🚀 ~ parse ~ error:", error)
  }
}
</script>

<template>
  <div class="flex justify-end gap-5">
    <RxButton label="下载" @click="download" />
    <RxButton label="解析" @click="parse" />
  </div>
</template>
