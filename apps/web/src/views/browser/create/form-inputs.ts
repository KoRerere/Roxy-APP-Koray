import { API } from '/@/api'
import { $t } from '/@/locales'
import { checkCookieFormat, createDefaultObject, findInputByName, getDictMap, getFormDataByList, getUserAgentOs, initInputVisible, isEmptyValue, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData, setInputVisible } from '/@/utils'

async function setUaWebgl(inputsGroup: any) {
  const { os, osVersion, coreVersion } = getFormDataByList(inputsGroup)
  const { code, data } = await getUaWebgl({ os, osVersion, coreVersion, count: 1 })
  if (code === 0) {
    setInputValueByFormData(inputsGroup, data[0])
  }
}

async function setDeviceName(inputsGroup: any) {
  const { os } = getFormDataByList(inputsGroup)
  const { code, data } = await getDeviceName({ os, count: 1 })
  if (code === 0) {
    setInputValueByFormData(inputsGroup, data[0])
  }
}

async function setMacAddr(inputsGroup: any) {
  const { macInfo } = getFormDataByList(inputsGroup)
  const { data } = await getMacAddr({ macInfo, count: 1 })
  setInputValueByFormData(inputsGroup, data[0])
}

async function getUaWebgl(params: any) {
  const res = await API.window.userGetUaWebglV2List(params)
  if (res.code !== 0) {
    throw new Error(res.msg)
  }
  return res
}

async function getDeviceName(params: any) {
  const res = await API.window.userGetDeviceNameV2List(params)
  return res
}

function getMacAddr(params: any) {
  return params.macInfo
    ? API.window.userGetMacAddrV2List(params)
    : window.electronAPI.send('app:getMacAddress').then(res => ({ data: [{ macAddr: res }] }))
}

const defaultFingerOptions = {
  count: 1,
  preview: true,
}

export async function ceateRandomFinger(inupts: any, options?: { count?: number, preview?: boolean }) {
  const { fontType, canvas, webGL, audioContext, speechVoices, clientRects, macInfo, os, osVersion, coreVersion } = getFormDataByList(inupts)
  const { count, preview } = { ...defaultFingerOptions, ...options }
  const fingerDetail = await electronAPI.send('util:genRandomFingerprint', {
    fontType,
    canvas,
    webGL,
    audioContext,
    speechVoices,
    clientRects,
    macInfo,
    os,
    osVersion,
    coreVersion,
  }, count)

  if (preview) {
    const { userAgent, webGLManufacturer, webGLRender, macAddr, deviceName } = fingerDetail[0]
    setInputValueByFormData(inupts, { userAgent, webGLManufacturer, webGLRender, macAddr, deviceName })// 批量创建时用于界面显示
  }

  return fingerDetail
}

export async function getInputsGroup(data: any = {}, showToast: any = () => { }) {
  const os_map = {
    windows: 'platforms/rx_os_windows',
    linux: 'base/logo',
    macos: 'platforms/rx_os_macOS',
    android: 'platforms/rx_os_android',
    ios: 'platforms/rx_os_iOS',
  } as const

  const userOs = (data?.os || getUserAgentOs()).toLocaleLowerCase()

  const $dict_map = await getDictMap()

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
      checkChannel: data.checkChannel, // 查询渠道
    }]
    : []

  const inputsGroup: any = []

  const original = reactive({
    ...getDefaultValue(),
    ...data,
  })

  const windowInputs = reactive([
    {
      label: $t('窗口 ID'),
      value: data.dirId,
      visible: !!data.dirId,
      slot: 'profileId',
    },
    {
      label: $t('系统'),
      items: [
        {
          type: 'select',
          name: 'os',
          value: os.find((item: any) => item.value.toLocaleLowerCase() === userOs),
          options: os,
          filter: false,
          change: async (item: any) => {
            const osVersionInput = findInputByName(windowInputs, 'osVersion')
            if (item.value) {
              const osVersionOptions = osVersion[item.value.value.toLocaleLowerCase()]
              osVersionInput.options = osVersionOptions
              osVersionInput.value = osVersionOptions[0]
              osVersionInput.change?.(osVersionInput)
            }
          },
          preview: {
            label: $t('系统'),
          },
          required: true,
        },
        {
          type: 'select',
          name: 'osVersion',
          value: osVersion[userOs]?.find((item: any) => item.value === data.osVersion) ?? osVersion[userOs]?.[0],
          options: osVersion[userOs],
          // 特殊处理，会根据所选系统匹配不同的系统版本，此处用于缓存
          optionGroup: osVersion,
          filter: false,
          change: async (item: any) => {
            const coreVersionInput = windowInputs.find((item: any) => item.name === 'coreVersion')

            if (item.value) {
              const [os, version] = item.value.label.split(' ')
              const coreVersionOptions = os.toLocaleLowerCase() === 'windows' && ['7', '8'].includes(version.at(0))
                ? $dict_map.coreVersion.filter((item: any) => item.value === '109')
                : $dict_map.coreVersion

              if (coreVersionInput!.options.length !== coreVersionOptions.length) {
                coreVersionInput!.options = coreVersionOptions
                coreVersionInput!.value = coreVersionOptions[0]
              }
            }

            coreVersionInput!.change?.(coreVersionInput)
          },
          required: true,
        },
      ],
      slot: 'system', // items 特殊实现
    },
    {
      type: 'select',
      label: $t('内核'),
      name: 'coreVersion',
      value: $dict_map.coreVersion.find((item: any) => item.value === data.coreVersion) ?? $dict_map.coreVersion[0],
      options: $dict_map.coreVersion,
      icon: 'base/rx_ic_chrome',
      iconColor: 'var(--p-primary-color, #12a3fc)',
      required: true,
      filter: false,
      change: async (item: any) => {
        if (item.value) {
          const fingerData = await ceateRandomFinger(inputsGroup)
          Object.assign(original, fingerData[0])
        }
      },
    },
    {
      type: 'textarea',
      label: $t('User-Agent'),
      name: 'userAgent',
      value: data.userAgent,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      rows: 4,
      iconClick: async () => {
        await setUaWebgl(inputsGroup)
        showToast(0, $t('UA刷新成功'))
      },
      preview: {
        label: 'User Agent',
      },
    },
    {
      separator: true,
    },
    {
      label: $t('代理'),
      name: 'proxyInfoList',
      value: proxyInfoList,
      switch: !!proxyInfoList.length,
      formatValue: (input: any, _inputs: any, formData: any) => {
        const { id, ...value } = (input.switch && input.value[0]) || {
          ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'], ''),
          moduleId: 0, // 删除代理库关联 id
          proxyCategory: 'noproxy', // 删除代理时要手动标记直连
        }
        Object.assign(formData, { ...value, moduleId: id, proxyMethod: id ? 'choose' : 'custom' })// 赋值给表单，批量创建这一行创建的值会无视（以上字段为空则代表删除代理）
        return input.switch
          ? input.value.map(({ _proxyCount, ...item }: any) => Array.from({ length: _proxyCount }, () => ({ ...item, proxyMethod: item.id ? 'choose' : 'custom' }))).flat()
          : []
      },
      slot: 'proxy',
    },
    {
      separator: true,
    },
    {
      label: $t('平台账号'),
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
      label: $t('自定义打开 URL'),
      name: 'defaultOpenUrl',
      value: data.defaultOpenUrl ?? [],
      slot: 'urls',
    },
    {
      type: 'textarea',
      label: 'Cookies',
      placeholder: $t('请以 JSON 格式输入 Cookies'),
      name: 'cookie',
      value: isEmptyValue(data?.cookie) ? '' : JSON.stringify(data.cookie, null, 2),
      icon: 'base/rx_ic_attachment',
      errorMsg: 'Invalid cookie format',
      autoResize: false,
      rows: 4,
      formatValue: (input: any) => {
        return input.value ? JSON.parse(input.value) : []
      },
      iconClick: async (input: any) => {
        const res = await readCookiesFile()
        if (res) {
          if (res.data) {
            input.value = res.data
            input.invalid = false
          }
          else {
            input.invalid = true
            input.errorMsg = res.message
          }
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
      label: $t('语言'),
      name: 'isDisplayLanguageBaseIp',
      value: data.isDisplayLanguageBaseIp ?? true,
      options: [
        { label: $t('基于 IP 匹配'), value: true },
        { label: $t('自定义'), value: false },
      ],
      change(input: any) {
        setInputVisible(basicInputs, 'displayLanguage', input.value === false)
      },
      preview: {
        label: $t('语言'),
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
      label: $t('界面语言'),
      name: 'isLanguageBaseIp',
      value: data.isLanguageBaseIp ?? true,
      options: [
        { label: $t('基于 IP 匹配'), value: true },
        { label: $t('自定义'), value: false },
      ],
      change(input: any) {
        setInputVisible(basicInputs, 'language', input.value === false)
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
      label: $t('时区'),
      name: 'isTimeZone',
      value: data.isTimeZone ?? true,
      options: [
        { label: $t('基于 IP 匹配'), value: true },
        { label: $t('自定义'), value: false },
      ],
      change(input: any) {
        setInputVisible(basicInputs, 'timeZone', input.value === false)
      },
      preview: {
        label: $t('时区'),
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
      label: $t('地理位置提示'),
      name: 'position',
      value: data.position ?? 1,
      options: [
        { label: $t('询问'), value: 0 },
        { label: $t('允许'), value: 1 },
        { label: $t('禁止'), value: 2 },
      ],
      change(input: any) {
        const ipt = findInputByName(basicInputs, 'isPositionBaseIp')
        if (ipt) {
          ipt.visible = input.value !== 2
          ipt.change(ipt)
        }
      },
      preview: {
        label: $t('地理位置提示'),
      },
    },
    {
      type: 'radio',
      label: $t('地理位置'),
      name: 'isPositionBaseIp',
      value: data.isPositionBaseIp ?? true,
      options: [
        { label: $t('基于 IP 匹配'), value: true },
        { label: $t('自定义'), value: false },
      ],
      visible: true,
      change(input: any) {
        setInputVisible(basicInputs, ['longitude', 'latitude', 'precisionPos'], input.visible && input.value === false)
      },
      preview: {
        label: $t('地理位置'),
      },
    },
    {
      type: 'text',
      label: $t('经度'),
      placeholder: $t('请填写经度，示例: -40.123'),
      name: 'longitude',
      value: data.longitude,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
    },
    {
      type: 'text',
      label: $t('纬度'),
      placeholder: $t('请填写纬度，示例: 30.123'),
      name: 'latitude',
      value: data.latitude,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
    },
    {
      type: 'text',
      label: $t('精度（米）'),
      placeholder: $t('请填写精度（米），范围: 10-5000'),
      name: 'precisionPos',
      value: data.precisionPos,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
    },
    {
      type: 'radio',
      label: $t('声音'),
      name: 'forbidAudio',
      value: data.forbidAudio ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('图片'),
      name: 'forbidImage',
      value: data.forbidImage ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('视频'),
      name: 'forbidMedia',
      value: data.forbidMedia ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      label: $t('窗口大小'),
      items: [
        {
          type: 'text',
          placeholder: $t('请输入宽度'),
          name: 'openWidth',
          value: data.openWidth ?? 1000,
        },
        {
          type: 'text',
          placeholder: $t('请输入高度'),
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
      label: $t('分辨率'),
      name: 'resolutionType',
      value: data.resolutionType ?? false,
      options: [
        { label: $t('跟随系统'), value: false },
        { label: $t('自定义'), value: true },
      ],
      change(input: any) {
        setInputVisible(highLevelInputs, 'resolution', input.value === true)
      },
      preview: {
        label: $t('分辨率'),
      },
    },
    {
      type: 'select',
      label: $t('分辨率值'),
      placeholder: $t('请选择分辨率'),
      name: 'resolution',
      value: $dict_map.resolution.find((item: any) => item.value === `${data.resolutionX || 1280} x ${data.resolutionY || 720}`),
      options: $dict_map.resolution,
      virtualScrollerOptions: { itemSize: 38 },
      filter: false,
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
      label: $t('字体指纹'),
      name: 'fontType',
      value: data.fontType ?? false,
      options: [
        { label: $t('跟随系统'), value: false },
        { label: $t('随机'), value: true },
      ],
      preview: {
        label: $t('字体指纹'),
      },
      change: async (input: any) => {
        if (input.value) {
          const { genRandomFonts } = await electronAPI.send('util:callRandomFingerprintFunc', {
            genRandomFonts: [],
          })

          Object.assign(original, { font: genRandomFonts.join(';') })
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
        { label: $t('替换'), value: 0 },
        { label: $t('真实'), value: 1 },
        { label: $t('禁止'), value: 2 },
      ],
      preview: {
        label: 'WebRTC',
      },
    },
    {
      type: 'radio',
      label: $t('WebGL 图像'),
      name: 'webGL',
      value: data.webGL ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      preview: {
        label: $t('WebGL 图像'),
      },
      change: async (input: any) => {
        if (input.value) {
          const { getwebGLNoiseValue } = await electronAPI.send('util:callRandomFingerprintFunc', {
            getwebGLNoiseValue: [],
          })
          Object.assign(original, { webGLValue: getwebGLNoiseValue })
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
        { label: $t('真实'), value: false },
        { label: $t('自定义'), value: true },
      ],
      change(input: any) {
        setInputVisible(highLevelInputs, ['webGLManufacturer', 'webGLRender'], input.value === true)
      },
      preview: {
        label: $t('WebGL Info'),
      },
    },
    {
      type: 'text',
      label: $t('WebGL 厂商'),
      name: 'webGLManufacturer',
      value: data.webGLManufacturer,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: initInputVisible(data.webGLInfo, true, true),
      iconClick: async () => {
        await setUaWebgl(inputsGroup)
      },
    },
    {
      type: 'textarea',
      label: $t('WebGL 渲染'),
      name: 'webGLRender',
      value: data.webGLRender,
      rows: 3,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      visible: initInputVisible(data.webGLInfo, true, true),
      iconClick: async () => {
        await setUaWebgl(inputsGroup)
      },
    },
    {
      type: 'radio',
      label: 'WebGpu',
      name: 'webGpu',
      value: data.webGpu ?? 'webgl',
      options: [
        { label: $t('基于WebGL匹配'), value: 'webgl' },
        { label: $t('真实'), value: 'real' },
        { label: $t('禁止'), value: 'block' },
      ],
    },
    {
      type: 'radio',
      label: 'Canvas',
      name: 'canvas',
      value: data.canvas ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      preview: {
        label: 'Canvas',
      },
      change: async (input: any) => {
        if (input.value) {
          const { getCanvasContextNoiseValue } = await electronAPI.send('util:callRandomFingerprintFunc', {
            getCanvasContextNoiseValue: [],
          })
          Object.assign(original, { canvasValue: getCanvasContextNoiseValue })
        }
        else {
          Reflect.deleteProperty(original, 'canvasValue')
        }
      },
    },
    {
      type: 'radio',
      label: 'AudioContext',
      name: 'audioContext',
      value: data.audioContext ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      preview: {
        label: 'AudioContext',
      },
      change: async (input: any) => {
        if (input.value) {
          const { getwebGLNoiseValue } = await electronAPI.send('util:callRandomFingerprintFunc', {
            getwebGLNoiseValue: [],
          })
          Object.assign(original, { audioContextValue: getwebGLNoiseValue })
        }
        else {
          Reflect.deleteProperty(original, 'audioContextValue')
        }
      },
    },
    {
      type: 'radio',
      label: 'Speech Voices',
      name: 'speechVoices',
      value: data.speechVoices ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      preview: {
        label: 'Speech Voices',
      },
      change: async (input: any) => {
        if (input.value) {
          const { getSpeechSynthesis } = await electronAPI.send('util:callRandomFingerprintFunc', {
            getSpeechSynthesis: [],
          })
          Object.assign(original, { speechVoicesValue: { enable: true, voices: getSpeechSynthesis } })
        }
        else {
          Reflect.deleteProperty(original, 'speechVoicesValue')
        }
      },
    },
    {
      type: 'radio',
      label: 'Do Not Track',
      name: 'doNotTrack',
      value: data.doNotTrack ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
      preview: {
        label: 'Do Not Track',
      },
    },
    {
      type: 'radio',
      label: 'Client Rects',
      name: 'clientRects',
      value: data.clientRects ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      preview: {
        label: 'Client Rects',
      },
      change: async (input: any) => {
        if (input.value) {
          const { getClientRectsValue } = await electronAPI.send('util:callRandomFingerprintFunc', {
            getClientRectsValue: [],
          })
          Object.assign(original, { clientRectsValue: { enable: true, ...getClientRectsValue } })
        }
        else {
          Reflect.deleteProperty(original, 'clientRectsValue')
        }
      },
    },
    {
      type: 'radio',
      label: $t('媒体设备'),
      name: 'deviceInfo',
      value: data.deviceInfo ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      preview: {
        label: $t('媒体设备'),
      },
    },
    {
      type: 'radio',
      label: $t('设备名称'),
      name: 'deviceNameSwitch',
      value: data.deviceNameSwitch ?? true,
      options: [
        { label: $t('随机'), value: true },
        { label: $t('真实'), value: false },
      ],
      change(input: any) {
        setInputVisible(highLevelInputs, 'deviceName', input.value === true)
      },
      preview: {
        label: $t('设备名称'),
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
      label: $t('MAC地址'),
      name: 'macInfo',
      value: data.macInfo ?? true,
      options: [
        { label: $t('真实'), value: false },
        { label: $t('自定义'), value: true },
      ],
      change(input: any) {
        const showMacAddr = input.value === true
        setInputVisible(highLevelInputs, 'macAddr', showMacAddr)
        if (showMacAddr) {
          setMacAddr(inputsGroup)
        }
      },
      preview: {
        label: $t('MAC地址'),
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
      label: $t('硬件并发数'),
      name: 'hardwareConcurrent',
      value: $dict_map.hardwareConcurrent.find((item: any) => item.value === (data.hardwareConcurrent ?? '4')),
      options: $dict_map.hardwareConcurrent,
      filter: false,
      preview: {
        label: $t('硬件并发数'),
      },
    },
    {
      type: 'select',
      label: $t('设备内存'),
      name: 'deviceMemory',
      value: $dict_map.deviceMemory.find((item: any) => item.value === (data.deviceMemory ?? '8')),
      options: $dict_map.deviceMemory,
      filter: false,
      preview: {
        label: $t('设备内存'),
      },
    },
    {
      type: 'radio',
      label: $t('SSL指纹设置'),
      name: 'disableSsl',
      value: data.disableSsl ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
      change(input: any) {
        setInputVisible(highLevelInputs, 'disableSslList', input.value === true)
      },
      preview: {
        label: $t('SSL指纹设置'),
      },
    },
    {
      type: 'multiSelect',
      label: ' ',
      placeholder: $t('请选择需要禁用的SSL特性'),
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
      label: $t('端口扫描保护'),
      name: 'portScanProtect',
      value: data.portScanProtect ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
      change(input: any) {
        setInputVisible(highLevelInputs, 'portScanList', input.value === true)
      },
      preview: {
        label: $t('端口扫描保护'),
      },
    },
    {
      type: 'text',
      label: $t('扫描白名单'),
      name: 'portScanList',
      value: data.portScanList,
      placeholder: $t('允许被网站扫描的端口，多个用英文逗号隔开'),
      visible: initInputVisible(data.portScanProtect, true, true),
    },
    {
      type: 'radio',
      label: $t('硬件加速模式'),
      name: 'useGpu',
      value: data.useGpu ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
      preview: {
        label: $t('硬件加速模式'),
      },
    },
    {
      type: 'radio',
      label: $t('禁用沙盒'),
      name: 'sandboxPermission',
      value: data.sandboxPermission ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'text',
      label: $t('启动参数'),
      name: 'startupParam',
      value: data.startupParam,
      placeholder: $t('浏览器启动参数,如 --mute,多个参数以英文逗号分隔'),
    },
  ])

  const otherInputs = reactive([
    {
      type: 'radio',
      label: $t('窗口名称'),
      name: 'isDisplayName',
      value: data.isDisplayName ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步书签'),
      name: 'syncBookmark',
      value: data.syncBookmark ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步历史记录'),
      name: 'syncHistory',
      value: data.syncHistory ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步标签页'),
      name: 'syncTab',
      value: data.syncTab ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步Cookie'),
      name: 'syncCookie',
      value: data.syncCookie ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步扩展应用程序'),
      name: 'syncExtensions',
      value: data.syncExtensions ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步已保存的用户名密码'),
      name: 'syncPassword',
      value: data.syncPassword ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步IndexedDB'),
      name: 'syncIndexedDb',
      value: data.syncIndexedDb ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('同步Local Storage'),
      name: 'syncLocalStorage',
      value: data.syncLocalStorage ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('启动浏览器前删除缓存文件'),
      name: 'clearCacheFile',
      value: data.clearCacheFile ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('启动浏览器前删除Cookie'),
      name: 'clearCookie',
      value: data.clearCookie ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('启动浏览器前删除Local Storage'),
      name: 'clearLocalStorage',
      value: data.clearLocalStorage ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('启动浏览器时随机指纹'),
      name: 'randomFingerprint',
      value: data.randomFingerprint ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('弹出保存密码提示'),
      name: 'forbidSavePassword',
      value: data.forbidSavePassword ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('网络不通停止打开'),
      name: 'stopOpenNet',
      value: data.stopOpenNet ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('IP发生变化停止打开'),
      name: 'stopOpenIP',
      value: data.stopOpenIP ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'radio',
      label: $t('IP对应国家/地区发生改变停止打开'),
      name: 'stopOpenPosition',
      value: data.stopOpenPosition ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
  ])

  inputsGroup.push(...[windowInputs, basicInputs, highLevelInputs, otherInputs])

  return [inputsGroup, original]
}

export function getDefaultValue() {
  // 界面上未显示的数据，以及一些选项关闭后的默认值，跟随旧版本
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
    isPositionBaseIp: true,
  }
}
