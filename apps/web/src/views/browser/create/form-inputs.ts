import { API } from '/@/api'
import { $t } from '/@/locales'
import { checkCookieFormat, createDefaultObject, filterFieldByValue, getFormDataByList, getRandomInt, getUserAgentOs, initInputVisible, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData, setInputVisible } from '/@/utils'
import { getCanvasContextNoiseValue, getClientRectsValue, getRandomFonts, getSpeechSynthesis, getwebGLNoiseValue } from './utils'

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
    ? API.window.userGetMacAddrV2List(params)
    : window.electronAPI.send('app:getMacAddress').then(res => ({ data: [{ macAddr: res }] }))
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
      font: fontType ? await getRandomFonts() : null,
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
      lastCountry: data.lastCountry, // 出口国家
      lastCity: data.lastCity, // 出口城市
    }]
    : []

  const inputsGroup: any = []

  const original = reactive({
    ...getDefaultValue(),
    ...data,
  })

  const windowInputs = reactive([
    {
      label: $t('Profile ID'),
      value: data.dirId,
      visible: !!data.dirId,
      slot: 'profileId',
    },
    {
      label: $t('System'),
      items: [
        {
          type: 'select',
          placeholder: `${$t('Please Enter The')} ${$t('System')}`,
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
            label: $t('System'),
          },
          required: true,
        },
        {
          type: 'select',
          placeholder: `${$t('Please Enter The')} ${$t('System')} ${$t('Version')}`,
          name: 'osVersion',
          value: osVersion[userOs]?.find((item: any) => item.value === data.osVersion) ?? osVersion[userOs]?.[0],
          options: osVersion[userOs],
          required: true,
        },
      ],
      slot: 'system', // items 特殊实现
    },
    {
      type: 'select',
      label: $t('Kernel'),
      placeholder: `${$t('Please Enter The')} ${$t('Kernel')}`,
      name: 'coreVersion',
      value: $dict_map.coreVersion.find((item: any) => item.value === data.coreVersion) ?? $dict_map.coreVersion[0],
      options: $dict_map.coreVersion,
      icon: 'base/rx_ic_chrome',
      required: true,
    },
    {
      type: 'textarea',
      label: $t('User-Agent'),
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
      label: $t('Proxy(Direct)'),
      name: 'proxyInfoList',
      value: proxyInfoList,
      formatValue: (input: any, _inputs: any, formData: any) => {
        const { id, ...value } = input.value[0] || {
          ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'], ''),
          moduleId: 0, // 删除代理库关联 id
          proxyCategory: 'noproxy', // 删除代理时要手动标记直连
        }
        Object.assign(formData, { ...value, moduleId: id, proxyMethod: id ? 'choose' : 'custom' })// 赋值给表单，批量创建这一行创建的值会无视（以上字段为空则代表删除代理）
        return input.value.map(({ _proxyCount, ...item }: any) => Array.from({ length: _proxyCount }, () => ({ ...item, proxyMethod: item.id ? 'choose' : 'custom' }))).flat()
      },
      slot: 'proxy',
    },
    {
      separator: true,
    },
    {
      label: $t('Accounts'),
      name: 'windowPlatformList',
      value: data.windowPlatformList ?? [],
      formatValue: (input: any, _inputs: any, formData: any) => {
        const platformUrlIds = input.value.map((item: any) => item.id).filter(Boolean)
        Object.assign(formData, { platformUrlIds })// 关联账号库选择的账号id
        return input.value.filter((item: any) => !item.id)// 过滤需要关联的账号
      },
      slot: 'accounts',
    },
    {
      label: $t('URLs'),
      name: 'defaultOpenUrl',
      value: data.defaultOpenUrl ?? [],
      tooltip: 'man!',
      slot: 'urls',
    },
    {
      type: 'textarea',
      label: $t('Cookies'),
      placeholder: 'Paste your cookies with JSON format',
      name: 'cookie',
      value: data.cookies,
      icon: 'base/rx_ic_attachment',
      errorMsg: 'Invalid cookie format',
      autoResize: false,
      formatValue: (input: any) => {
        return input.value ? JSON.parse(input.value) : []
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
      label: $t('language'),
      name: 'isLanguageBaseIp',
      value: data.isLanguageBaseIp ?? true,
      options: [
        { label: $t('follow Ip'), value: true },
        { label: $t('custom'), value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'language', input.value === false)
      },
      preview: {
        label: $t('language'),
      },
    },
    {
      type: 'select',
      label: ' ',
      name: 'language',
      value: $dict_map.language?.find((item: any) => item.value === data.language) ?? $dict_map.language[0],
      options: $dict_map.language,
      virtualScrollerOptions: { itemSize: 38 },
      visible: initInputVisible(data.isLanguageBaseIp, false, false),
    },
    {
      type: 'radio',
      label: $t('language interface'),
      name: 'isDisplayLanguageBaseIp',
      value: data.isDisplayLanguageBaseIp ?? true,
      options: [
        { label: $t('follow Ip'), value: true },
        { label: $t('custom'), value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'displayLanguage', input.value === false)
      },
    },
    {
      type: 'select',
      label: ' ',
      name: 'displayLanguage',
      value: $dict_map.language?.find((item: any) => item.value === data.displayLanguage) ?? $dict_map.language[0],
      options: $dict_map.language,
      virtualScrollerOptions: { itemSize: 38 },
      visible: initInputVisible(data.isDisplayLanguageBaseIp, false, false),
    },
    {
      type: 'radio',
      label: $t('time zone'),
      name: 'isTimeZone',
      value: data.isTimeZone ?? true,
      options: [
        { label: $t('follow Ip'), value: true },
        { label: $t('custom'), value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'timeZone', input.value === false)
      },
      preview: {
        label: $t('time zone'),
      },
    },
    {
      type: 'select',
      label: ' ',
      name: 'timeZone',
      value: $dict_map.timeZone?.find((item: any) => item.value === data.timeZone) ?? $dict_map.timeZone[0],
      options: $dict_map.timeZone,
      virtualScrollerOptions: { itemSize: 38 },
      visible: initInputVisible(data.isTimeZone, false, false),
    },
    {
      type: 'radio',
      label: $t('geographical tip'),
      name: 'position',
      value: data.position ?? 1,
      options: [
        { label: $t('ask'), value: 0 },
        { label: $t('allow'), value: 1 },
        { label: $t('disable'), value: 2 },
      ],
      change(input: any, inputs: any) {
        const ipt = inputs.find((ipt: any) => ipt.name === 'isPositionBaseIp')
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
        label: $t('geographical tip'),
      },
    },
    {
      type: 'radio',
      label: $t('geographical'),
      name: 'isPositionBaseIp',
      value: data.isPositionBaseIp ?? true,
      options: [
        { label: $t('follow Ip'), value: true },
        { label: $t('custom'), value: false },
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
        label: $t('geographical'),
      },
    },
    {
      type: 'text',
      label: $t('longitude'),
      placeholder: `${$t('example')}: -40.123`,
      name: 'longitude',
      value: data.longitude,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
    },
    {
      type: 'text',
      label: $t('latitude'),
      placeholder: `${$t('example')}: 30.123`,
      name: 'latitude',
      value: data.latitude,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
    },
    {
      type: 'text',
      label: $t('precision(metre)'),
      placeholder: `${$t('range')}: 10-5000`,
      name: 'precisionPos',
      value: data.precisionPos,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
    },
    {
      type: 'radio',
      label: $t('audio'),
      name: 'forbidAudio',
      value: data.forbidAudio ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('image'),
      name: 'forbidImage',
      value: data.forbidImage ?? true,
      options: [
        { label: $t('load'), value: true },
        { label: $t('ban'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('video'),
      name: 'forbidMedia',
      value: data.forbidMedia ?? true,
      options: [
        { label: $t('allow'), value: true },
        { label: $t('ban'), value: false },
      ],
    },
    {
      label: $t('window size'),
      items: [
        {
          type: 'text',
          placeholder: `${$t('Please Enter The')} ${$t('width')}`,
          name: 'openWidth',
          value: data.openWidth ?? 1000,
        },
        {
          type: 'text',
          placeholder: `${$t('Please Enter The')} ${$t('height')}`,
          name: 'openHeight',
          value: data.openHeight ?? 1000,
        },
      ],
      slot: 'windowSize',
    },
  ])

  const highLevelInputs = reactive([
    {
      type: 'radio',
      label: $t('resolution'),
      name: 'resolutionType',
      value: data.resolutionType ?? false,
      options: [
        { label: $t('follow system'), value: false },
        { label: $t('custom'), value: true },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'resolution', input.value === true)
      },
      preview: {
        label: $t('resolution'),
      },
    },
    {
      type: 'select',
      label: $t('resolution value'),
      placeholder: `${$t('Please Enter The')} ${$t('resolution')}`,
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
      visible: initInputVisible(data.resolutionType, true, false),
    },
    {
      type: 'radio',
      label: $t('font'),
      name: 'fontType',
      value: data.fontType ?? false,
      options: [
        { label: $t('random'), value: true },
        { label: $t('follow system'), value: false },
      ],
      preview: {
        label: $t('font'),
      },
      change: async (input: any) => {
        if (input.value) {
          Object.assign(original, { font: await getRandomFonts() })
        }
        else {
          Reflect.deleteProperty(original, 'font')
        }
      },
    },
    {
      type: 'radio',
      label: 'WebRTC',
      name: 'webRTC',
      value: data.webRTC ?? 2,
      options: [
        { label: $t('replace'), value: 0 },
        { label: $t('reality'), value: 1 },
        { label: $t('ban'), value: 2 },
      ],
      preview: {
        label: 'WebRTC',
      },
    },
    {
      type: 'radio',
      label: $t('WebGL image'),
      name: 'webGL',
      value: data.webGL ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      preview: {
        label: $t('WebGL image'),
      },
      change: async (input: any) => {
        if (input.value) {
          Object.assign(original, { webGLValue: getwebGLNoiseValue() })
        }
        else {
          Reflect.deleteProperty(original, 'webGLValue')
        }
      },
    },
    {
      type: 'radio',
      label: $t('WebGL Info'),
      name: 'webGLInfo',
      value: data.webGLInfo ?? true,
      options: [
        { label: $t('reality'), value: false },
        { label: $t('custom'), value: true },
      ],
      change(input: any, inputs: any) {
        setInputVisible(
          inputs,
          ['webGLManufacturer', 'webGLRender'],
          input.value === true,
        )
      },
      preview: {
        label: $t('WebGL Info'),
      },
    },
    {
      type: 'text',
      label: $t('WebGL manufacturer'),
      name: 'webGLManufacturer',
      value: data.webGLManufacturer,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: initInputVisible(data.webGLInfo, true, true),
      iconClick: () => {
        setUaWebgl(inputsGroup)
      },
    },
    {
      type: 'textarea',
      label: $t('WebGL render'),
      name: 'webGLRender',
      value: data.webGLRender,
      rows: 3,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: initInputVisible(data.webGLInfo, true, true),
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
        { label: $t('based on webgl matching'), value: 'webgl' },
        { label: $t('reality'), value: 'real' },
        { label: $t('disable'), value: 'block' },
      ],
    },
    {
      type: 'radio',
      label: 'Canvas',
      name: 'canvas',
      value: data.canvas ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      preview: {
        label: $t('Canvas'),
      },
      change: async (input: any) => {
        if (input.value) {
          Object.assign(original, { canvasValue: getCanvasContextNoiseValue() })
        }
        else {
          Reflect.deleteProperty(original, 'canvasValue')
        }
      },
    },
    {
      type: 'radio',
      label: $t('AudioContext'),
      name: 'audioContext',
      value: data.audioContext ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      preview: {
        label: $t('AudioContext'),
      },
      change: async (input: any) => {
        if (input.value) {
          Object.assign(original, { audioContextValue: getwebGLNoiseValue() })
        }
        else {
          Reflect.deleteProperty(original, 'audioContextValue')
        }
      },
    },
    {
      type: 'radio',
      label: $t('Speech Voices'),
      name: 'speechVoices',
      value: data.speechVoices ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      preview: {
        label: $t('Speech Voices'),
      },
      change: async (input: any) => {
        if (input.value) {
          Object.assign(original, { speechVoicesValue: { enable: true, voices: getSpeechSynthesis() } })
        }
        else {
          Reflect.deleteProperty(original, 'speechVoicesValue')
        }
      },
    },
    {
      type: 'radio',
      label: $t('Do Not Track'),
      name: 'doNotTrack',
      value: data.doNotTrack ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
      preview: {
        label: $t('Do Not Track'),
      },
    },
    {
      type: 'radio',
      label: $t('Client Rects'),
      name: 'clientRects',
      value: data.clientRects ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      preview: {
        label: $t('Client Rects'),
      },
      change: async (input: any) => {
        if (input.value) {
          Object.assign(original, { clientRectsValue: { enable: true, ...getClientRectsValue() } })
        }
        else {
          Reflect.deleteProperty(original, 'clientRectsValue')
        }
      },
    },
    {
      type: 'radio',
      label: $t('Media Device'),
      name: 'deviceInfo',
      value: data.deviceInfo ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      preview: {
        label: $t('Media Device'),
      },
    },
    {
      type: 'radio',
      label: $t('Device Name'),
      name: 'deviceNameSwitch',
      value: data.deviceNameSwitch ?? true,
      options: [
        { label: $t('random'), value: true },
        { label: $t('reality'), value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'deviceName', input.value === true)
      },
      preview: {
        label: $t('Device Name'),
      },
    },
    {
      type: 'text',
      label: ' ',
      name: 'deviceName',
      value: data.deviceName,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: initInputVisible(data.deviceNameSwitch, true, true),
      iconClick: () => {
        setDeviceName(inputsGroup)
      },
    },
    {
      type: 'radio',
      label: $t('MAC Address'),
      name: 'macInfo',
      value: data.macInfo ?? true,
      options: [
        { label: $t('reality'), value: false },
        { label: $t('custom'), value: true },
      ],
      change(input: any, inputs: any) {
        const showMacAddr = input.value === true
        setInputVisible(inputs, 'macAddr', showMacAddr)
        if (showMacAddr) {
          setMacAddr(inputsGroup)
        }
      },
      preview: {
        label: $t('MAC Address'),
      },
    },
    {
      type: 'text',
      label: ' ',
      name: 'macAddr',
      value: data.macAddr,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: initInputVisible(data.macInfo, true, true),
      iconClick: () => {
        setMacAddr(inputsGroup)
      },
    },
    {
      type: 'select',
      label: $t('Hardware concurrency'),
      placeholder: `${$t('Please Enter The')} ${$t('hardware concurrency')}`,
      name: 'hardwareConcurrent',
      value: $dict_map.hardwareConcurrent.find((item: any) => item.value === (data.hardwareConcurrent ?? '4')),
      options: $dict_map.hardwareConcurrent,
      preview: {
        label: $t('Hardware concurrency'),
      },
    },
    {
      type: 'select',
      label: $t('Device Memory'),
      placeholder: `${$t('Please Enter The')} ${$t('Device Memory')}`,
      name: 'deviceMemory',
      value: $dict_map.deviceMemory.find((item: any) => item.value === (data.deviceMemory ?? '8')),
      options: $dict_map.deviceMemory,
      preview: {
        label: $t('Device Memory'),
      },
    },
    {
      type: 'radio',
      label: $t('SSL setting'),
      name: 'disableSsl',
      value: data.disableSsl ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'disableSslList', input.value === true)
      },
      preview: {
        label: $t('SSL setting'),
      },
    },
    {
      type: 'multiSelect',
      label: ' ',
      placeholder: $t('Disabled SSL features'),
      name: 'disableSslList',
      value: data.disableSslList ?? [],
      options: $dict_map.disableSslList,
      display: 'chip',
      optionLabel: 'label',
      optionValue: 'value',
      filter: true,
      maxSelectedLabels: 1,
      visible: initInputVisible(data.disableSsl, true, false),
    },
    {
      type: 'radio',
      label: $t('Port scan protection'),
      name: 'portScanProtect',
      value: data.portScanProtect ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
      change(input: any, inputs: any) {
        setInputVisible(inputs, 'portScanList', input.value === true)
      },
      preview: {
        label: $t('Port scan protection'),
      },
    },
    {
      type: 'text',
      label: $t('Scan whitelist'),
      name: 'portScanList',
      value: data.portScanList,
      placeholder: 'input integer comma separated',
      visible: initInputVisible(data.portScanProtect, true, true),
    },
    {
      type: 'radio',
      label: $t('Hardware acceleration'),
      name: 'useGpu',
      value: data.useGpu ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
      preview: {
        label: $t('Hardware acceleration'),
      },
    },
    {
      type: 'radio',
      label: $t('Disable Sandbox'),
      name: 'sandboxPermission',
      value: data.sandboxPermission ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'text',
      label: $t('startup parameter'),
      name: 'startupParam',
      value: data.startupParam,
      placeholder: 'Browser startup parameters; example: --mute; multiple parameters separated by commas',
    },
  ])

  const otherInputs = reactive([
    {
      type: 'radio',
      label: $t('Window Name'),
      name: 'isDisplayName',
      value: data.isDisplayName ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync Bookmark'),
      name: 'syncBookmark',
      value: data.syncBookmark ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync History'),
      name: 'syncHistory',
      value: data.syncHistory ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync Tab'),
      name: 'syncTab',
      value: data.syncTab ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync cookie'),
      name: 'syncCookie',
      value: data.syncCookie ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync Extensions'),
      name: 'syncExtensions',
      value: data.syncExtensions ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync Password'),
      name: 'syncPassword',
      value: data.syncPassword ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync IndexedDb'),
      name: 'syncIndexedDb',
      value: data.syncIndexedDb ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Sync LocalStorage'),
      name: 'syncLocalStorage',
      value: data.syncLocalStorage ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Delete cache files before start'),
      name: 'clearCacheFile',
      value: data.clearCacheFile ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Delete cookie before start'),
      name: 'clearCookie',
      value: data.clearCookie ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Delete LocalStorage before start'),
      name: 'clearLocalStorage',
      value: data.clearLocalStorage ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Random fingerprint when starting'),
      name: 'randomFingerprint',
      value: data.randomFingerprint ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Save password prompt'),
      name: 'forbidSavePassword',
      value: data.forbidSavePassword ?? true,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Stop opening due to network failure'),
      name: 'stopOpenNet',
      value: data.stopOpenNet ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Stop opening due to ip changed'),
      name: 'stopOpenIP',
      value: data.stopOpenIP ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('Stop opening due to The country/region corresponding to the IP has changed'),
      name: 'stopOpenPosition',
      value: data.stopOpenPosition ?? false,
      options: [
        { label: $t('open'), value: true },
        { label: $t('closure'), value: false },
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
    disableSslList: [],
  }
}
