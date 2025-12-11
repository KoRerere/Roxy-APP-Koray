import ExcelJS from 'exceljs';
import { format } from 'date-fns'
import { $t } from '/@/locales';
import { API } from '/@/api'
import { getDictMap, safeParseJSON } from '/@/utils'
import { parseIntelligent } from '/@/views/account/create/utils'

interface DownloadTemplateOptions {
  afterAddExplain?: (worksheet: ExcelJS.Worksheet) => any
}

export async function getDefaultTemplate() {
  const { coreVersion } = await getDictMap()

  return {
    os: 'Windows',
    osVersion: '11',
    coreVersion: coreVersion![0]!.value,
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
    positionSwitch: true,
    openWidth: 1000,
    openHeight: 1000,
    windowRatioPosition: '0,0,tl',
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
    hardwareConcurrent: '12',
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
    openWorkbench: 1,
    searchEngine: 'Google',
    openBookmarks: false,
  }
}

const getExportColumns = async () => {
  const exampleText = $t('举例')

  const [$dict_map, searchEngineResult] = await Promise.all([
    getDictMap(),
    API.platform.userGetSearchEnginesList()
  ])

  const { os, version } = $dict_map.os!.reduce((acc, item, index) => {
    const os = `${exampleText}${index + 1}: ${item.label}`
    const version = $dict_map[`osversion_${item.value.toLocaleLowerCase()}`]!.map(item => item.value).join('、')

    acc.os.push(os)
    acc.version.push(`${os}: ${version}`)

    return acc
  }, { os: [] as string[], version: [] as string[] })

  let searchEngine: string[] = []
  if (searchEngineResult.code === 0 && searchEngineResult.data) {
    searchEngine = searchEngineResult.data.map((item: any, index) => (`${exampleText}${index + 1}: ${item.code}`))
  }

  return [
    {
      header: $t('窗口名称'),
      key: 'windowName',
      required: true,
      placeholder: $t('为浏览器窗口命名（必填项）'),
      example: `${exampleText}: Roxytest`
    },
    {
      header: $t('操作系统'),
      key: 'os',
      required: true,
      placeholder: $t('操作系统（必填项）\n如: Windows'),
      example: os.join('\n')
    },
    {
      header: $t('系统版本'),
      key: 'osVersion',
      width: 50,
      placeholder: $t('操作系统版本, 如: 11\n每行只能填写一个, 留空则自动使用对应操作系统最新版本'),
      example: version.join('\n')
    },
    {
      header: $t('代理类型'),
      key: 'proxyCategory',
      placeholder: $t('代理类型, 如: SOCKS5, 留空则自动使用 "直连"'),
      example: `${exampleText}1: SOCKS5\n${exampleText}2: HTTP\n${exampleText}3: HTTPS\n${exampleText}4: SSH`
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
      width: 90,
      placeholder: 'richText',
      example: `${exampleText}: \n[\n  "https://x.com/:roxy1:123",\n  "https://www.tiktok.com/:roxy2:456",\n  "https://www.youtube.com/:roxy3:789:roxy_2fa"\n]`,
      richText: [
        { 'text': $t('仅支持 JSON 格式的数组, 可支持填写多个账号, 多个账号请使用英文逗号隔开! ') },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('需要用 [ ] 包含！') },
        { 'text': `${$t('请务必按照示例填写\n')}` },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': `${$t('【平台:账号:密码:2FA】')}` },
      ],
      formatValue: (value: string) => {
        return safeParseJSON(value, []).map((str: string) => {
          const { platform, username, password, twoFactor } = parseIntelligent(str)
          return {
            platformUrl: platform,
            platformUserName: username ?? '',
            platformPassword: password ?? '',
            platformEfa: twoFactor ?? '',
          }
        })
      }
    },
    {
      header: $t('自定义打开 URL'),
      key: 'defaultOpenUrl',
      width: 60,
      placeholder: 'richText',
      example: `${exampleText}: \n["https://www.facebook.com", "https://www.tiktok.com"]`,
      richText: [
        { 'text': $t('启动浏览器时同时打开的标签页，需要用 ') },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('需要用 [ ] 包含！') },
        { 'text': $t('多个标签页请使用英文逗号隔开!\n网址前请加 http:// 或 https:// 否则无效!') },
      ],
      formatValue: (value: string) => safeParseJSON(value, [])
    },
    {
      header: 'Cookie',
      key: 'cookie',
      placeholder: 'richText',
      width: 60,
      example: `${exampleText}: \n[\n  {"name":"fb","path":"/","domain":".facebook.com"},\n  {"name":"ma","path":"/","domain":".amazon.com"},\n  {"name":"x","path":"/","domain":".x.com"}\n]`,
      richText: [
        { 'text': $t('仅支持 JSON 格式的数组, 可支持填写多个 cookie, 多个 cookie 请使用英文逗号隔开! ') },
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('需要用 [ ] 包含！') },
      ],
      formatValue: (value: string) => safeParseJSON(value, [])
    },
    {
      header: $t('窗口备注'),
      key: 'windowRemark',
      placeholder: $t('此处填写该浏览器窗口的备注信息! '),
      example: '',
      formatValue: (value: string) => value?.trim?.() || ''
    },
    {
      header: 'User-Agent',
      key: 'userAgent',
      placeholder: 'richText',
      example: `${exampleText}: \nMozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.99 Safari/537.36`,
      richText: [
        { 'font': { 'color': { 'argb': 'EF4444' } }, 'text': $t('若无需指定 UA, 则可不填写;') },
        { 'text': $t('若填写, 请务必确保 UA 格式正确。') },
      ],
    },
    {
      header: $t('搜索引擎'),
      key: 'searchEngine',
      placeholder: $t('浏览器窗口打开时地址栏使用的搜索引擎，留空则默认使用Google!'),
      example: searchEngine.join('\n'),
    },
  ]
}

export async function downloadTemplate(options: DownloadTemplateOptions = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.properties.defaultRowHeight = 30;
  const columns = await getExportColumns()

  worksheet.columns = columns.map(column => {
    const { key, header, width } = column;
    return {
      key,
      header,
      width: width || 50,
      style: {
        alignment: { wrapText: true, horizontal: 'left', vertical: 'top' },
      }
    }
  });

  const row = worksheet.getRow(1)
  row.height = 30;
  row.eachCell((cell, colIndex) => {
    const col = columns[colIndex - 1]!
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
  const fields = (await getExportColumns()).map(({ header, key, example, placeholder, richText }) => ({
    header,
    key,
    desc: (!richText ? placeholder : richText.map(item => item.text).join('')).split('\n').join('\n\t'),
    example: ['cookie', 'windowPlatformList', 'defaultOpenUrl', 'userAgent'].includes(key)
      ? example.split('\n').map(str => str.trimStart()).join('')
      : example.split('\n').join('\n\t\t'),
  }))

  const exampleData = [
    {
      windowName: 'name1',
      os: 'Windows',
      osVersion: 11,
      proxyCategory: 'HTTP',
      proxyInfo: 'www.proxy.com:80:username:password',
      windowPlatformList: '["https://x.com/:roxy1:123", "https://www.tiktok.com/:roxy2:456", "https://www.youtube.com/:roxy3:789:roxy_2fa"]',
      defaultOpenUrl: '["https://www.google.com/", "https://x.com/"]',
      cookie: '[{ "domain": "example", "expires": 0, "httpOnly": false, "name": "X-AB", "path": "xxx", "priority": "Medium", "sameParty": false, "sameSite": "None", "secure": true, "session": false, "size": 36, "sourcePort": 0, "sourceScheme": "Secure", "value": "xxxx" }]',
      windowRemark: 'remark1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.99 Safari/537.36',
      searchEngine: 'Google',
    },
    {
      windowName: 'name2',
      os: 'iOS',
      osVersion: '17.0',
      proxyCategory: 'HTTP',
      proxyInfo: 'www.proxy.com:81:username:password',
      windowPlatformList: '["https://x.com/:roxy1:123", "https://www.tiktok.com/:roxy2:456", "https://www.youtube.com/:roxy3:789:roxy_2fa"]',
      defaultOpenUrl: '["https://www.google.com/", "https://x.com/"]',
      cookie: '[{ "domain": "example", "expires": 0, "httpOnly": false, "name": "X-AB", "path": "xxx", "priority": "Medium", "sameParty": false, "sameSite": "None", "secure": true, "session": false, "size": 36, "sourcePort": 0, "sourceScheme": "Secure", "value": "xxxx" }]',
      windowRemark: 'remark2',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.99 Safari/537.36',
      searchEngine: 'Microsoft Bing',
    }
  ]

  const firstText = $t('*如需查看完整案例, 请跳转至文本最后, 如果您是第一次使用 txt 模板导入, 建议您按顺序阅读。')
  const fieldText = fields.map(item => `- ${item.key}  (${item.header})\n\t${item.desc}\n\t\t${item.example}`).join('\n\n')
  const separatorText = $t('{sign1}\n每个窗口之间请用 {sign2} 进行分隔（最少4个{sign}）。注意，备注内尽量不含空行。如存在空行，可能会导致识别失败。\n导入两个窗口，示例如下：', { sign: '#', sign1: '#'.repeat(40), sign2: '#'.repeat(10) })
  const exampleText = exampleData.map(item => Object.entries(item).map(([key, value]) => `${key}=${value}`).join('\n')).join(`\n\n${'#'.repeat(40)}\n\n`)
  const fullText = `${firstText}\n\n${fieldText}\n\n${separatorText}\n\n${exampleText}\n\n${'#'.repeat(40)}\n\n${$t('导入时，请删除本行及其以上的所有内容。')}\n\n`

  const blob = new Blob([fullText], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `roxy_template_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function addExplain(worksheet: ExcelJS.Worksheet) {
  const columns = await getExportColumns()
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
  mergedCell.value = $t('说明: \n1. 数据请从第 5 行开始录入, 前 4 行不要删除和处理, 系统会默认从第 5 行开始导入, 务必严格按照说明规范录入, 否则无法导入成功! \n2. 红色列为必填项, 其他为选填项, 每次导入不可超过 500 条, 数据过多, 请分次导入!\n3. 请勿在文本中添加超链接, 这可能会导致解析数据失败。');
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
    const columns = await getExportColumns()
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex >= 5) {
          const data: { [key: string]: any } = {
            rowNum: rowIndex,
            ...Object.fromEntries(columns.map((column, index) => {
              const cellValue = (row.values as ExcelJS.CellValue[])[index + 1]//excel 索引从1开始
              const value = column.formatValue?.((cellValue as any)?.text || cellValue) || cellValue
              return [column.key, value]
            }))
          }

          // 历史原因特殊处理 ios
          if (data.os?.toLocaleUpperCase() === 'IOS') {
            data.os = data.os.toLocaleUpperCase()
            if (typeof data.osVersion === 'number') {
              data.osVersion = data.osVersion.toFixed(1)
            }
          }
          result.push(data)
        }
      });
    });
    return result
  } catch (error) {
    console.log(error)
    return []
  }
}

export async function parseTextFile(file: File) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target?.result;
      if (!content) return resolve([])

      getExportColumns().then(columns => {
        const keys = columns.map(column => column.key)
        const result = (content as string)!.replace(/#{4,}/g, '####').split('####').map((text, index) => {
          const textFmt = text.trim().split('\n').map(line => {
            const [key, ...value] = line.trim().split('=')
            return keys.includes(key!) ? [key!, value.join('=')] : []
          }).filter(item => item.length)

          const { cookie, defaultOpenUrl, windowPlatformList, ...data } = Object.fromEntries(textFmt)

          // 历史原因特殊处理 ios
          if (data.os?.toLocaleUpperCase() === 'IOS') {
            data.os = data.os.toLocaleUpperCase()
          }

          return {
            rowNum: index + 1,
            ...data,
            cookie: safeParseJSON(cookie, []),
            defaultOpenUrl: safeParseJSON(defaultOpenUrl, []),
            windowPlatformList: safeParseJSON(windowPlatformList, []).map((str: string) => {
              const { platform, username, password, twoFactor } = parseIntelligent(str)
              return {
                platformUrl: platform,
                platformUserName: username ?? '',
                platformPassword: password ?? '',
                platformEfa: twoFactor ?? '',
              }
            }),
          }
        })
        resolve(result)
      })
    }
    reader.readAsText(file)
  })
}

export function getDefaultWindowName() {
  return $t('未命名窗口')
}

/**
 * 生成开关选项数组
 * @param options - 可选配置对象
 * @param options.trueText - 开启状态的显示文本，默认为 '开启'
 * @param options.falseText - 关闭状态的显示文本，默认为 '关闭'
 * @param options.trueValue - 开启状态对应的值，默认为 true
 * @param options.falseValue - 关闭状态对应的值，默认为 false
 * @returns 包含两个选项的数组，每个选项包含 label 和 value 属性
 */
export function genSwitchOptions(options?: { trueText: string, falseText: string, trueValue: any, falseValue: any }) {
  const defaultOptions = { trueText: $t('开启'), falseText: $t('关闭'), trueValue: true, falseValue: false }
  const { trueText, falseText, trueValue, falseValue } = { ...defaultOptions, ...options }
  return [
    { label: trueText, value: trueValue },
    { label: falseText, value: falseValue },
  ]
}
