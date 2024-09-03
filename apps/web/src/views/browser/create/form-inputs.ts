import { API } from '/@/api'
import { createDefaultObject, getFormDataByList, setInputVisible } from '/@/utils'

async function getUaWebgl(inputsGroup: any) {
  const { os, osVersion, coreVersion } = getFormDataByList(inputsGroup)
  const { data } = await API.window.userGetUaWebglList({
    os,
    osVersion,
    coreVersion,
  })

  const keys = Object.keys(data)

  inputsGroup.forEach((inputs: any) => {
    inputs.forEach((input: any) => {
      if (keys.includes(input.name)) {
        input.value = data[input.name]
      }
    })
  })
}

async function getDeviceName(inputsGroup: any) {
  const { os } = getFormDataByList(inputsGroup)
  return API.window.userGetDeviceNameList({ os })
}

async function _getMacAddr(_inputsGroup: any) {
  // const { os } = getFormDataByList(inputsGroup)
  // return API.window.userGetMacAddrV2List({ os })
}

export function getAccordions() {
  return {
    value: ['0', '1', '2', '3'],
    panels: [
      {
        title: 'window',
        value: '0',
      },
      {
        title: 'Basic',
        value: '1',
      },
      {
        title: 'highLevel',
        value: '2',
      },
      {
        title: 'other',
        value: '3',
      },
    ],
  }
}

export function getInputsGroup(data: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  const proxyInfoList = data.proxyCategory && data.proxyCategory !== 'noproxy'
    ? [{
      host: data.host, // 代理主机
      ipType: data.ipType, // 网络协议
      port: data.port, // 代理端口
      proxyCategory: data.proxyCategory, // 代理类型
      proxyPassword: data.proxyPassword, // 代理密码
      proxyUserName: data.proxyUserName, // 代理账号
      refreshUrl: data.refreshUrl, // 刷新URL
    }]
    : []

  const inputsGroup = reactive([
    [
      {
        label: '系统选择',
        slot: 'System',
        items: [
          {
            type: 'select',
            placeholder: '请选择系统',
            name: 'os',
            value: data.os ?? $dict_map.os[0].value,
            options: $dict_map.os,
            change(self: any, items: any) {
              const osVersionInput = items.find(
                (item: any) => item.name === 'osVersion',
              )
              if (self.value) {
                const osVersionOptions = $dict_map[`osVersion-${self.value}`]
                osVersionInput.value = osVersionOptions[0].value
                osVersionInput.options = osVersionOptions
                osVersionInput.disabled = false
              }
              else {
                osVersionInput.value = null
                osVersionInput.options = []
                osVersionInput.disabled = true
              }
            },
          },
          {
            type: 'select',
            placeholder: '请选择版本',
            name: 'osVersion',
            value: data.osVersion ?? $dict_map['osVersion-Windows'][0].value,
            options:
              $dict_map[`osVersion-${data.os}`]
              || $dict_map['osVersion-Windows'],
          },
        ],
      },
      {
        type: 'select',
        label: '#x浏览器内核',
        placeholder: '请选择浏览器内核',
        name: 'coreVersion',
        value: $dict_map.coreVersion[0],
        options: $dict_map.coreVersion,
      },
      {
        type: 'textarea',
        label: 'User-Agent',
        placeholder: '请填写ua',
        name: 'userAgent',
        value: data.userAgent,
        icon: 'mdi mdi-shuffle-variant',
        disabled: true,
        iconClick: () => {
          getUaWebgl(inputsGroup)
        },
      },
      {
        separator: true,
      },
      {
        label: 'Proxy(Direct)',
        name: 'proxyInfoList',
        value: proxyInfoList,
        slot: 'proxy',
        formatValue: (self: any, _inputs: any, formData: any) => {
          const value = self.value[0] || {
            ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'] as const, ''),
            proxyCategory: 'noproxy', // 删除代理时要手动标记直连
          }
          Object.assign(formData, value)// 赋值给表单（单个创建，以上字段为空则代表删除代理）
          return self.value.map(({ proxyCount, ...item }: any) => Array.from({ length: proxyCount }, () => item)).flat()
        },
      },
      {
        separator: true,
      },
      {
        label: 'Accounts',
        name: 'windowPlatformList',
        value: data.windowPlatformList ?? [],
        slot: 'accounts',
      },
      {
        label: 'URLs',
        name: 'defaultOpenUrl',
        value: data.defaultOpenUrl ?? [],
        slot: 'urls',
        tooltip: 'man!',
      },
      {
        type: 'textarea',
        label: '#xCookies',
        placeholder: 'Paste your cookies with JSON format',
        name: 'cookies',
        value: data.cookies,
        icon: 'mdi mdi-paperclip',
        formatValue: (self: any) => {
          return self.value
          // ? JSON.parse(self.value).map(({ name, value, domain }) => ({ name, value, domain }))
          // : value
        },
        onBlur(self: any) {
          console.log('🚀 ~ onBlur ~ self:', self)
        },
      },
    ],
    [
      {
        type: 'radio',
        label: '语言',
        name: 'isLanguageBaseIp',
        value: data.isLanguageBaseIp ?? true,
        options: [
          { label: '跟随ip匹配', value: true },
          { label: '自定义', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'language', self.value === false)
        },
      },
      {
        type: 'select',
        label: ' ',
        placeholder: '请选择语言',
        name: 'language',
        value: data.language,
        options: $dict_map.language,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: 'radio',
        label: '语言界面',
        name: 'isDisplayLanguageBaseIp',
        value: data.isDisplayLanguageBaseIp ?? true,
        options: [
          { label: '跟随ip匹配', value: true },
          { label: '自定义', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'displayLanguage', self.value === false)
        },
      },
      {
        type: 'select',
        label: ' ',
        placeholder: '请选择语言',
        name: 'displayLanguage',
        value: data.displayLanguage,
        options: $dict_map.language,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: 'radio',
        label: '时区',
        name: 'isTimeZone',
        value: data.isTimeZone ?? true,
        options: [
          { label: '跟随ip匹配', value: true },
          { label: '自定义', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'timeZone', self.value === false)
        },
      },
      {
        type: 'select',
        label: ' ',
        placeholder: '请选择时区',
        name: 'timeZone',
        value: data.timeZone,
        options: $dict_map.timeZone,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: 'radio',
        label: '地理位置提示',
        name: 'position',
        value: data.position ?? 0,
        options: [
          { label: '询问', value: 0 },
          { label: '允许', value: 1 },
          { label: '禁用', value: 2 },
        ],
        change(_v: any, self: any, inputs: any) {
          const ipt = inputs.find(
            (ipt: any) => ipt.name === 'isPositionBaseIp',
          )
          if (ipt) {
            const visible = self.value !== 2
            ipt.visible = visible
            if (!visible) {
              ipt.value = true
              ipt.change(ipt.value, ipt, inputs)
            }
          }
        },
      },
      {
        type: 'radio',
        label: '地理位置',
        name: 'isPositionBaseIp',
        value: data.isPositionBaseIp ?? true,
        options: [
          { label: '跟随ip匹配', value: true },
          { label: '自定义', value: false },
        ],
        visible: true,
        change(_v: any, self: any, inputs: any) {
          setInputVisible(
            inputs,
            ['longitude', 'latitude', 'precisionPos'],
            self.value === false,
          )
        },
      },
      {
        type: 'text',
        label: '经度',
        placeholder: '请填写经度, 示例: -40.123',
        name: 'longitude',
        value: data.longitude,
        visible: false,
      },
      {
        type: 'text',
        label: '纬度',
        placeholder: '请填写纬度, 示例: 30.123',
        name: 'latitude',
        value: data.latitude,
        visible: false,
      },
      {
        type: 'text',
        label: '精度(米)',
        placeholder: '请填写精度, 范围: 10-5000',
        name: 'precisionPos',
        value: data.precisionPos,
        visible: false,
      },
      {
        type: 'radio',
        label: '声音',
        name: 'forbidAudio',
        value: data.forbidAudio ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '图片',
        name: 'forbidImage',
        value: data.forbidImage ?? 1,
        options: [
          { label: '加载', value: 1 },
          { label: '禁止', value: 2 },
        ],
      },
      {
        type: 'radio',
        label: '视频',
        name: 'forbidMedia',
        value: data.forbidMedia ?? true,
        options: [
          { label: '允许', value: true },
          { label: '禁止', value: false },
        ],
      },
      {
        label: '窗口大小',
        slot: 'windowSize',
        items: [
          {
            type: 'text',
            placeholder: '请输入宽度',
            name: 'openWidth',
            value: data.openWidth,
          },
          {
            type: 'text',
            placeholder: '请输入高度',
            name: 'openHeight',
            value: data.openHeight,
          },
        ],
      },
    ],
    [
      {
        type: 'radio',
        label: '分辨率',
        name: 'resolutionType',
        value: data.resolutionType ?? false,
        options: [
          { label: '跟随电脑', value: false },
          { label: '自定义', value: true },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'resolution', self.value === true)
        },
      },
      {
        type: 'select',
        label: '分辨率值',
        placeholder: '请选择分辨率',
        name: 'resolution',
        value: data.resolution,
        options: $dict_map.resolution,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: 'radio',
        label: '字体指纹',
        name: 'fontType',
        value: data.fontType ?? true,
        options: [
          { label: '随机', value: true },
          { label: '系统默认', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'WebRTC',
        name: 'webRTC',
        value: data.webRTC ?? 0,
        options: [
          { label: '替换', value: 0 },
          { label: '真实', value: 1 },
          { label: '禁止', value: 2 },
        ],
      },
      {
        type: 'radio',
        label: 'WebGL图像',
        name: 'webGL',
        value: data.webGL ?? true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'WebGL Info',
        name: 'webGLInfo',
        value: data.webGLInfo ?? false,
        options: [
          { label: '真实', value: true },
          { label: '自定义', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(
            inputs,
            ['webGLManufacturer', 'webGLRender'],
            self.value === false,
          )
        },
      },
      {
        type: 'text',
        label: 'WebGL厂商',
        name: 'webGLManufacturer',
        value: data.webGLManufacturer,
        icon: 'mdi mdi-shuffle-variant',
        disabled: true,
        visible: true,
        iconClick: () => {
          getUaWebgl(inputsGroup)
        },
      },
      {
        type: 'textarea',
        label: 'WebGL渲染',
        name: 'webGLRender',
        value: data.webGLRender,
        rows: 3,
        icon: 'mdi mdi-shuffle-variant',
        disabled: true,
        visible: true,
        iconClick: () => {
          getUaWebgl(inputsGroup)
        },
      },
      {
        type: 'radio',
        label: 'WebGpu',
        name: 'webGpu',
        value: data.webGpu ?? 'webgl',
        options: [
          { label: '基于WebGL匹配', value: 'webgl' },
          { label: '真实', value: 'real' },
          { label: '禁用', value: 'block' },
        ],
      },
      {
        type: 'radio',
        label: 'canvas',
        name: 'canvas',
        value: data.canvas ?? true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'AudioContext',
        name: 'audioContext',
        value: data.audioContext ?? true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'Speech Voices',
        name: 'speechVoices',
        value: data.speechVoices ?? true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'Do Not Track',
        name: 'doNotTrack',
        value: data.doNotTrack ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'ClientRects',
        name: 'clientRects',
        value: data.clientRects ?? true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false },
        ],
      },
      {
        type: 'radio',
        label: '媒体设备',
        name: 'deviceInfo',
        value: data.deviceInfo ?? true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false },
        ],
      },
      {
        type: 'radio',
        label: '设备名称',
        name: 'deviceNameSwitch',
        value: data.deviceNameSwitch ?? false,
        options: [
          { label: '随机', value: false },
          { label: '真实', value: true },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'deviceName', self.value === false)
        },
      },
      {
        type: 'text',
        label: ' ',
        name: 'deviceName',
        value: data.deviceName,
        icon: 'mdi mdi-shuffle-variant',
        disabled: true,
        visible: true,
        iconClick: (self: any) => {
          getDeviceName(inputsGroup).then(({ data }) => {
            self.value = data.deviceName
          })
        },
      },
      {
        type: 'radio',
        label: 'MAC地址',
        name: 'macInfo',
        value: data.macInfo ?? false,
        options: [
          { label: '真实', value: true },
          { label: '自定义', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'macAddr', self.value === false)
        },
      },
      {
        type: 'text',
        label: '#x 2',
        name: 'macAddr',
        value: data.macAddr,
        icon: 'mdi mdi-shuffle-variant',
        disabled: true,
        visible: true,
        iconClick: (_self: any) => {
          // getMacAddr(inputsGroup).then(({ data }) => {
          //   self.value = data.deviceName
          // })
        },
      },
      {
        type: 'select',
        label: '硬件并发数',
        placeholder: '请选择硬件并发数',
        name: 'hardwareConcurrent',
        value: data.hardwareConcurrent,
        options: $dict_map.hardwareConcurrent,
      },
      {
        type: 'select',
        label: '设备内存',
        placeholder: '请选择设备内存',
        name: 'deviceMemory',
        value: data.deviceMemory,
        options: $dict_map.deviceMemory,
      },
      {
        type: 'radio',
        label: 'SSL指纹设置',
        name: 'disableSsl',
        value: data.disableSsl ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'disableSslList', self.value === true)
        },
      },
      {
        type: 'select',
        label: '#x 5',
        placeholder: '选择SSL指纹设置',
        name: 'disableSslList',
        value: $dict_map.disableSslList[0],
        options: $dict_map.disableSslList,
        visible: true,
        formatValue: (self: any) => {
          return [self.value]
        },
      },
      {
        type: 'radio',
        label: '端口扫描保护',
        name: 'portScanProtect',
        value: data.portScanProtect ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, 'portScanList', self.value === true)
        },
      },
      {
        type: 'text',
        label: '扫描白名单',
        name: 'portScanList',
        value: data.portScanList,
        placeholder: '输入整数，多个用英文逗号隔开',
        visible: false,
      },
      {
        type: 'radio',
        label: '硬件加速模式',
        name: 'useGpu',
        value: data.useGpu ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '禁用沙盒',
        name: 'sandboxPermission',
        value: data.sandboxPermission ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'text',
        label: '启动参数',
        name: 'startupParam',
        value: data.startupParam,
        placeholder: '浏览器启动参数,如 --mute,多个参数以英文逗号分隔',
      },
    ],
    [
      {
        type: 'radio',
        label: '窗口名称',
        name: 'isDisplayName',
        value: data.isDisplayName ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步书签',
        name: 'syncBookmark',
        value: data.syncBookmark ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步历史记录',
        name: 'syncHistory',
        value: data.syncHistory ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步标签页',
        name: 'syncTab',
        value: data.syncTab ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步Cookie',
        name: 'syncCookie',
        value: data.syncCookie ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步扩展应用程序',
        name: 'syncExtensions',
        value: data.syncExtensions ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步已保存的用户名密码',
        name: 'syncPassword',
        value: data.syncPassword ?? true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步IndexedDB',
        name: 'syncIndexedDb',
        value: data.syncIndexedDb ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '同步Local Storage',
        name: 'syncLocalStorage',
        value: data.syncLocalStorage ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '启动浏览器前删除缓存文件',
        name: 'clearCacheFile',
        value: data.clearCacheFile ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '启动浏览器前删除Cookie',
        name: 'clearCookie',
        value: data.clearCookie ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '启动浏览器时随机指纹',
        name: 'randomFingerprint',
        value: data.randomFingerprint ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '弹出保存密码提示',
        name: 'forbidSavePassword',
        value: data.forbidSavePassword ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: '网络不通停止打开',
        name: 'stopOpenNet',
        value: data.stopOpenNet ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'IP发生变化停止打开',
        name: 'stopOpenIP',
        value: data.stopOpenIP ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
      {
        type: 'radio',
        label: 'IP对应国家 / 地区发生改变停止打开',
        name: 'stopOpenPosition',
        value: data.stopOpenPosition ?? false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false },
        ],
      },
    ],
  ])

  return inputsGroup
}

export function getDefaultValue(data: any = {}) {
  return {
    openMult: data.openMult ?? true,
    clearHistory: data.clearHistory ?? false,
    allowRunApplication: data.allowRunApplication ?? true,
    ignoreHttpsError: data.ignoreHttpsError ?? false,
    webGLMeta: data.webGLMeta ?? true,
    enablePlugin: data.enablePlugin ?? false,
    enablePluginList: data.enablePluginList ?? [],
    mediaDevice: data.mediaDevice ?? false,
  }
}
