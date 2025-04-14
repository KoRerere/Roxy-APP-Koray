import type { UserGetBrowserVersionInfoListParams } from '@roxy/backend-api'
import { API } from '/@/api'
import { UaStrictMode } from '/@/enums'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { checkCookieFormat, createDefaultObject, filterInputsByNames, findInputByName, getDictMap, getFormDataByList, getUserAgentOs, initInputVisible, isEmptyValue, readCookiesFile, setInputFieldByInputKey, setInputValueByFormData, setInputVisible } from '/@/utils'
import { z } from "zod";

const userStore = useUserStore()

async function setUaWebgl(inputsGroup: any) {
  const { os, osVersion, coreVersion, browserVersion } = getFormDataByList(inputsGroup)
  const { code, data } = await getUaWebgl({ os, osVersion, coreVersion, browserVersion, count: 1 })
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

async function getBrowserVersion(params: UserGetBrowserVersionInfoListParams) {
  const { data } = await API.window.userGetBrowserVersionInfoList(params)
  return data.map(item => ({ label: `Chrome ${item.browserVersion}`, value: item.browserVersion }))
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
  const [$dict_map, userConfig, searchEngine] = await Promise.all([
    getDictMap(),
    userStore.getUserConfig(),
    API.platform.userGetSearchEnginesList()
  ])

  const osIconMap = {
    windows: 'platforms/rx_os_windows',
    linux: 'base/logo',
    macos: 'platforms/rx_os_macOS',
    android: 'platforms/rx_os_android',
    ios: 'platforms/rx_os_iOS',
  } as const

  const getCoreVersionOptions = (os: string, version: string) => {
    return os?.toLocaleLowerCase() === 'windows' && ['7', '8'].includes(version?.at(0)!)
      ? $dict_map.coreVersion.filter((item: any) => item.value === '109')// win7，win8 只有 109 内核版本  
      : $dict_map.coreVersion
  }

  const osOptions = $dict_map.os.map(({ label, ...item }: any) => ({
    ...item,
    label,
    icon: osIconMap[(label.toLocaleLowerCase()) as keyof typeof osIconMap],
    _versionOptions: $dict_map[`osversion_${label.toLocaleLowerCase()}`].map((vitem: any) => ({ ...vitem, label: `${label} ${vitem.label}`, _osValue: item.value })),
  }))

  const osValue = osOptions.find((item: any) => item.value.toLocaleLowerCase() === (data?.os || getUserAgentOs()).toLocaleLowerCase())
  const osVersionValue = osValue?._versionOptions.find((item: any) => item.value === data.osVersion) ?? osValue?._versionOptions[0]
  const coreVersionOptions = getCoreVersionOptions(osValue?.value, osVersionValue?.value)

  // TODO:(anbin)
  const searchEngineOptions = searchEngine.code == 0 ?
    (searchEngine.data || []).map(item => ({ label: item.code, value: item.code, image: item.icon })) : []

  const searchEngineValue = data.searchEngine ?? userConfig?.searchEngine

  // 非严格模式获取浏览器版本选项
  const browserVersionOptions = userConfig?.uaModeSwitch === UaStrictMode.close && osValue && osVersionValue
    ? await getBrowserVersion({ os: osValue.value, osVersion: osVersionValue.value })
    : []
  const browserVersionValue = data.browserVersion?.split(',').filter(Boolean) ?? browserVersionOptions.map(item => item.value)

  const proxyInfoKeys = ['host', 'ipType', 'port', 'proxyUserName', 'proxyPassword', 'refreshUrl', 'lastCountry', 'lastCity', 'lastIp']
  const proxyInfoList = data.proxyCategory && data.proxyCategory !== 'noproxy'
    ? [{
      id: data.moduleId,
      proxyCategory: data.proxyCategory,
      checkChannel: data.checkChannel,
      ...Object.fromEntries(proxyInfoKeys.map(key => [key, data[key]])),
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
      label: $t('操作系统'),
      items: [
        {
          type: 'select',
          name: 'os',
          value: osValue,
          options: osOptions,
          filter: false,
          style: {
            width: '66px',
            flex: 'none',
          },
          overlayStyle: {
            width: '120px',
          },
          class: 'items-center',
          change: async (item: any) => {
            const osVersionInput = findInputByName(windowInputs, 'osVersion')
            if (item.value) {
              osVersionInput.options = item.value._versionOptions
              osVersionInput.value = item.value._versionOptions[0]
              osVersionInput.change?.(osVersionInput)
            }
          },
          preview: {
            label: $t('操作系统'),
          },
          required: true,
        },
        {
          type: 'select',
          name: 'osVersion',
          value: osVersionValue,
          options: osValue?._versionOptions,
          filter: false,
          change: async (item: any) => {
            const coreVersionInput = findInputByName(windowInputs, 'coreVersion')
            // windowInputs.find((item: any) => item.name === 'coreVersion')!

            if (item.value) {
              const { _osValue, value: version } = item.value
              const _coreVersionOptions = getCoreVersionOptions(_osValue, version)

              if (coreVersionInput.options?.length !== _coreVersionOptions.length) {
                coreVersionInput.options = _coreVersionOptions
                coreVersionInput.value = _coreVersionOptions[0]
              }

              if (userConfig?.uaModeSwitch === UaStrictMode.close) {
                const options = await getBrowserVersion({ os: _osValue, osVersion: version })
                const browserVersionInput = findInputByName(windowInputs, 'browserVersion')
                browserVersionInput.options = options
                browserVersionInput.value = options.map(item => item.value)
              }
            }

            coreVersionInput.change?.(coreVersionInput)
          },
          required: true,
        },
        {
          type: 'select',
          name: 'coreVersion',
          value: coreVersionOptions.find((item: any) => item.value === data.coreVersion) ?? coreVersionOptions[0],
          options: coreVersionOptions,
          icon: 'base/rx_ic_chrome',
          iconColor: 'var(--p-primary-color, #12a3fc)',
          required: true,
          filter: false,
          change: async (item: any) => {
            if (item.value) {
              await setUaWebgl(inputsGroup)
            }
            if (data.dirId) {
              item.help = data.coreVersion !== item.value.value
                ? $t('修改内核可能导致缓存不兼容，从而使账号登录信息失效，请谨慎操作。')
                : ''
            }
          },
        }
      ],
      slot: 'system', // items 特殊实现
    },
    {
      type: 'multiSelect',
      label: $t('浏览器版本'),
      placeholder: $t('无指定版本，默认使用严格模式'),
      name: 'browserVersion',
      value: browserVersionValue,
      _oldValue: browserVersionValue, // 用于比对数据是否有变化
      options: browserVersionOptions,
      maxSelectedLabels: 4,
      selectedItemsLabel: $t('已选择了 {count} 个浏览器版本', { count: '{()}' }),
      visible: initInputVisible(userConfig?.uaModeSwitch, UaStrictMode.close, false),
      formatValue: (input: any) => input.value.join(','),
      onHide: () => {
        const input = findInputByName(windowInputs, 'browserVersion')
        const isEq = input.value.slice().sort().join(',') === input._oldValue.slice().sort().join(',')
        if (!isEq) {
          input._oldValue = input.value.slice()
          setUaWebgl(inputsGroup)
        }
      },
    },
    {
      type: 'textarea',
      label: $t('User-Agent'),
      name: 'userAgent',
      value: data.userAgent,
      icon: 'base/rx_ic_shuffle',
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
      label: $t('搜索引擎'),
      name: 'searchEngine',
      type: 'select',
      value: searchEngineOptions.find((item: any) => item.value === searchEngineValue) ?? searchEngineOptions[0],
      options: searchEngineOptions,
      filter: false,
      required: true,
      slot: 'searchEngine'
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
          ...createDefaultObject(proxyInfoKeys, ''),
          moduleId: 0, // 删除代理库关联 id
          proxyCategory: 'noproxy', // 删除代理时要手动标记直连
        }
        const proxyData = id ? { moduleId: id, proxyMethod: 'choose' } : { ...value, proxyMethod: 'custom' }
        Object.assign(formData, proxyData)// 赋值给表单，批量创建这一行创建的值会无视（以上字段为空则代表删除代理）

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
      tooltip: $t('打开网站页面优先展示的语言，默认使用 IP 所在地区的语言，也可自定义选择'),
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
      tooltip: $t('Google 界面框架的语言，默认使用 IP 所在地区的语言，也可自定义选择'),
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
        filterInputsByNames(basicInputs, ['longitude', 'latitude', 'precisionPos']).forEach((ipt) => {
          ipt.visible = input.visible && input.value === false

          if (ipt.required && !ipt.value) {
            ipt.invalid = true
            ipt.errorMsg = $t('"{name}" 是必填项', { name: ipt.label })
          }
        })
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
      required: true,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
      onBlur(event: any) {
        let newValue = event.target.value;
        const isValid = z.number().safeParse(Number(newValue));
        if (isValid.success && newValue != '') {
          if (newValue > 180) {
            newValue = 180
          }
          if (newValue < -180) {
            newValue = -180
          }
        } else {
          newValue = ''
          setInputFieldByInputKey(basicInputs, 'longitude', 'invalid', true)
        }
        setInputFieldByInputKey(basicInputs, 'longitude', 'value', newValue)
      },
    },
    {
      type: 'text',
      label: $t('纬度'),
      placeholder: $t('请填写纬度，示例: 30.123'),
      name: 'latitude',
      value: data.latitude,
      required: true,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
      onBlur(event: any) {
        let newValue = event.target.value;
        const isValid = z.number().safeParse(Number(newValue));
        if (isValid.success && newValue != '') {
          if (newValue > 90) {
            newValue = 90
          }
          if (newValue < -90) {
            newValue = -90
          }
        } else {
          newValue = ''
          setInputFieldByInputKey(basicInputs, 'latitude', 'invalid', true)
        }
        setInputFieldByInputKey(basicInputs, 'latitude', 'value', newValue)
      },
    },
    {
      type: 'text',
      label: $t('精度（米）'),
      placeholder: $t('请填写精度（米），范围: 10-5000'),
      name: 'precisionPos',
      value: data.precisionPos,
      visible: initInputVisible(data.isPositionBaseIp, false, false),
      onBlur(event: any) {
        let newValue = event.target.value;
        // 输入的内容如果不是数字，就清空，如果是数字就走下边的校验
        // 不能为空字符
        const isValid = z.number().safeParse(Number(newValue));
        if (isValid.success && newValue != '') {
          if (newValue < 10) {
            newValue = 10
          }
          if (newValue > 5000) {
            newValue = 5000
          }
        } else {
          newValue = ''
        }
        setInputFieldByInputKey(basicInputs, 'precisionPos', 'value', newValue)
      },
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
      change(input: any) {
        setInputVisible(basicInputs, 'forbiddenPictureSize', input.value === false)
      },
    },
    {
      label: ' ',
      name: 'forbiddenPictureSize',
      value: data.forbiddenPictureSize ?? 0,
      visible: initInputVisible(data.forbidImage, false, false),
      slot: 'forbiddenPictureSize',
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
      type: 'radio',
      label: $t('窗口大小'),
      name: 'positionSwitch',
      value: data.positionSwitch ?? true,
      options: [
        { label: $t('自定义'), value: true },
        { label: $t('全屏'), value: false },
      ],
      change(input: any) {
        setInputVisible(basicInputs, ['windowOpenSize', 'windowRatioPosition'], input.value === true)
      },
    },
    {
      label: ' ',
      name: 'windowOpenSize',
      items: [
        {
          type: 'text',
          placeholder: $t('请输入宽度'),
          name: 'openWidth',
          value: data.openWidth ?? '1000',
        },
        {
          type: 'text',
          placeholder: $t('请输入高度'),
          name: 'openHeight',
          value: data.openHeight ?? '1000',
        },
      ],
      visible: initInputVisible(data.positionSwitch, true, true),
      slot: 'windowOpenSize',
    },
    {
      label: $t('窗口位置'),
      name: 'windowRatioPosition',
      value: data.windowRatioPosition || '0,0',
      tooltip: $t('浏览器窗口打开时在屏幕中的初始位置'),
      visible: initInputVisible(data.positionSwitch, true, true),
      slot: 'windowRatioPosition',
    },
    // TODO:(anbin)
    {
      type: 'radio',
      label: $t('开启书签'),
      name: 'openBookmarks',
      value: data.openBookmarks ?? false,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
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
      value: $dict_map.resolution.find((item: any) => item.value === `${data.resolutionX || 1280} x ${data.resolutionY || 720}`) || $dict_map.resolution[3],
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
          Object.assign(original, { audioContextValue: Math.random() })
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
          const osInput = findInputByName(windowInputs, 'os')
          const { getSpeechSynthesis } = await electronAPI.send('util:callRandomFingerprintFunc', {
            getSpeechSynthesis: [original.os || osInput?.value?.value],
          })
          Object.assign(original, { speechVoicesValue: { enable: true, voices: getSpeechSynthesis } })
        }
        else {
          original.speechVoicesValue.enable = false
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
      change: async (input: any) => {
        const macAddrInput = findInputByName(highLevelInputs, 'macAddr')
        macAddrInput.visible = input.value === true

        if (macAddrInput.visible) {
          macAddrInput.value = await API.window.userGetMacAddrV2List({ count: 1 }).then(({ data: [{ macAddr }] }) => macAddr)
        } else {
          const macAddr = await window.electronAPI.send('app:getMacAddress')
          Reflect.set(original, 'macAddr', macAddr)
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
      iconClick: async () => {
        const macAddrInput = findInputByName(highLevelInputs, 'macAddr')
        macAddrInput.value = await API.window.userGetMacAddrV2List({ count: 1 }).then(({ data: [{ macAddr }] }) => macAddr)
      },
    },
    {
      type: 'select',
      label: $t('硬件并发数'),
      name: 'hardwareConcurrent',
      value: $dict_map.hardwareConcurrent.find((item: any) => item.value === (data.hardwareConcurrent ?? '12')),
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
      placeholder: $t('浏览器启动参数,如 --mute,多个参数以英文分号分隔'),
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
    // TODO:(anbin)
    {
      type: 'radio',
      label: $t('打开工作台'),
      name: 'openWorkbench',
      value: data.openWorkbench ?? 1,
      options: [
        { label: $t('开启'), value: 1 },
        { label: $t('关闭'), value: 0 },
        { label: $t('跟随软件设置'), value: 2 },
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
