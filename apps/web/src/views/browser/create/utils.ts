import { format } from 'date-fns'
import ExcelJS from 'exceljs';
import { $t } from '/@/locales';

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
    defaultOpenUrl: [],
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


export const getColumns = () => {
  const exampleText = $t('举例')

  return [
    {
      header: $t('窗口名称'),
      key: 'windowName',
      required: true,
      placeholder: $t('为浏览器窗口命名（必填项）'),
      example: `${exampleText}:\nRoxytest`
    },
    {
      header: $t('系统'),
      key: 'os',
      required: true,
      placeholder: $t('操作系统（必填项）\n如: Windows'),
      example: `${exampleText}1: Windows\n${exampleText}2: macOS\n${exampleText}3: Android\n${exampleText}4: IOS`
    },
    {
      header: $t('系统版本'),
      key: 'osVersion',
      width: 50,
      placeholder: $t('操作系统版本, 如: 11\n每行只能填写一个, 留空则自动使用对应操作系统最新版本'),
      example: `${exampleText}1: Windows: 11、10、8、7\n${exampleText}2: macOS: ALL\n${exampleText}3: Android: 13、12、11、10、9\n${exampleText}4: IOS: 17.0、16.6、16.5、16.4、16.3、16.2、16.1、16.0、15.7、15.6、15.5、15.4、15.3、15.2、15.1、15.0、14.7、14.6、14.5、14.4、14.3、14.2、14.1、14.0`
    },
    {
      header: $t('代理类型'),
      key: 'proxyCategory',
      placeholder: $t('代理类型, 如: SOCKS5, 留空则自动使用 "直连"'),
      example: `${exampleText}1: 直连\n${exampleText}2: SOCKS5\n${exampleText}3: HTTP\n${exampleText}4: HTTPS\n${exampleText}5: SSH`
    },
    {
      header: $t('代理信息'),
      key: 'proxyInfo',
      width: 70,
      placeholder: 'richText',
      example: `${exampleText}1: 192.168.0.1:8800\n${exampleText}2: 192.168.0.1:8800:roxytest:roxypass\n${exampleText}3: 192.168.0.1:8800:roxytest:roxypass[http://refresh.roxy.com]\n${exampleText}4: ipv6:192.168.0.1:8800:roxytest:roxypass`,
      richText: [
        { 'text': `${$t('请务必按照此顺序格式填写:')}\n` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('【代理主机:代理端口:代理用户名:代理密码[刷新URL]】')}\n` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('其中 代理用户名、代理密码、[刷新URL] 为选填')}\n` },
        { 'text': $t('若网络协议为ipv6, 请在代理信息最前端添加 ipv6:') },
      ]
    },
    {
      header: $t('平台账号'),
      key: 'windowPlatformList',
      width: 70,
      placeholder: 'richText',
      example: `${exampleText}:\n[{"platformUrl": "xxx", "platformUserName": "xxx", "platformPassword": "xxx", "platformEfa": "xxx"}]`,
      richText: [
        { 'text': $t('仅支持JSON格式的数组, ') },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('需要用 [ ] 包含！') },
        { 'text': `${$t('请务必按照示例填写, 其中')}\n` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('platformUrl: 平台网址')}\n` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('platformUserName: 平台账号')}\n` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('platformPassword: 平台密码')}\n` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('platformEfa: 平台2FA')}` },
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
      header: $t('自定义打开 URL'),
      key: 'defaultOpenUrl',
      width: 60,
      placeholder: 'richText',
      example: `${exampleText}:\n["https://www.facebook.com", "https://www.tiktok.com"]`,
      richText: [
        { 'text': $t('启动浏览器时同时打开的标签页，需要用 ') },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('需要用 [ ] 包含！') },
        { 'text': $t('多个标签页请使用英文逗号隔开!\n网址前请加 http:// 或 https:// 否则无效!') },
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
      example: `${exampleText}:\n[{"name":"fb","path":"/","domain":".facebook.com"},{"name":"ma","path":"/","domain":".amazon.com"}]`,
      richText: [
        { 'text': $t('仅支持JSON格式的Cookie! ') },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('需要用 [ ] 包含！') },
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
      header: $t('窗口备注'),
      key: 'windowRemark',
      placeholder: $t('此处填写该浏览器窗口的备注信息! '),
    },
    {
      header: $t('窗口尺寸'),
      key: 'windowSize',
      placeholder: $t('浏览器窗口打开时的默认窗口大小, 留空则按默认1000*1000打开。\n格式为: 长度*高度'),
      example: `${exampleText}:\n1000*1000`
    }
  ]
}

interface DownloadTemplateOptions {
  afterAddExplain?: (worksheet: ExcelJS.Worksheet) => any
}

export async function downloadTemplate(options: DownloadTemplateOptions = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.properties.defaultRowHeight = 30;
  const columns = getColumns()

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

export async function downloadTextTemplate() {
  const fields = [
    {
      key: 'windowName',
      desc: $t('【必填】为浏览器窗口命名'),
      example: ['Roxytest']
    },
    {
      key: 'os',
      desc: $t('【必填】操作系统'),
      example: ['Windows', 'macOS', 'Android', 'IOS']
    },
    {
      key: 'osVersion',
      desc: $t('系统版本\n\t只能填写一个，留空则自动使用对应操作系统最新版本，现在支持的版本有：\n\t\t- Windows：{windows}\n\t\t- macOS：{macos}\n\t\t- Android：{android}\n\t\t- IOS：{ios}', {
        windows: '11, 10, 8, 7',
        macos: 'ALL',
        android: '13、12、11、10、9',
        ios: '17.0、16.6、16.5、16.4、16.3、16.2、16.1、16.0、15.7、15.6、15.5、15.4、15.3、15.2、15.1、15.0、14.7、14.6、14.5、14.4、14.3、14.2、14.1、14.0',
      }),
      example: ['11', 'ALL', '17.0']
    },
    {
      key: 'proxyCategory',
      desc: $t('代理类型\n\t如：{value}，留空则自动使用 "直连"。\n\t现在支持的类型有：{type}', { value: 'SOCKS5', type: 'HTTP、HTTPS、SOCKS5、SSH' }),
      example: ['HTTPS', 'SSH']
    },
    {
      key: 'proxyInfo',
      desc: $t('代理信息\n\t请务必按照此顺序格式填写：代理主机:代理端口:代理用户名:代理密码[刷新URL]\n\t代理用户名、代理密码、[刷新URL] 为【选填】\n\t若网络协议为ipv6，请在代理信息最前端添加 ipv6'),
      example: ['192.168.0.1:8800', '192.168.0.1:8800:roxytest:roxypass', '192.168.0.1:8800:roxytest:roxypass[http://refresh.roxy.com]', 'ipv6:192.168.0.1:8800:roxytest:roxypass']
    },
    {
      key: 'windowPlatformList',
      desc: $t('平台账号\n\t仅支持JSON格式的数组, 需要用 [ ] 包含！请务必按照示例填写\n\t\t- platformUrl: 平台网址\n\t\t- platformUserName: 平台账号\n\t\t- platformPassword: 平台密码\n\t\t- platformEfa: 平台2FA'),
      example: ['[{"platformUrl": "xxx", "platformUserName": "xxx", "platformPassword": "xxx", "platformEfa": "xxx"}]']
    },
    {
      key: 'defaultOpenUrl',
      desc: $t('启动浏览器时同时打开的标签页，需要用 [ ] 包含！多个标签页请使用英文逗号隔开!'),
      example: ["['https://www.facebook.com', 'https://www.tiktok.com']"]
    },
    {
      key: 'cookie',
      desc: $t('仅支持JSON格式的Cookie! 需要用 [ ] 包含！'),
      example: ['[{"name":"fb","path":"/","domain":".facebook.com"},{"name":"ma","path":"/","domain":".amazon.com"}]']
    },
    {
      key: 'windowRemark',
      desc: $t('窗口备注'),
      example: ['RoxyRemarkTest']
    },
    {
      key: 'windowSize',
      desc: $t('浏览器窗口打开时的默认窗口大小\n\t留空则按默认 {default} 打开。\n\t格式为: 长度*高度', { default: '1000*1000' }),
      example: ['1000*1000']
    }
  ]
  const exampleData = [
    {
      windowName: 'name1',
      os: 'Windows',
      osVersion: 11,
      proxyCategory: 'HTTP',
      proxyInfo: 'www.proxy.com:80:username:password',
      windowPlatformList: '[{ "platformUrl": "https://www.x.com/", "platformUserName": "xxxx", "platformPassword": "132456", "platformEfa": "" }]',
      defaultOpenUrl: '["https://www.google.com/", "https://x.com/"]',
      cookie: '[{ "domain": "example", "expires": 0, "httpOnly": false, "name": "X-AB", "path": "xxx", "priority": "Medium", "sameParty": false, "sameSite": "None", "secure": true, "session": false, "size": 36, "sourcePort": 0, "sourceScheme": "Secure", "value": "xxxx" }]',
      windowRemark: 'remark1',
      windowSize: '1000*1000',
    },
    {
      windowName: 'name2',
      os: 'IOS',
      osVersion: 17.0,
      proxyCategory: 'HTTP',
      proxyInfo: 'www.proxy.com:81:username:password',
      windowPlatformList: '[{ "platformUrl": "https://www.x.com/", "platformUserName": "xxxx", "platformPassword": "132456", "platformEfa": "" }]',
      defaultOpenUrl: '["https://www.google.com/", "https://x.com/"]',
      cookie: '[{ "domain": "example", "expires": 0, "httpOnly": false, "name": "X-AB", "path": "xxx", "priority": "Medium", "sameParty": false, "sameSite": "None", "secure": true, "session": false, "size": 36, "sourcePort": 0, "sourceScheme": "Secure", "value": "xxxx" }]',
      windowRemark: 'remark2',
      windowSize: '1000*1000',
    }
  ]
  const str1 = fields.map(item => `- ${item.key} ${item.desc}\n${item.example.map((str, index) => `\t${$t('【示例{index}】', { index: index + 1 })}${item.key}=${str}`).join('\n')}`).join('\n\n')
  const str2 = $t('{sign1}\n每个窗口之间请用 {sign2} 进行分隔（最少4个{sign}）。注意，备注内尽量不含空行。如存在空行，可能会导致识别失败。\n导入两个窗口，示例如下：', { sign: '#', sign1: '#'.repeat(40), sign2: '#'.repeat(10) })
  const str3 = exampleData.map(item => Object.entries(item).map(([key, value]) => `${key}=${value}`).join('\n')).join(`\n\n${'#'.repeat(40)}\n\n`)
  const str = `${str1}\n\n${str2}\n\n${str3}\n\n${'#'.repeat(40)}\n\n${$t('导入时，请删除本行及其以上的所有内容。')}\n\n`

  const blob = new Blob([str], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `roxy_template_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function addExplain(worksheet: ExcelJS.Worksheet) {
  const columns = getColumns()
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
  mergedCell.value = $t('说明: \n1. 数据请从第 5 行开始录入, 前 4 行不要删除和处理, 系统会默认从第 5 行开始导入, 务必严格按照说明规范录入, 否则无法导入成功! \n2. 红色列为必填项, 其他为选填项, 每次导入不可超过 500 条, 数据过多, 请分次导入!');
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
    const columns = getColumns()
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex >= 5) {
          const data: { [key: string]: any } = {
            rowNum: rowIndex,
            ...Object.fromEntries(columns.map((column, index) => {
              const cellValue = (row.values as ExcelJS.CellValue[])[index + 1]//excel 索引从1开始
              const value = column.formatValue?.(cellValue?.text || cellValue) || cellValue
              return [column.key, value]
            }))
          }
          if (data.os?.toLocaleUpperCase() === 'IOS' && typeof data.osVersion === 'number') {
            data.osVersion = data.osVersion.toFixed(1)
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

export async function parseTextFile(file: File) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target?.result;
      const result = (content as string)!.replace(/#{4,}/g, '####').split('####').map((line, index) => {
        const { cookie, defaultOpenUrl, windowPlatformList, ...data } = Object.fromEntries(line.trim().split('\n').map(str => {
          const [key, ...value] = str.trim().split('=')
          return [key, value.join('=')]
        }))
        return {
          rowNum: index + 1,
          ...data,
          cookie: JSON.parse(cookie || '[]'),
          defaultOpenUrl: JSON.parse(defaultOpenUrl || '[]'),
          windowPlatformList: JSON.parse(windowPlatformList || '[]'),
        }
      })
      resolve(result)
    }
    reader.readAsText(file)
  })
}

export function getDefaultWindowName() {
  return $t('未命名窗口')
}
