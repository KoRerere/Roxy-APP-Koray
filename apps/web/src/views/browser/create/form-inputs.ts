import { API } from '/@/api'
import { checkCookieFormat, createDefaultObject, filterFieldByValue, getFormDataByList, getRandomInt, getUserAgentOs, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData, setInputVisible } from '/@/utils'
import { getCanvasContextNoiseValue, getClientRectsValue, getSpeechSynthesis, getwebGLNoiseValue } from './utils'

async function setUaWebgl(inputsGroup: any) {
  const { os, osVersion, coreVersion } = getFormDataByList(inputsGroup)
  const { data } = await getUaWebgl({ os, osVersion, coreVersion, count: 1 })
  setInputValueByFormData(inputsGroup, data[0])
}

async function setDeviceName(inputsGroup: any) {
  const { os } = getFormDataByList(inputsGroup)
  const { data } = await getDeviceName({ os, count: 1 })
  setInputValueByFormData(inputsGroup, data[0])
}

async function setMacAddr(inputsGroup: any) {
  const { macInfo } = getFormDataByList(inputsGroup)
  const { data } = await getMacAddr({ macInfo, count: 1 })
  setInputValueByFormData(inputsGroup, data[0])
}

function getUaWebgl(params: any) {
  return API.window.userGetUaWebglV2List(params)
}

function getDeviceName(params: any) {
  return API.window.userGetDeviceNameV2List(params)
}

function getMacAddr(params: any) {
  return params.macInfo
    ? window.electronAPI.send('app:getMacAddress').then(res => ({ data: [{ macAddr: res }] }))
    : API.window.userGetMacAddrV2List(params)
}

export async function ceateRandomFinger(inupts: any, count: number = 1) {
  const { fontType, canvas, webGL, audioContext, speechVoices, clientRects, macInfo, os, osVersion, coreVersion } = getFormDataByList(inupts)

  const fingerDetail = await Promise.all(Array.from({ length: count }, async () => {
    return filterFieldByValue({
      mediaDevice: false, // 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，必传
      mediaDeviceList: [
        {
          deviceType: 'audioinput',
          deviceId: '',
          label: '',
          groupId: '',
        },
      ], // 【页面不显示】，媒体设备列表，指纹会用到，需要前端生成，List格式，必传
      font: fontType ? (await electronAPI.send('util:genRandomFonts')).join(';') : null,
      canvasValue: canvas ? getCanvasContextNoiseValue() : null,
      canvasContextNoiseValueV2: getRandomInt(1000, 99999), // 1000-99999 之间的随机整数
      webGLValue: webGL ? getwebGLNoiseValue() : null,
      audioContextValue: audioContext ? getwebGLNoiseValue() : null,
      speechVoicesValue: speechVoices ? { enable: true, voices: getSpeechSynthesis() } : null,
      clientRectsValue: clientRects ? { enable: true, ...getClientRectsValue() } : null,
    }, value => value !== null) // 跟随老版本逻辑过滤没有值的属性
  }))

  await Promise.all([
    getUaWebgl({ os, osVersion, coreVersion, count }),
    getDeviceName({ os, count }),
    getMacAddr({ macInfo, count }),
  ]).then(([{ data: uaWebgl }, { data: deviceName }, { data: macAddr }]) => {
    setInputValueByFormData(inupts, { ...uaWebgl[0], ...deviceName[0], ...macAddr[0] })// 批量创建时用于界面显示

    uaWebgl.forEach(async (item, index) => {
      const formData = { ...item, ...deviceName[index], ...macAddr[index] }
      Object.assign(fingerDetail[index], formData)
    })
  })
  return fingerDetail
}

export function getInputsGroup(data: any = {}) {
  const os_map = {
    windows: 'platforms/rx_os_windows',
    linux: 'base/logo',
    macos: 'platforms/rx_os_macOS',
    android: 'platforms/rx_os_android',
    ios: 'platforms/rx_os_iOS',
  } as const

  const userOs = (data?.os || getUserAgentOs()).toLocaleLowerCase()

  const $dict_map = new Proxy(JSON.parse(localStorage.getItem('$dict_map') ?? '{}'), {
    get(target, key) {
      return target[key] || [] // 简易兜底处理，后续优化获取字典逻辑
    },
  })

  const os = $dict_map.os.map(({ label, ...item }: any) => ({ ...item, label, icon: os_map[(label.toLocaleLowerCase()) as keyof typeof os_map] }))

  const osVersion = Object.fromEntries(Object.keys(os_map).map((key: string) => {
    const version = $dict_map[`osversion_${key}`].map((item: any) => ({ ...item, label: `${key} ${item.label}` }))
    return [key, version]
  }))

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

  const inputsGroup: any = []

  const original = reactive({
    ...getDefaultValue(),
    ...data,
  })

  const windowInputs = reactive([
    {
      label: '系统选择',
      slot: 'System', // items 特殊实现
      items: [
        {
          type: 'select',
          placeholder: '请选择系统',
          name: 'os',
          value: os.find((item: any) => item.value.toLocaleLowerCase() === userOs),
          options: os,
          change: async (item: any, items: any) => {
            const osVersionInput = items.find((item: any) => item.name === 'osVersion')
            if (item.value) {
              const osVersionOptions = osVersion[item.value.value.toLocaleLowerCase()]
              osVersionInput.value = osVersionOptions[0]
              osVersionInput.options = osVersionOptions
              osVersionInput.disabled = false
              const fingerData = await ceateRandomFinger(inputsGroup)
              Object.assign(original, fingerData[0])
            }
            else {
              osVersionInput.value = null
              osVersionInput.options = []
              osVersionInput.disabled = true
            }
          },
          preview: {
            label: '操作系统',
          },
          required: true,
        },
        {
          type: 'select',
          placeholder: '请选择版本',
          name: 'osVersion',
          value: osVersion[userOs]?.find((item: any) => item.value === data.osVersion) ?? osVersion[userOs]?.[0],
          options: osVersion[userOs],
          required: true,
        },
      ],
    },
    {
      type: 'select',
      label: '浏览器内核',
      placeholder: '请选择浏览器内核',
      name: 'coreVersion',
      value: $dict_map.coreVersion.find((item: any) => item.value === data.coreVersion) ?? $dict_map.coreVersion[0],
      options: $dict_map.coreVersion,
      icon: 'base/rx_ic_chrome',
      required: true,
    },
    {
      type: 'textarea',
      label: 'User-Agent',
      placeholder: '请填写ua',
      name: 'userAgent',
      value: data.userAgent,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      iconClick: () => {
        setUaWebgl(inputsGroup)
      },
      preview: {
        label: 'User Agent',
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
      formatValue: (input: any, _inputs: any, formData: any) => {
        const { id, ...value } = input.value[0] || {
          ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'], ''),
          moduleId: 0, // 删除代理库关联 id
          proxyCategory: 'noproxy', // 删除代理时要手动标记直连
        }
        Object.assign(formData, { ...value, moduleId: id, proxyMethod: id ? 'choose' : 'custom' })// 赋值给表单，批量创建这一行创建的值会无视（以上字段为空则代表删除代理）
        return input.value.map(({ _proxyCount, ...item }: any) => Array.from({ length: _proxyCount }, () => ({ ...item, proxyMethod: item.id ? 'choose' : 'custom' }))).flat()
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
      formatValue: (input: any, _inputs: any, formData: any) => {
        const platformUrlIds = input.value.map((item: any) => item.id).filter(Boolean)
        Object.assign(formData, { platformUrlIds })// 关联账号库选择的账号id
        return input.value.filter((item: any) => !item.id)// 过滤需要关联的账号
      },
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
      label: 'Cookies',
      placeholder: 'Paste your cookies with JSON format',
      name: 'cookie',
      value: data.cookies,
      icon: 'base/rx_ic_attachment',
      errorMsg: 'Invalid cookie format',
      autoResize: false,
      formatValue: (input: any) => {
        return input.value
      },
      iconClick: async (input: any) => {
        const res = await readCookiesFile()
        if (res?.data) {
          input.value = res.data
          input.invalid = false
        }
        else {
          input.value = ''
          input.invalid = true
        }
      },
      onBlur(event: any) {
        if (!checkCookieFormat(event.target.value)) {
          setInputFieldByInputKey(windowInputs, 'cookie', 'invalid', true)
        }
      },
    },
  ])

  const basicInputs = reactive([
    {
      type: 'radio',
      label: '语言',
      name: 'isLanguageBaseIp',
      value: data.isLanguageBaseIp ?? true,
      options: [
        { label: '跟随ip匹配', value: true },
        { label: '自定义', value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'language', input.value === false)
      },
      preview: {
        label: '语言',
      },
    },
    {
      type: 'select',
      label: ' ',
      placeholder: '请选择语言',
      name: 'language',
      value: $dict_map.language?.find((item: any) => item.value === data.language),
      options: $dict_map.language,
      virtualScrollerOptions: { itemSize: 38 },
      visible: data.isLanguageBaseIp === false,
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
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'displayLanguage', input.value === false)
      },
    },
    {
      type: 'select',
      label: ' ',
      placeholder: '请选择语言',
      name: 'displayLanguage',
      value: $dict_map.language?.find((item: any) => item.value === data.displayLanguage),
      options: $dict_map.language,
      virtualScrollerOptions: { itemSize: 38 },
      visible: data.isDisplayLanguageBaseIp === false,
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
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'timeZone', input.value === false)
      },
      preview: {
        label: '时区',
      },
    },
    {
      type: 'select',
      label: ' ',
      placeholder: '请选择时区',
      name: 'timeZone',
      value: $dict_map.timeZone?.find((item: any) => item.value === data.timeZone),
      options: $dict_map.timeZone,
      virtualScrollerOptions: { itemSize: 38 },
      visible: data.isTimeZone === false,
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
      change(input: any, inputs: any) {
        const ipt = inputs.find(
          (ipt: any) => ipt.name === 'isPositionBaseIp',
        )
        if (ipt) {
          const visible = input.value !== 2
          ipt.visible = visible
          if (!visible) {
            ipt.value = true
            ipt.change(ipt, inputs)
          }
        }
      },
      preview: {
        label: '地理位置提示',
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
      change(input: any, inputs: any) {
        setInputVisible(
          inputs,
          ['longitude', 'latitude', 'precisionPos'],
          input.value === false,
        )
      },
      preview: {
        label: '地理位置',
      },
    },
    {
      type: 'text',
      label: '经度',
      placeholder: '请填写经度, 示例: -40.123',
      name: 'longitude',
      value: data.longitude,
      visible: data.isPositionBaseIp === false,
    },
    {
      type: 'text',
      label: '纬度',
      placeholder: '请填写纬度, 示例: 30.123',
      name: 'latitude',
      value: data.latitude,
      visible: data.isPositionBaseIp === false,
    },
    {
      type: 'text',
      label: '精度(米)',
      placeholder: '请填写精度, 范围: 10-5000',
      name: 'precisionPos',
      value: data.precisionPos,
      visible: data.isPositionBaseIp === false,
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
      value: data.forbidImage ?? true,
      options: [
        { label: '加载', value: true },
        { label: '禁止', value: false },
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
  ])

  const highLevelInputs = reactive([
    {
      type: 'radio',
      label: '分辨率',
      name: 'resolutionType',
      value: data.resolutionType ?? false,
      options: [
        { label: '跟随电脑', value: false },
        { label: '自定义', value: true },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'resolution', input.value === true)
      },
      preview: {
        label: '分辨率',
      },
    },
    {
      type: 'select',
      label: '分辨率值',
      placeholder: '请选择分辨率',
      name: 'resolution',
      value: data.resolutionX && $dict_map.resolution.find((item: any) => item.value.includes(data.resolutionX) && item.value.includes(data.resolutionY)),
      options: $dict_map.resolution,
      virtualScrollerOptions: { itemSize: 38 },
      formatValue: (input: any, _inputs: any, formData: any) => {
        const [resolutionX, resolutionY] = input.value.value.split('x')
        Object.assign(formData, {
          resolutionX: resolutionX.trim(),
          resolutionY: resolutionY.trim(),
        })
      },
      visible: !!data.resolutionType,
    },
    {
      type: 'radio',
      label: '字体指纹',
      name: 'fontType',
      value: data.fontType ?? false,
      options: [
        { label: '随机', value: true },
        { label: '跟随系统', value: false },
      ],
      preview: {
        label: '字体指纹',
      },
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
      preview: {
        label: 'WebRTC',
      },
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
      preview: {
        label: 'WebGL图像',
      },
    },
    {
      type: 'radio',
      label: 'WebGL Info',
      name: 'webGLInfo',
      value: data.webGLInfo ?? true,
      options: [
        { label: '真实', value: false },
        { label: '自定义', value: true },
      ],
      change(input: any, inputs: any) {
        setInputVisible(
          inputs,
          ['webGLManufacturer', 'webGLRender'],
          input.value === false,
        )
      },
      preview: {
        label: 'WebGL Info',
      },
    },
    {
      type: 'text',
      label: 'WebGL厂商',
      name: 'webGLManufacturer',
      value: data.webGLManufacturer,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: true,
      iconClick: () => {
        setUaWebgl(inputsGroup)
      },
    },
    {
      type: 'textarea',
      label: 'WebGL渲染',
      name: 'webGLRender',
      value: data.webGLRender,
      rows: 3,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: true,
      iconClick: () => {
        setUaWebgl(inputsGroup)
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
      label: 'Canvas',
      name: 'canvas',
      value: data.canvas ?? true,
      options: [
        { label: '随机', value: true },
        { label: '真实', value: false },
      ],
      preview: {
        label: 'Canvas',
      },
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
      preview: {
        label: 'AudioContext',
      },
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
      preview: {
        label: 'SpeechVoices',
      },
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
      preview: {
        label: 'Do Not Track',
      },
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
      preview: {
        label: 'ClientRects',
      },
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
      preview: {
        label: '媒体设备',
      },
    },
    {
      type: 'radio',
      label: '设备名称',
      name: 'deviceNameSwitch',
      value: data.deviceNameSwitch ?? true,
      options: [
        { label: '随机', value: true },
        { label: '真实', value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'deviceName', input.value === false)
      },
      preview: {
        label: '设备名称',
      },
    },
    {
      type: 'text',
      label: ' ',
      name: 'deviceName',
      value: data.deviceName,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: true,
      iconClick: () => {
        setDeviceName(inputsGroup)
      },
    },
    {
      type: 'radio',
      label: 'MAC地址',
      name: 'macInfo',
      value: data.macInfo ?? true,
      options: [
        { label: '真实', value: false },
        { label: '自定义', value: true },
      ],
      change(input: any, inputs: any) {
        const showMacAddr = input.value === false
        setInputVisible(inputs, 'macAddr', showMacAddr)
        if (showMacAddr) {
          setMacAddr(inputsGroup)
        }
      },
      preview: {
        label: 'MAC地址',
      },
    },
    {
      type: 'text',
      label: ' ',
      name: 'macAddr',
      value: data.macAddr,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: true,
      iconClick: () => {
        setMacAddr(inputsGroup)
      },
    },
    {
      type: 'select',
      label: '硬件并发数',
      placeholder: '请选择硬件并发数',
      name: 'hardwareConcurrent',
      value: $dict_map.hardwareConcurrent.find((item: any) => item.value === (data.hardwareConcurrent ?? '4')),
      options: $dict_map.hardwareConcurrent,
      preview: {
        label: '硬件并发数',
      },
    },
    {
      type: 'select',
      label: '设备内存',
      placeholder: '请选择设备内存',
      name: 'deviceMemory',
      value: $dict_map.deviceMemory.find((item: any) => item.value === (data.deviceMemory ?? '8')),
      options: $dict_map.deviceMemory,
      preview: {
        label: '设备内存',
      },
    },
    {
      type: 'radio',
      label: 'SSL指纹设置',
      name: 'disableSsl',
      value: data.disableSsl ?? false,
      options: [
        { label: '开启', value: true },
        { label: '关闭', value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'disableSslList', input.value === true)
      },
      preview: {
        label: 'SSL指纹设置',
      },
    },
    {
      type: 'select',
      label: ' ',
      placeholder: '选择要禁用的SSL特性',
      name: 'disableSslList',
      value: $dict_map.disableSslList.find((item: any) => item.value === data.disableSslList) ?? $dict_map.disableSslList[0],
      options: $dict_map.disableSslList,
      visible: data.disableSsl === true,
      formatValue: (input: any) => {
        return [input.value]
      },
    },
    {
      type: 'radio',
      label: '端口扫描保护',
      name: 'portScanProtect',
      value: data.portScanProtect ?? true,
      options: [
        { label: '开启', value: true },
        { label: '关闭', value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'portScanList', input.value === true)
      },
      preview: {
        label: '端口扫描保护',
      },
    },
    {
      type: 'text',
      label: '扫描白名单',
      name: 'portScanList',
      value: data.portScanList,
      placeholder: '输入整数，多个用英文逗号隔开',
      visible: data.portScanProtect === true,
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
      preview: {
        label: '硬件加速模式',
      },
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
  ])

  const otherInputs = reactive([
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
      label: '启动浏览器前删除Local Storage',
      name: 'clearLocalStorage',
      value: data.clearLocalStorage ?? false,
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
  ])

  inputsGroup.push(...[windowInputs, basicInputs, highLevelInputs, otherInputs])

  return [inputsGroup, original]
}

export function getDefaultValue() {
  // 界面上未显示的数据，跟随旧版本
  return {
    openMult: true,
    clearHistory: false,
    allowRunApplication: true,
    ignoreHttpsError: false,
    webGLMeta: true,
    enablePlugin: false,
    enablePluginList: [],
    mediaDevice: false,
  }
}
