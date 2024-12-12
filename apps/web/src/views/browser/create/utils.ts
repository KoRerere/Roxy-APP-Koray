import { format } from 'date-fns'
import ExcelJS from 'exceljs';

export function getDefaultTemplate() {
  return {
    os: 'Windows',
    osVersion: '11',
    coreVersion: '125',
    browserVersion: null,
    isLanguageBaseIp: true,
    language: 'sq-AL',
    isDisplayLanguageBaseIp: true,
    displayLanguage: 'sq-AL',
    isTimeZone: true,
    timeZone: 'GMT-01:00 America/Scoresbysund',
    position: 1,
    isPositionBaseIp: true,
    longitude: '',
    latitude: '',
    precisionPos: '',
    forbidAudio: true,
    forbidImage: true,
    forbidMedia: true,
    openWidth: 1000,
    openHeight: 1000,
    resolutionType: false,
    resolutionX: '1280',
    resolutionY: '720',
    fontType: false,
    webRTC: 2,
    webGL: true,
    webGLInfo: true,
    webGpu: 'webgl',
    canvas: true,
    audioContext: true,
    speechVoices: true,
    doNotTrack: true,
    clientRects: true,
    deviceInfo: true,
    deviceNameSwitch: true,
    macInfo: true,
    hardwareConcurrent: '4',
    deviceMemory: '8',
    disableSsl: false,
    disableSslList: [],
    portScanProtect: true,
    portScanList: '',
    useGpu: true,
    sandboxPermission: false,
    startupParam: '',
    isDisplayName: false,
    syncBookmark: false,
    syncHistory: false,
    syncTab: true,
    syncCookie: true,
    syncExtensions: false,
    syncPassword: true,
    syncIndexedDb: false,
    syncLocalStorage: false,
    clearCacheFile: false,
    clearCookie: false,
    clearLocalStorage: false,
    randomFingerprint: false,
    forbidSavePassword: true,
    stopOpenNet: false,
    stopOpenIP: false,
    stopOpenPosition: false,
  }
}

export const columns = [
  {
    header: '窗口名称',
    key: 'windowName',
    required: true,
    placeholder: '为浏览器窗口命名（必填项）',
    example: '举例:\nRoxytest'
  },
  {
    header: '系统',
    key: 'os',
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
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': '【代理主机:代理端口:代理用户名:代理密码[刷新URL]】\n' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': '其中 代理用户名、代理密码、[刷新URL] 为选填\n' },
      { 'text': '若网络协议为ipv6, 请在代理信息最前端添加 ipv6:' },
    ]
  },
  {
    header: '平台账号',
    key: 'windowPlatformList',
    width: 70,
    placeholder: 'richText',
    example: '举例:\n[{"platformUrl": "xxx", "platformUserName": "xxx", "platformPassword": "xxx", "platformEfa": "xxx"}]',
    richText: [
      { 'text': '仅支持JSON格式的数组, ' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': '需要用 [ ] 包含！' },
      { 'text': '请务必按照示例填写, 其中\n' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': 'platformUrl: 平台网址\n' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': 'platformUserName: 平台账号\n' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': 'platformPassword: 平台密码\n' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': 'platformEfa: 平台2FA' },
    ],
    formatValue(value: string) {
      try {
        return JSON.parse(value)
      }
      catch (error) {
        return value
      }
    }
  },
  {
    header: '自定义打开 URL',
    key: 'defaultOpenUrl',
    width: 60,
    placeholder: 'richText',
    example: '举例:\n["https://www.facebook.com", "https://www.tiktok.com"]',
    richText: [
      { 'text': '启动浏览器时同时打开的标签页，需要用 ' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': '需要用 [ ] 包含！' },
      { 'text': '多个标签页请使用英文逗号隔开!\n网址前请加 http:// 或 https:// 否则无效!' },
    ],
    formatValue(value: string) {
      try {
        return JSON.parse(value)
      }
      catch (error) {
        return value
      }
    }
  },
  {
    header: 'Cookie',
    key: 'cookie',
    placeholder: 'richText',
    example: '例子:\n[{"name":"fb","path":"/","domain":".facebook.com"},{"name":"ma","path":"/","domain":".amazon.com"}]',
    richText: [
      { 'text': '仅支持JSON格式的Cookie! ' },
      { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': '需要用 [ ] 包含！' },
    ],
    formatValue(value: string) {
      try {
        return JSON.parse(value)
      }
      catch (error) {
        return value
      }
    }
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

interface DownloadTemplateOptions {
  afterAddExplain?: (worksheet: ExcelJS.Worksheet) => any
}

export async function downloadTemplate(options: DownloadTemplateOptions = {}) {
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
  await options.afterAddExplain?.(worksheet)
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

export async function parseTemplate(file: File) {
  try {
    const result: any = []
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex >= 5) {
          const data = {
            rowNum: rowIndex,
            ...Object.fromEntries(columns.map((column, index) => {
              const cellValue = (row.values as ExcelJS.CellValue[])[index + 1]//excel 索引从1开始
              const value = column.formatValue?.(cellValue as string) || cellValue
              return [column.key, value]
            }))
          }
          result.push(data)
        }
      });
    });
    return result
  } catch (error) {
    console.log(error)
  }
}
