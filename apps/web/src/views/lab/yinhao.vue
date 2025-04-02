<script setup lang="tsx">
import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'
import { format } from 'date-fns'
import { $t } from '/@/locales';
import { useDialog } from '/@/hooks/useDialog'
const [dialogInstance] = useDialog()

function open1() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => <PlanModal />,
    },
  })
}

function open2() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => <BalanceModal />,
    },
  })
}
//====================

const columns = ref([
  {
    title: 'aaa',
    key: 'aaa',
    width: 100,
  },
  {
    title: 'bbb',
    key: 'bbb',
    width: 100,
  },
  {
    title: 'ccc',
    key: 'ccc',
    // props: {
    //   eye: false
    // },
    headerSlot: 'mannnnnn',
    width: 100,
  },
  {
    title: 'ddd',
    key: 'ddd',
    width: 100,
  },
])

const data = Array.from({ length: 10 }, (_, index) => ({
  aaa: index,
  bbb: index * 2,
  ccc: index * 3,
}))
//======================
const getColumns = () => {
  const exampleText = $t('举例')

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
      example: `${exampleText}1: Windows\n${exampleText}2: macOS\n${exampleText}3: Android\n${exampleText}4: iOS`
    },
    {
      header: $t('系统版本'),
      key: 'osVersion',
      width: 50,
      placeholder: $t('操作系统版本, 如: 11\n每行只能填写一个, 留空则自动使用对应操作系统最新版本'),
      example: `${exampleText}1: Windows: 11、10、8、7\n${exampleText}2: macOS: ALL\n${exampleText}3: Android: 13、12、11、10、9\n${exampleText}4: iOS: 17.0、16.6、16.5、16.4、16.3、16.2、16.1、16.0、15.7、15.6、15.5、15.4、15.3、15.2、15.1、15.0、14.7、14.6、14.5、14.4、14.3、14.2、14.1、14.0`
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
      example: `${exampleText}: \n[\n${Array.from({ length: 2 }, () => '  {"platformUrl": "", "platformUserName": "", "platformPassword": "", "platformEfa": ""}').join(',\n')}\n]`,
      richText: [
        { 'text': $t('仅支持 JSON 格式的数组, 可支持填写多个账号, 多个账号请使用英文逗号隔开! ') },
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
      example: `${exampleText}: \n["https://www.facebook.com", "https://www.tiktok.com"]`,
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
      width: 60,
      example: `${exampleText}: \n[\n  {"name":"fb","path":"/","domain":".facebook.com"},\n  {"name":"ma","path":"/","domain":".amazon.com"},\n  {"name":"x","path":"/","domain":".x.com"}\n]`,
      richText: [
        { 'text': $t('仅支持 JSON 格式的数组, 可支持填写多个 cookie, 多个 cookie 请使用英文逗号隔开! ') },
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
      example: ''
    },
    {
      header: $t('窗口尺寸'),
      key: 'windowSize',
      placeholder: $t('浏览器窗口打开时的默认窗口大小, 留空则按默认1000*1000打开。\n格式为: 长度*高度'),
      example: `${exampleText}: 1000*1000`
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
    }
  ]
}

function downloadTextTemplate() {
  const fields = getColumns().map(({ header, key, example, placeholder, richText }) => ({
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
      windowPlatformList: '[{ "platformUrl": "https://www.x.com/", "platformUserName": "xxxx", "platformPassword": "132456", "platformEfa": "" }]',
      defaultOpenUrl: '["https://www.google.com/", "https://x.com/"]',
      cookie: '[{ "domain": "example", "expires": 0, "httpOnly": false, "name": "X-AB", "path": "xxx", "priority": "Medium", "sameParty": false, "sameSite": "None", "secure": true, "session": false, "size": 36, "sourcePort": 0, "sourceScheme": "Secure", "value": "xxxx" }]',
      windowRemark: 'remark1',
      windowSize: '1000*1000',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.99 Safari/537.36',
    },
    {
      windowName: 'name2',
      os: 'iOS',
      osVersion: 17.0,
      proxyCategory: 'HTTP',
      proxyInfo: 'www.proxy.com:81:username:password',
      windowPlatformList: '[{ "platformUrl": "https://www.x.com/", "platformUserName": "xxxx", "platformPassword": "132456", "platformEfa": "" }]',
      defaultOpenUrl: '["https://www.google.com/", "https://x.com/"]',
      cookie: '[{ "domain": "example", "expires": 0, "httpOnly": false, "name": "X-AB", "path": "xxx", "priority": "Medium", "sameParty": false, "sameSite": "None", "secure": true, "session": false, "size": 36, "sourcePort": 0, "sourceScheme": "Secure", "value": "xxxx" }]',
      windowRemark: 'remark2',
      windowSize: '1000*1000',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.99 Safari/537.36',
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
</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <br>
    <br>
    <RxButton class="!w-20" @click="downloadTextTemplate">download</RxButton>
    <br>
    <br>
    <div class="flex w-260 h-100 gap-20 overflow-hidden">
      <RyTable :columns="columns" :data-list="data" show-gridlines :showTableHeader="false" :paginator="false" :showActions="false">
        <template #mannnnnn="{ column }">
          <span class="text-red">{{ column.title }}</span>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress {
  &-value {
    fill: none;
    stroke-width: 4.5;
    stroke-dasharray: calc(2 * 3.14159 * 14);
    stroke: var(--stroke-color, #12A3FC);
    stroke-linecap: round;
    stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  }

  &-circle {
    transform: rotate(-90deg);
  }

  &-bg {
    fill: none;
    stroke: #E8F5FC;
    stroke-width: 4.5;
  }
}
</style>
