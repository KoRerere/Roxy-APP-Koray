import type { UserGetBrowserVersionInfoListParams } from '@roxy/backend-api'
import type { FormAsyncGate } from './hooks/useAsyncGate'
import { API } from '/@/api'
import { CoreType, UaStrictMode } from '/@/enums'

import { useUserStore } from '/@/stores/user'
import { createDefaultObject, filterInputsByNames, findInputByName, getDictMap, getFormDataByList, getUserAgentOs, initInputVisible, isEmptyValue, parseCookies, safeParseJSON, setInputFieldByInputKey, setInputValueByFormData, setInputVisible, stringifyCookies, supportsApp3_8_8, validateCookieInput } from '/@/utils'
import { z } from 'zod'
import { AccountBindType } from '/@/enums/account'

function getCookiePlatformUrls(inputs: any[]) {
  const platformList = findInputByName(inputs, 'windowPlatformList')?.value ?? []
  return platformList.map((item: any) => item.platformUrl).filter(Boolean)
}

const userStore = useUserStore()

async function setUaWebgl(inputsGroup: any) {
  const { os, osVersion, coreVersion, browserVersion, coreType } = getFormDataByList(inputsGroup)
  const { code, data } = await getUaWebgl({ os, osVersion, coreVersion, coreType, browserVersion, count: 1 })
  if (code === 0) {
    setInputValueByFormData(inputsGroup, data[0])
    const ua = findInputByName(inputsGroup[0], 'userAgent')
    if (ua) {
      Reflect.set(ua, '_custom_ua', false)
    }
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
  const { fontType, canvas, webGL, audioContext, speechVoices, clientRects, macInfo, os, osVersion, coreVersion, coreType } = getFormDataByList(inupts)
  const { count, preview } = { ...defaultFingerOptions, ...options }
  const fingerDetail = await globalThis.electronAPI.send('util:genRandomFingerprint', {
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
    coreType,
  }, count)

  console.debug('fingerDetail', fingerDetail)

  if (preview) {
    const { userAgent, webGLManufacturer, webGLRender, macAddr, deviceName } = fingerDetail[0]
    setInputValueByFormData(inupts, { userAgent, webGLManufacturer, webGLRender, macAddr, deviceName })// 批量创建时用于界面显示
  }

  const ua = findInputByName(inupts[0], 'userAgent')
  if (ua) {
    Reflect.set(ua, '_custom_ua', false)// 自定义 UA 标记为 false
  }

  return fingerDetail
}

function getResolutionBySystem(os: string, $dict_map: Record<string, any[]>) {
  const isMobile = ['ios', 'android'].includes(os.toLocaleLowerCase())
  const options = isMobile ? $dict_map.mobileResolution! : $dict_map.resolution!
  const defaultValue = isMobile ? options[0] : options.find(item => item.value === '1280 x 720')
  return { isMobile, options, defaultValue }
}

function fixMacOsVersion(version: string) {
  const list = version.split('.')
  return list?.[0]
}

/** 判断是否为 Firefox 内核 */
function isFirefoxCoreType(coreType?: string) {
  return coreType === CoreType.Firefox
}

function isMacOs(os?: string) {
  return os?.toLocaleLowerCase() === 'macos'
}

function isMacOsAllVersion(version?: string) {
  return version?.toLocaleLowerCase() === 'all'
}

/** Firefox + macOS 时系统版本仅支持 ALL */
function getOsVersionOptionsByCoreType(coreType: string, os: string | undefined, versionOptions: any[]) {
  if (isFirefoxCoreType(coreType) && isMacOs(os)) {
    return versionOptions.filter(item => isMacOsAllVersion(item.value))
  }
  return versionOptions
}

function syncOsVersionOptionsByCoreType(osVersionInput: any, coreType: string, os: string | undefined, allVersionOptions: any[]) {
  const options = getOsVersionOptionsByCoreType(coreType, os, allVersionOptions)
  osVersionInput.options = options
  const matched = options.find((opt: any) => opt.value === osVersionInput.value?.value)
  if (!matched && options.length) {
    osVersionInput.value = options[0]
  }
}

/** 从表单读取当前内核类型 */
function getFormCoreType(windowInputs: any[]): string {
  return findInputByName(windowInputs, 'coreType')?.value?.value ?? CoreType.Chrome
}

/** 归一化内核类型，缺省视为 Chrome */
function normalizeCoreType(coreType?: string): CoreType {
  return coreType === CoreType.Firefox ? CoreType.Firefox : CoreType.Chrome
}

/**
 * 「保持最新」虚拟选项的内部标识。
 * 该选项仅用于 UI 展示，提交时需转换为 useLatestCore + 最新 coreVersion。
 */
const USE_LATEST_CORE_VALUE = '__useLatestCore__'

function isUseLatestCoreOption(option?: { value?: string }) {
  return option?.value === USE_LATEST_CORE_VALUE
}

/** 在真实内核版本列表前插入「保持最新」虚拟选项 */
function withUseLatestCoreOption(options: any[]) {
  if (options.some(isUseLatestCoreOption)) {
    return options
  }
  return [{ label: $t('保持最新'), value: USE_LATEST_CORE_VALUE }, ...options]
}

/** 从 options 中取第一个真实内核版本号（字典已按版本降序，即最新版） */
function getLatestCoreVersionFromOptions(options: any[]) {
  return options.find(option => !isUseLatestCoreOption(option))?.value ?? ''
}

/** 从 options 中取第一个真实内核版本对应的 option 对象，供下拉框默认选中 */
function getLatestCoreVersionOption(options: any[]) {
  return options.find(option => !isUseLatestCoreOption(option)) ?? options[0]
}

/**
 * 将下拉框选中值解析为接口字段。
 * 选中「保持最新」时：useLatestCore=true，coreVersion 仍传当前最新版本（UA/指纹等逻辑依赖具体版本号）。
 */
function resolveCoreVersionFromInput(input: any) {
  const selectedValue = input.value?.value
  const useLatestCore = isUseLatestCoreOption(input.value)
  return {
    useLatestCore,
    coreVersion: useLatestCore ? getLatestCoreVersionFromOptions(input.options) : selectedValue,
  }
}

/** 根据编辑数据或默认值，确定内核版本下拉的初始选中项 */
function getInitialCoreVersionValue(options: any[], data: any) {
  // 后端标记为保持最新时，选中虚拟选项
  if (data.useLatestCore === true) {
    return options.find(isUseLatestCoreOption) ?? getLatestCoreVersionOption(options)
  }
  // 编辑已有窗口：回显具体版本
  if (data.coreVersion) {
    const matched = options.find((item: any) => item.value === data.coreVersion)
    if (matched) {
      return matched
    }
  }
  // 新建默认选中最新内核，而非「保持最新」
  return getLatestCoreVersionOption(options)
}

export async function getInputsGroup(data: any = {}, showToast: any = () => { }, gate?: Pick<FormAsyncGate, 'run'>) {
  const run = gate?.run ?? (<T>(task: () => Promise<T>) => task())

  const [$dict_map, userConfig, searchEngine, coreList] = await run(() => Promise.all([
    getDictMap(),
    userStore.getUserConfig(),
    API.platform.userGetSearchEnginesList(),
    globalThis.electronAPI.send('app:getCoreList'),
  ]))

  // Chrome / Firefox 可能存在相同 coreVersion，需按 coreType 分别过滤本地可用内核
  const availableChromeVersions = coreList
    .filter(item => normalizeCoreType(item.coreType) === CoreType.Chrome)
    .map(item => item.coreVersion)
  const availableFirefoxVersions = coreList
    .filter(item => normalizeCoreType(item.coreType) === CoreType.Firefox)
    .map(item => item.coreVersion)

  const osIconMap = {
    windows: 'platforms/rx_os_windows',
    linux: 'platforms/rx_os_linux',
    macos: 'platforms/rx_os_macOS',
    android: 'platforms/rx_os_android',
    ios: 'platforms/rx_os_iOS',
  } as const

  /** 按内核类型获取可选版本，过滤本地已安装内核，并在列表前插入「保持最新」虚拟选项 */
  const getCoreVersionOptionsByType = (coreType: string, os?: string, version?: string) => {
    if (isFirefoxCoreType(coreType)) {
      const options = ($dict_map.firefoxCoreVersion ?? []).filter(item => availableFirefoxVersions.includes(item.value))
      return withUseLatestCoreOption(options)
    }

    const chromeVersions = $dict_map.coreVersion!.filter(item => availableChromeVersions.includes(item.value))
    const filtered = os?.toLocaleLowerCase() === 'windows' && ['7', '8'].includes(version?.at(0) ?? '')
      ? chromeVersions.filter((item: any) => item.value === '109') // win7，win8 只有 109 内核版本
      : chromeVersions
    return withUseLatestCoreOption(filtered)
  }

  const osOptions = $dict_map.os!.map(({ label, ...item }: any) => {
    let _versionOptions = $dict_map[`osversion_${label.toLocaleLowerCase()}`]!.map((vitem: any) => ({ ...vitem, label: `${label} ${vitem.label}`, _osValue: item.value }))
    // fix: 小版本不显示
    if (label.toLocaleLowerCase() === 'macos' || label.toLocaleLowerCase() === 'ios') {
      _versionOptions = _versionOptions.filter(item => !item.value?.includes('.'))
    }
    return {
      ...item,
      label,
      tooltip: label,
      icon: osIconMap[(label.toLocaleLowerCase()) as keyof typeof osIconMap],
      _versionOptions,
    }
  })
  console.log('osOptions', osOptions)

  const osValue = osOptions.find((item: any) => item.value.toLocaleLowerCase() === (data?.os || getUserAgentOs()).toLocaleLowerCase())
  // fix: 如果是 macos, ios 系统，就取大版本去做匹配。其他系统不需要处理
  const osVersion = data.os?.toLocaleLowerCase() === 'macos' || data.ios?.toLocaleLowerCase() ? fixMacOsVersion(data.osVersion || '') : data.osVersion
  const initialCoreType = data.coreType ?? CoreType.Chrome
  const initialOsVersionOptions = getOsVersionOptionsByCoreType(initialCoreType, osValue?.value, osValue?._versionOptions ?? [])
  const osVersionValue = initialOsVersionOptions.find((item: any) => item.value === osVersion) ?? initialOsVersionOptions[0]
  const coreTypeOptions = [
    { label: CoreType.Chrome, value: CoreType.Chrome, icon: 'base/rx_ic_chrome' },
    {
      label: CoreType.Firefox,
      value: CoreType.Firefox,
      icon: 'base/rx_ic_firefox',
      disabled: !supportsApp3_8_8(),
      disabledTooltip: $t('该功能需要升级到 v{version} 及以上版本', { version: '3.8.8' }),
    },
  ]
  const initialCoreVersionOptions = getCoreVersionOptionsByType(initialCoreType, osValue?.value, osVersionValue?.value)
  // TODO:(anbin)
  const searchEngineOptions = searchEngine.code === 0
    ? (searchEngine.data || []).map(item => ({ label: item.code, value: item.code, image: item.icon }))
    : []

  const searchEngineValue = data.searchEngine ?? userConfig?.searchEngine

  // 非严格模式获取浏览器版本选项（仅 Chrome 内核支持）
  const browserVersionOptions = userConfig?.uaModeSwitch === UaStrictMode.close && osValue && osVersionValue && !isFirefoxCoreType(initialCoreType)
    ? await run(() => getBrowserVersion({ os: osValue.value, osVersion: osVersionValue.value }))
    : []
  const browserVersionValue = data.browserVersion?.split(',').filter(Boolean) ?? browserVersionOptions.map(item => item.value)

  /**
   * 代理加密相关字段
   */
  const encryptProxyKeys = ['isEncryptProxy', 'proxyEncryptInfo']
  const proxyInfoKeys = ['host', 'ipType', 'port', 'proxyUserName', 'proxyPassword', 'refreshUrl', 'lastCountry', 'lastCity', 'lastIp']
  const proxyInfoList = data.proxyCategory && data.proxyCategory !== 'noproxy'
    ? [{
        id: data.moduleId,
        proxyCategory: data.proxyCategory,
        checkChannel: data.checkChannel,
        ...Object.fromEntries([...encryptProxyKeys, ...proxyInfoKeys].map(key => [key, data[key]])),
      }]
    : []

  const { isMobile, options: resolutionOptions, defaultValue } = getResolutionBySystem(osValue?.value, $dict_map)
  const resolutionValue = resolutionOptions!.find((item: any) => item.value === `${data.resolutionX} x ${data.resolutionY}`) || defaultValue

  const extraMoblieVisible = initInputVisible(osValue.value, 'Android', false) || initInputVisible(osValue.value, 'IOS', false)

  const inputsGroup = [] as any[]
  const isFirefox = isFirefoxCoreType(initialCoreType)

  const original = reactive<any>({
    ...getDefaultValue(),
    // 补充 searchEngine 默认值，保证 Firefox 下隐藏该字段时仍能提交（data 有值时会被下方 spread 覆盖）
    searchEngine: searchEngineValue,
    ...Object.fromEntries(Object.entries(data).filter(([key]) => !encryptProxyKeys.includes(key))), // 过滤掉加密字段
  })

  const windowInputs = reactive([
    {
      type: 'text',
      label: $t('窗口名称'),
      name: 'windowName',
      value: data.windowName ?? '',
      dirId: data.dirId ?? '',
      placeholder: $t('未命名窗口(选填)'),
      formatValue: (input: any, _inputs: any, formData: any) => {
        Object.assign(formData, { windowNamePrefix: input.value })// 窗口名称前缀，批量创建时会用到
        return input.value
      },
      slot: 'name',
    },
    {
      label: $t('系统'),
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
            if (item.value) {
              const osVersionInput = findInputByName(windowInputs, 'osVersion')
              const coreType = getFormCoreType(windowInputs)
              const versionOptions = getOsVersionOptionsByCoreType(coreType, item.value.value, item.value._versionOptions)
              osVersionInput.options = versionOptions
              osVersionInput.value = versionOptions[0]
              osVersionInput.change?.(osVersionInput)

              const { isMobile, options: resolutionOptions, defaultValue } = getResolutionBySystem(item.value.value, $dict_map)
              const resolutionInput = findInputByName(highLevelInputs, 'resolution')
              if (resolutionInput._isMobile !== isMobile) {
                resolutionInput._isMobile = isMobile
                resolutionInput.value = defaultValue
                resolutionInput.options = resolutionOptions
              }

              const moblieVisible = ['Android', 'IOS'].includes(item.value.value) && coreType !== CoreType.Firefox
              switchMoblieInputVisible(highLevelInputs, moblieVisible)
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
          options: initialOsVersionOptions,
          filter: false,
          change: async (item: any) => {
            const coreVersionInput = findInputByName(windowInputs, 'coreVersion')

            if (item.value) {
              const { _osValue, value: version } = item.value
              const coreType = getFormCoreType(windowInputs)
              const _coreVersionOptions = getCoreVersionOptionsByType(coreType, _osValue, version)

              coreVersionInput.options = _coreVersionOptions
              const matched = _coreVersionOptions.find((opt: any) => opt.value === coreVersionInput.value?.value)
              // 当前选中版本在新系统下不可用时，回退到最新内核（非「保持最新」）
              if (!matched && _coreVersionOptions.length) {
                coreVersionInput.value = getLatestCoreVersionOption(_coreVersionOptions)
              }

              // browserVersion 仅 Chrome 非严格模式使用
              if (!isFirefoxCoreType(coreType) && userConfig?.uaModeSwitch === UaStrictMode.close) {
                const options = await run(() => getBrowserVersion({ os: _osValue, osVersion: version }))
                const browserVersionInput = findInputByName(windowInputs, 'browserVersion')
                browserVersionInput.options = options
                browserVersionInput.value = options.map(item => item.value)
              }
            }

            coreVersionInput.change?.(coreVersionInput)
          },
          required: true,
        },
      ],
      slot: 'system', // items 特殊实现
    },
    {
      label: $t('内核'),
      items: [
        {
          type: 'select',
          name: 'coreType',
          value: coreTypeOptions.find((item: any) => item.value === data.coreType) ?? coreTypeOptions[0],
          options: coreTypeOptions,
          icon: isFirefox ? 'base/rx_ic_firefox' : 'base/rx_ic_chrome',
          filter: false,
          iconColor: 'var(--primary-color, #12a3fc)',
          style: {
            width: '66px',
            flex: 'none',
          },
          overlayStyle: {
            width: '120px',
          },
          disabled: Boolean(data.id),
          class: 'items-center',
          change: async (item: any) => {
            if (item.value) {
              const coreType = item.value.value
              const [osInput, osVersionInput, coreVersionInput] = filterInputsByNames(windowInputs, ['os', 'osVersion', 'coreVersion'])

              const os = osVersionInput?.value?._osValue ?? osInput?.value?.value ?? osValue?.value
              syncOsVersionOptionsByCoreType(
                osVersionInput,
                coreType,
                os,
                osInput?.value?._versionOptions ?? osValue?._versionOptions ?? [],
              )
              const version = osVersionInput?.value?.value ?? osVersionValue?.value

              const _coreVersionOptions = getCoreVersionOptionsByType(coreType, os, version)
              coreVersionInput.options = _coreVersionOptions
              // 切换内核类型后默认使用最新内核
              coreVersionInput.value = getLatestCoreVersionOption(_coreVersionOptions) ?? null

              await run(() => syncCoreTypeRelatedFields(coreType, os, version))
              const moblieVisible = ['Android', 'IOS'].includes(os) && coreType !== CoreType.Firefox
              switchMoblieInputVisible(highLevelInputs, moblieVisible)
              const [webGLInput, canvasInput] = filterInputsByNames(highLevelInputs, ['webGL', 'canvas'])

              webGLInput.change?.(webGLInput)
              canvasInput?.change?.(canvasInput)
              coreVersionInput.change?.(coreVersionInput)
            }
          },
          preview: {
            label: $t('内核类型'),
          },
          required: true,
        },
        {
          type: 'select',
          name: 'coreVersion',
          value: getInitialCoreVersionValue(initialCoreVersionOptions, data),
          options: initialCoreVersionOptions,
          required: true,
          filter: false,
          /**
           * 虚拟选项「保持最新」需拆分为 useLatestCore + 实际 coreVersion 再提交
           */
          formatValue: (input: any, _inputs: any, formData: any) => {
            const { useLatestCore, coreVersion } = resolveCoreVersionFromInput(input)
            Reflect.set(formData, 'useLatestCore', useLatestCore)
            return coreVersion
          },
          change: async (item: any) => {
            if (item.value) {
              await run(() => setUaWebgl(inputsGroup))
            }
            if (data.dirId) {
              // 与后端已保存的实际版本比较，虚拟选项需先解析为真实版本号
              const { coreVersion } = resolveCoreVersionFromInput(item)
              item.help = data.coreVersion !== coreVersion
                ? $t('修改内核可能导致缓存不兼容，从而使账号登录信息失效，请谨慎操作。')
                : ''
            }
          },
        },
      ],
      slot: 'kernel', // items 特殊实现
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
      visible: !isFirefox && initInputVisible(userConfig?.uaModeSwitch, UaStrictMode.close, false),
      formatValue: (input: any) => input.value.join(','),
      onHide: () => {
        const input = findInputByName(windowInputs, 'browserVersion')
        const isEq = input.value.slice().sort().join(',') === input._oldValue.slice().sort().join(',')
        if (!isEq) {
          input._oldValue = input.value.slice()
          void run(() => setUaWebgl(inputsGroup))
        }
      },
    },
    {
      type: 'textarea',
      label: $t('User-Agent'),
      name: 'userAgent',
      value: data.userAgent,
      rows: 3,
      iconClick: async () => {
        await run(() => setUaWebgl(inputsGroup))
        showToast(0, $t('UA刷新成功'))
      },
      change: (input: any) => {
        Reflect.set(input, '_custom_ua', true)
      },
      formatValue: (input: any, _inputs: any, formData: any) => {
        Reflect.set(formData, '_custom_ua', input._custom_ua)
        return input.value?.trim()
      },
      slot: 'userAgent',
      preview: {
        label: 'User Agent',
      },
    },
    {
      type: 'textarea',
      label: 'Cookies',
      placeholder: $t('支持格式: JSON、Netscape、Name=Value\nName=Value 未写 domain 时，将按行从下方平台账号的网址自动填充'),
      name: 'cookie',
      value: isEmptyValue(data?.cookie) ? '' : stringifyCookies(data.cookie),
      validator(input: any) {
        const result = validateCookieInput(input.value?.trim() ?? '', {
          platformUrls: getCookiePlatformUrls(windowInputs),
        })
        if (!result.valid) {
          input.errorMsg = result.message
          return false
        }
        input.errorMsg = undefined
        return true
      },
      formatValue: (input: any, inputs: any) => {
        return parseCookies(input.value?.trim() ?? '', {
          platformUrls: getCookiePlatformUrls(inputs),
        }) ?? []
      },
      slot: 'cookies',
    },
    {
      separator: true,
    },
    {
      label: $t('代理 IP'),
      name: 'proxyInfoList',
      value: proxyInfoList,
      formatValue: (input: any, _inputs: any, formData: any) => {
        const { id, lastCity, lastCountry, lastIp, ...value } = input.value[0] || {
          ...createDefaultObject(proxyInfoKeys, ''),
          moduleId: 0, // 删除代理库关联 id
          proxyCategory: 'noproxy', // 删除代理时要手动标记直连
        }

        const proxyData = id ? { moduleId: id, proxyMethod: 'choose' } : { ...value, proxyMethod: 'custom' }
        Object.assign(formData, { lastCity, lastCountry, lastIp, ...proxyData })// 赋值给表单，批量创建这一行创建的值会无视（以上字段为空则代表删除代理）

        return input.value.map(({ _proxyCount, ...item }: any) => Array.from({ length: _proxyCount }, () => ({ ...item, proxyMethod: item.id ? 'choose' : 'custom' }))).flat()
      },
      slot: 'proxy',
    },
    {
      label: $t('平台账号'),
      name: 'windowPlatformList',
      value: data.windowPlatformList ?? [],
      platformBindType: AccountBindType.Order,
      formatValue: (input: any, _inputs: any, formData: any) => {
        const platformUrlIds = input.value.map((item: any) => item.id).filter(Boolean)
        Object.assign(formData, {
          platformUrlIds, // 关联账号库选择的账号id
          platformBindType: input.platformBindType, // 账号分配类型
        })
        return input.value.filter((item: any) => !item.id)// 过滤需要关联的账号
      },
      slot: 'accounts',
    },
    {
      label: 'URLs',
      name: 'defaultOpenUrl',
      value: data.defaultOpenUrl ?? [],
      slot: 'urls',
    },
  ])

  const basicInputs = reactive([
    {
      type: 'selectButton',
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
      value: $dict_map.language!.find((item: any) => item.value === data.displayLanguage) ?? $dict_map.language![0],
      options: $dict_map.language,
      virtualScrollerOptions: { itemSize: 38 },
      visible: initInputVisible(data.isDisplayLanguageBaseIp, false, false),
    },
    {
      type: 'selectButton',
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
      value: $dict_map.language!.find((item: any) => item.value === data.language) ?? $dict_map.language![0],
      options: $dict_map.language,
      virtualScrollerOptions: { itemSize: 38 },
      visible: initInputVisible(data.isLanguageBaseIp, false, false),
    },
    {
      type: 'selectButton',
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
      value: $dict_map.timeZone!.find((item: any) => item.value === data.timeZone) ?? $dict_map.timeZone![0],
      options: $dict_map.timeZone,
      virtualScrollerOptions: { itemSize: 38 },
      visible: initInputVisible(data.isTimeZone, false, false),
    },
    {
      type: 'selectButton',
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
      type: 'selectButton',
      label: $t('地理位置'),
      name: 'isPositionBaseIp',
      value: data.isPositionBaseIp ?? true,
      options: [
        { label: $t('基于 IP 匹配'), value: true },
        { label: $t('自定义'), value: false },
      ],
      visible: !initInputVisible(data.position, 2, false),
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
        let newValue = event.target.value
        const isValid = z.number().safeParse(Number(newValue))
        if (isValid.success && newValue !== '') {
          if (newValue > 180) {
            newValue = 180
          }
          if (newValue < -180) {
            newValue = -180
          }
        }
        else {
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
        let newValue = event.target.value
        const isValid = z.number().safeParse(Number(newValue))
        if (isValid.success && newValue !== '') {
          if (newValue > 90) {
            newValue = 90
          }
          if (newValue < -90) {
            newValue = -90
          }
        }
        else {
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
        let newValue = event.target.value
        // 输入的内容如果不是数字，就清空，如果是数字就走下边的校验
        // 不能为空字符
        const isValid = z.number().safeParse(Number(newValue))
        if (isValid.success && newValue !== '') {
          if (newValue < 10) {
            newValue = 10
          }
          if (newValue > 5000) {
            newValue = 5000
          }
        }
        else {
          newValue = ''
        }
        setInputFieldByInputKey(basicInputs, 'precisionPos', 'value', newValue)
      },
    },
    {
      type: 'selectButton',
      label: $t('声音'),
      name: 'forbidAudio',
      value: data.forbidAudio ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'selectButton',
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
      type: 'selectButton',
      label: $t('视频'),
      name: 'forbidMedia',
      value: data.forbidMedia ?? true,
      options: [
        { label: $t('开启'), value: true },
        { label: $t('关闭'), value: false },
      ],
    },
    {
      type: 'selectButton',
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
      // Firefox 下隐藏窗口大小输入（openWidth/openHeight 由 original 兜底传递）
      visible: !isFirefox && initInputVisible(data.positionSwitch, true, true),
      slot: 'windowOpenSize',
    },
    {
      label: $t('窗口位置'),
      name: 'windowRatioPosition',
      value: data.windowRatioPosition || '0,0',
      tooltip: $t('窗口打开时在屏幕中的初始位置'),
      // Firefox 下隐藏窗口位置（由 original 兜底传递）
      visible: !isFirefox && initInputVisible(data.positionSwitch, true, true),
      slot: 'windowRatioPosition',
    },
    {
      label: $t('搜索引擎'),
      name: 'searchEngine',
      type: 'select',
      value: searchEngineOptions.find((item: any) => item.value === searchEngineValue) ?? searchEngineOptions[0],
      options: searchEngineOptions,
      filter: false,
      required: true,
      visible: !isFirefox, // Firefox 内核不支持搜索引擎设置，Chrome 专有
    },
  ])

  const highLevelInputs = reactive([
    {
      type: 'selectButton',
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
      value: resolutionValue,
      options: resolutionOptions,
      virtualScrollerOptions: { itemSize: 38 },
      filter: false,
      _isMobile: isMobile,
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
      type: 'selectButton',
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
          const { getAllowFontList } = await globalThis.electronAPI.send('util:callRandomFingerprintFunc', {
            // genRandomFonts: [],
            getAllowFontList: [],
          })

          const genRandomFonts = await globalThis.electronAPI.send('util:genRandomFonts')

          Object.assign(original, {
            font: genRandomFonts.join(';'),
            allowFontList: getAllowFontList,
          })
        }
        else {
          Reflect.deleteProperty(original, 'font')
        }
      },
    },
    {
      type: 'selectButton',
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
      type: 'selectButton',
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
          const coreTypeInput = findInputByName(windowInputs, 'coreType')

          if (coreTypeInput.value.value === 'Firefox') {
            Object.assign(original, { webGLValue: Math.random() })
          }
          else {
            const { getwebGLNoiseValue } = await globalThis.electronAPI.send('util:callRandomFingerprintFunc', {
              getwebGLNoiseValue: [],
            })
            Object.assign(original, { webGLValue: getwebGLNoiseValue })
          }
        }
        else {
          Reflect.deleteProperty(original, 'webGLValue')
        }
      },
    },
    {
      type: 'selectButton',
      label: $t('WebGL Info'),
      name: 'webGLInfo',
      value: data.webGLInfo ?? 1,
      options: [
        { label: $t('真实'), value: 0 },
        { label: $t('随机'), value: 1 },
        { label: $t('自定义'), value: 2 },
      ],
      change(input: any) {
        input.value === 1 && void run(() => setUaWebgl(inputsGroup))

        filterInputsByNames(highLevelInputs, ['webGLManufacturer', 'webGLRender']).forEach((ipt) => {
          ipt.visible = input.value !== 0
          ipt.disabled = input.value !== 2
        })
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
      disabled: data.webGLInfo !== 2,
      visible: !initInputVisible(data.webGLInfo, 0, false),
      iconClick: () => {
        void run(() => setUaWebgl(inputsGroup))
      },
    },
    {
      type: 'textarea',
      label: $t('WebGL 渲染'),
      name: 'webGLRender',
      value: data.webGLRender,
      rows: 3,
      icon: 'base/rx_ic_shuffle',
      disabled: data.webGLInfo !== 2,
      visible: !initInputVisible(data.webGLInfo, 0, false),
      iconClick: () => {
        void run(() => setUaWebgl(inputsGroup))
      },
    },
    {
      type: 'selectButton',
      label: 'WebGpu',
      name: 'webGpu',
      value: data.webGpu ?? 'webgl',
      options: [
        { label: $t('基于WebGL匹配'), value: 'webgl' },
        { label: $t('真实'), value: 'real' },
        { label: $t('禁止'), value: 'block' },
      ],
      // Firefox 不支持 WebGPU 指纹，Chrome 专有
      visible: !isFirefox,
    },
    {
      type: 'selectButton',
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
        const coreType = getFormCoreType(windowInputs)
        if (input.value) {
          if (isFirefoxCoreType(coreType)) {
            // Firefox 使用 canvasValueV2（0-1 浮点噪声）
            Object.assign(original, { canvasValueV2: Math.random() })
            Reflect.deleteProperty(original, 'canvasValue')
          }
          else {
            const { getCanvasContextNoiseValue } = await globalThis.electronAPI.send('util:callRandomFingerprintFunc', {
              getCanvasContextNoiseValue: [],
            })
            Object.assign(original, { canvasValue: getCanvasContextNoiseValue })
            Reflect.deleteProperty(original, 'canvasValueV2')
          }
        }
        else {
          Reflect.deleteProperty(original, 'canvasValue')
          Reflect.deleteProperty(original, 'canvasValueV2')
        }
      },
    },
    {
      type: 'selectButton',
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
      type: 'selectButton',
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
          const { getSpeechSynthesis } = await globalThis.electronAPI.send('util:callRandomFingerprintFunc', {
            getSpeechSynthesis: [original.os || osInput?.value?.value, getFormCoreType(windowInputs)],
          })
          Object.assign(original, { speechVoicesValue: { enable: true, voices: getSpeechSynthesis } })
        }
        else {
          original.speechVoicesValue.enable = false
        }
      },
    },
    {
      type: 'selectButton',
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
      type: 'selectButton',
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
          const { getClientRectsValue } = await globalThis.electronAPI.send('util:callRandomFingerprintFunc', {
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
      type: 'selectButton',
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
      // Firefox 不支持媒体设备指纹，Chrome 专有
      visible: !isFirefox,
    },
    {
      type: 'selectButton',
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
      // Firefox 不支持设备名称指纹，Chrome 专有
      visible: !isFirefox,
    },
    {
      type: 'text',
      label: ' ',
      name: 'deviceName',
      value: data.deviceName,
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      // Firefox 不支持设备名称指纹；Chrome 下受父控件 deviceNameSwitch 约束
      visible: !isFirefox && initInputVisible(data.deviceNameSwitch, true, true),
      iconClick: () => {
        setDeviceName(inputsGroup)
      },
    },
    {
      type: 'selectButton',
      label: $t('MAC地址'),
      name: 'macInfo',
      value: data.macInfo ?? true,
      options: [
        { label: $t('真实'), value: false },
        { label: $t('自定义'), value: true },
      ],
      // Firefox 不支持 MAC 地址指纹，Chrome 专有
      visible: !isFirefox,
      change: async (input: any) => {
        const macAddrInput = findInputByName(highLevelInputs, 'macAddr')
        const coreType = getFormCoreType(windowInputs)
        macAddrInput.visible = input.value === true

        if (macAddrInput.visible) {
          macAddrInput.value = await API.window.userGetMacAddrV2List({ count: 1, coreType } as any).then(({ data }) => data[0]?.macAddr)
        }
        else {
          const macAddr = await globalThis.electronAPI.send('app:getMacAddress')
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
      // Firefox 不支持 MAC 地址指纹；Chrome 下受父控件 macInfo 约束
      visible: !isFirefox && initInputVisible(data.macInfo, true, true),
      iconClick: async () => {
        const macAddrInput = findInputByName(highLevelInputs, 'macAddr')
        const coreType = getFormCoreType(windowInputs)
        macAddrInput.value = await API.window.userGetMacAddrV2List({ count: 1, coreType } as any).then(({ data }) => data[0]?.macAddr)
      },
    },
    {
      type: 'select',
      label: $t('硬件并发数'),
      name: 'hardwareConcurrent',
      value: $dict_map.hardwareConcurrent!.find((item: any) => item.value === (data.hardwareConcurrent ?? '12')),
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
      value: $dict_map.deviceMemory!.find((item: any) => item.value === (data.deviceMemory ?? '8')),
      options: $dict_map.deviceMemory,
      filter: false,
      preview: {
        label: $t('设备内存'),
      },
    },
    {
      type: 'selectButton',
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
      // Firefox 不支持 SSL 指纹设置，Chrome 专有
      visible: !isFirefox,
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
      // Firefox 不支持 SSL 指纹设置；Chrome 下受父控件 disableSsl 约束
      visible: !isFirefox && initInputVisible(data.disableSsl, true, false),
    },
    {
      type: 'selectButton',
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
      type: 'selectButton',
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
      visible: true,
    },
    {
      type: 'selectButton',
      label: $t('禁用沙盒'),
      name: 'sandboxPermission',
      value: data.sandboxPermission ?? false,
      visible: !isFirefox, // Firefox 内核不支持沙盒设置，Chrome 专有
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
      placeholder: $t('浏览器启动参数,如 --mute 多个参数以英文分号分隔'),
    },
    {
      name: 'BatterySeparator',
      separatorTitle: $t('电池'),
      separatorIcon: {
        name: 'base/rx_ic_battery',
        color: 'var(--colors-icon-icon-warning)',
      },
      separator: true,
      visible: extraMoblieVisible,
    },
    {
      type: 'selectButton',
      label: $t('电池模拟'),
      name: 'openBattery',
      value: data.openBattery ?? false,
      options: genSwitchOptions(),
      visible: extraMoblieVisible,
      change(input: any) {
        const keys = ['openCharging', 'chargingTime', 'dischargingTime', 'level']
        filterInputsByNames(highLevelInputs, keys).forEach((ipt) => {
          ipt.visible = input.visible && input.value === true
        })
      },
    },
    {
      type: 'selectButton',
      label: $t('充电状态'),
      name: 'openCharging',
      value: data.openCharging ?? false,
      options: genSwitchOptions(),
      visible: extraMoblieVisible && initInputVisible(data.openBattery, true, false),
    },
    {
      type: 'text',
      label: $t('充电时长（秒）'),
      placeholder: $t('请填写充电时长，示例: {value}', { value: 100 }),
      name: 'chargingTime',
      value: data.chargingTime,
      visible: extraMoblieVisible && initInputVisible(data.openBattery, true, false),
    },
    {
      type: 'text',
      label: $t('放电时长（秒）'),
      placeholder: $t('请填写放电时长，示例: {value}', { value: 100 }),
      name: 'dischargingTime',
      value: data.dischargingTime,
      visible: extraMoblieVisible && initInputVisible(data.openBattery, true, false),
    },
    {
      type: 'text',
      label: $t('电量'),
      placeholder: $t('请填写电池电量(0-1)，示例: {value}', { value: 0.75 }),
      name: 'level',
      value: data.level,
      visible: extraMoblieVisible && initInputVisible(data.openBattery, true, false),
      onBlur(event: any) {
        let newValue = event.target.value
        const isValid = z.number().safeParse(Number(newValue))
        if (isValid.success && newValue !== '') {
          if (newValue > 1) {
            newValue = 1
          }
          if (newValue < 0) {
            newValue = 0
          }
        }
        else {
          newValue = ''
          setInputFieldByInputKey(highLevelInputs, 'level', 'invalid', true)
        }
        setInputFieldByInputKey(highLevelInputs, 'level', 'value', newValue)
      },
    },
    {
      name: 'NetworkSeparator',
      separatorTitle: $t('网络'),
      separatorIcon: {
        name: 'base/rx_ic_network_m',
        color: 'var(--colors-icon-icon-success)',
      },
      separator: true,
      visible: extraMoblieVisible,
    },
    {
      type: 'selectButton',
      label: $t('网络模拟'),
      name: 'openNetwork',
      value: data.openNetwork ?? false,
      options: genSwitchOptions(),
      visible: extraMoblieVisible,
      change(input: any) {
        const keys = ['networkType', 'networkSpeed', 'downloadSpeed', 'maxDownloadSpeed', 'latency', 'saveFlowMode']
        filterInputsByNames(highLevelInputs, keys).forEach((ipt) => {
          ipt.visible = input.visible && input.value === true
        })
      },
    },
    {
      type: 'select',
      label: $t('网络类型'),
      name: 'networkType',
      value: $dict_map.nettype!.find((item: any) => item.value === data.networkType) ?? $dict_map.nettype![0],
      options: $dict_map.nettype,
      filter: false,
      visible: extraMoblieVisible && initInputVisible(data.openNetwork, true, false),
    },
    {
      type: 'select',
      label: $t('网络速度'),
      name: 'networkSpeed',
      value: $dict_map.effectiveType!.find((item: any) => item.value === data.networkSpeed) ?? $dict_map.effectiveType![0],
      options: $dict_map.effectiveType,
      filter: false,
      visible: extraMoblieVisible && initInputVisible(data.openNetwork, true, false),
    },
    {
      type: 'text',
      label: $t('下载速度（Mbps）'),
      placeholder: $t('请填写下载速度，示例: {value}', { value: 3000 }),
      name: 'downloadSpeed',
      value: data.downloadSpeed,
      visible: extraMoblieVisible && initInputVisible(data.openNetwork, true, false),
    },
    {
      type: 'text',
      label: $t('最大下载速度（Mbps）'),
      placeholder: $t('请填写最大下载速度，示例: {value}', { value: 3000 }),
      name: 'maxDownloadSpeed',
      value: data.maxDownloadSpeed,
      visible: extraMoblieVisible && initInputVisible(data.openNetwork, true, false),
    },
    {
      type: 'text',
      label: $t('延迟（ms）'),
      placeholder: $t('请填写延迟，示例: {value}', { value: 200 }),
      name: 'latency',
      value: data.latency,
      visible: extraMoblieVisible && initInputVisible(data.openNetwork, true, false),
    },
    {
      type: 'selectButton',
      label: $t('省流模式'),
      name: 'saveFlowMode',
      value: data.saveFlowMode ?? false,
      options: genSwitchOptions(),
      visible: extraMoblieVisible && initInputVisible(data.openNetwork, true, false),
    },
    {
      name: 'bluetoothSeparator',
      separatorTitle: $t('蓝牙'),
      separatorIcon: {
        name: 'base/rx_ic_bluetooth',
        color: 'var(--colors-icon-icon-brand)',
      },
      separator: true,
      visible: extraMoblieVisible,
    },
    {
      type: 'selectButton',
      label: $t('蓝牙模拟'),
      name: 'openBluetooth',
      value: data.openBluetooth ?? false,
      options: genSwitchOptions(),
      visible: extraMoblieVisible,
      change(input: any) {
        const keys = ['bluetoothAdapter']
        filterInputsByNames(highLevelInputs, keys).forEach((ipt) => {
          ipt.visible = input.visible && input.value === true
        })
      },
    },
    {
      type: 'selectButton',
      label: $t('蓝牙适配器'),
      name: 'bluetoothAdapter',
      value: data.bluetoothAdapter ?? false,
      options: genSwitchOptions(),
      visible: extraMoblieVisible && initInputVisible(data.openBluetooth, true, false),
    },
  ])

  const otherInputs = reactive([
    // {
    //   type: 'selectButton',
    //   label: $t('窗口名称'),
    //   name: 'isDisplayName',
    //   value: data.isDisplayName ?? false,
    //   options: genSwitchOptions(),
    // },
    {
      type: 'selectButton',
      label: $t('自定义书签'),
      name: 'openBookmarks',
      value: data.openBookmarks ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步书签'),
      name: 'syncBookmark',
      value: data.syncBookmark ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步历史记录'),
      name: 'syncHistory',
      value: data.syncHistory ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步标签页'),
      name: 'syncTab',
      value: data.syncTab ?? true,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步Cookie'),
      name: 'syncCookie',
      value: data.syncCookie ?? true,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步扩展应用程序'),
      name: 'syncExtensions',
      value: data.syncExtensions ?? false,
      options: genSwitchOptions(),
      // Firefox 扩展机制与 Chrome 完全不同，Chrome 专有
      visible: !isFirefox,
    },
    {
      type: 'selectButton',
      label: $t('同步已保存的用户名密码'),
      name: 'syncPassword',
      value: data.syncPassword ?? true,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步IndexedDB'),
      name: 'syncIndexedDb',
      value: data.syncIndexedDb ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步Local Storage'),
      name: 'syncLocalStorage',
      value: data.syncLocalStorage ?? true,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('同步Session Storage'),
      name: 'syncSessionStorage',
      value: data.syncSessionStorage ?? false,
      options: genSwitchOptions(),
      change(input: any) {
        setInputVisible(otherInputs, 'sessionStorages', input.value === true)
      },
    },
    {
      type: 'textarea',
      label: ' ',
      name: 'sessionStorages',
      placeholder: $t('请务必按以下格式填写，不输入则全部开启\n{example}', { example: '[\n\t{"domain": "www.example1.com", "key": ["key1", "key2"]}\n\t{"domain": "www.example2.com", "key": ["key1", "key2"]}\n]' }),
      value: isEmptyValue(data?.sessionStorages) ? '' : JSON.stringify(data.sessionStorages, null, 2),
      rows: 5,
      formatValue: (input: any) => safeParseJSON(input.value, []),
      help: $t('开启同步 Session Storage 可能存在风险，请谨慎操作!'),
      visible: initInputVisible(data.syncSessionStorage, true, false),
    },
    {
      type: 'selectButton',
      label: $t('启动浏览器前删除缓存文件'),
      name: 'clearCacheFile',
      value: data.clearCacheFile ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('启动浏览器前删除Cookie'),
      name: 'clearCookie',
      value: data.clearCookie ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('启动浏览器前删除Local Storage'),
      name: 'clearLocalStorage',
      value: data.clearLocalStorage ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('启动浏览器时随机指纹'),
      name: 'randomFingerprint',
      value: data.randomFingerprint ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('弹出保存密码提示'),
      name: 'forbidSavePassword',
      value: data.forbidSavePassword ?? true,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('网络不通停止打开'),
      name: 'stopOpenNet',
      value: data.stopOpenNet ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('IP发生变化停止打开'),
      name: 'stopOpenIP',
      value: data.stopOpenIP ?? false,
      options: genSwitchOptions(),
    },
    {
      type: 'selectButton',
      label: $t('IP对应国家/地区发生改变停止打开'),
      name: 'stopOpenPosition',
      value: data.stopOpenPosition ?? false,
      options: genSwitchOptions(),
    },
    // TODO:(anbin)
    {
      type: 'selectButton',
      label: $t('打开工作台'),
      name: 'openWorkbench',
      value: data.openWorkbench ?? 1,
      options: [
        { label: $t('开启'), value: 1 },
        { label: $t('关闭'), value: 0 },
        { label: $t('跟随软件设置'), value: 2 },
      ],
    },
    {
      type: 'selectButton',
      label: $t('IP 变化提醒'),
      name: 'ipChangeRemind',
      value: data.ipChangeRemind ?? 2,
      options: [
        { label: $t('开启'), value: 1 },
        { label: $t('关闭'), value: 0 },
        { label: $t('跟随软件设置'), value: 2 },
      ],
    },
    {
      type: 'selectButton',
      label: $t('是否开启谷歌登录'),
      name: 'enableGoogleLogin',
      value: data.enableGoogleLogin ?? 2,
      visible: !isFirefox,
      options: [
        { label: $t('开启'), value: 1 },
        { label: $t('关闭'), value: 0 },
        { label: $t('跟随软件设置'), value: 2 },
      ],
    },
    {
      type: 'textarea',
      label: $t('网址访问黑名单'),
      name: 'blockDomainList',
      value: data.blockDomainList,
      placeholder: $t('每行一个 URL，换行以添加多个'),
      tooltip: $t('阻止访问列表中指定的网站或网络服务。'),
    },
    {
      type: 'textarea',
      label: $t('网址访问白名单'),
      name: 'allowDomainList',
      value: data.allowDomainList,
      placeholder: $t('每行一个 URL，换行以添加多个'),
      tooltip: $t('仅允许访问列表中指定的网站或网络服务。'),
    },
  ])

  /** 切换内核类型时同步 Chrome 专有字段显隐与 browserVersion */
  async function syncCoreTypeRelatedFields(coreType: string, os?: string, osVersion?: string) {
    const isFirefox = isFirefoxCoreType(coreType)
    const browserVersionInput = findInputByName(windowInputs, 'browserVersion')

    // 切换内核时同步 Chrome 专有指纹字段的显隐
    const chromeOnlyFingerFields = ['webGpu', 'deviceInfo', 'deviceNameSwitch', 'macInfo']
    filterInputsByNames(highLevelInputs, chromeOnlyFingerFields).forEach((ipt) => {
      ipt.visible = !isFirefox
    })
    // deviceName / macAddr 的显隐额外受父控件状态约束
    const deviceNameInput = findInputByName(highLevelInputs, 'deviceName')
    if (deviceNameInput) {
      const deviceNameSwitchInput = findInputByName(highLevelInputs, 'deviceNameSwitch')
      deviceNameInput.visible = !isFirefox && deviceNameSwitchInput?.value === true
    }
    const macAddrInput = findInputByName(highLevelInputs, 'macAddr')
    if (macAddrInput) {
      const macInfoInput = findInputByName(highLevelInputs, 'macInfo')
      macAddrInput.visible = !isFirefox && macInfoInput?.value === true
    }

    // searchEngine 在 basicInputs（基础设置），非 windowInputs
    const searchEngineInput = findInputByName(basicInputs, 'searchEngine')
    if (searchEngineInput)
      searchEngineInput.visible = !isFirefox

    // sandboxPermission：Firefox 内核不支持沙盒设置，Chrome 专有
    const sandboxPermissionInput = findInputByName(highLevelInputs, 'sandboxPermission')
    if (sandboxPermissionInput)
      sandboxPermissionInput.visible = !isFirefox

    // enableGoogleLogin：Firefox 内核不支持谷歌登录设置，Chrome 专有
    const enableGoogleLoginInput = findInputByName(otherInputs, 'enableGoogleLogin')
    if (enableGoogleLoginInput)
      enableGoogleLoginInput.visible = !isFirefox

    // windowOpenSize：Firefox 下隐藏，值由 original 兜底传递
    const windowOpenSizeInput = findInputByName(basicInputs, 'windowOpenSize')
    if (windowOpenSizeInput) {
      const positionSwitchInput = findInputByName(basicInputs, 'positionSwitch')
      windowOpenSizeInput.visible = !isFirefox && positionSwitchInput?.value === true
    }
    const windowRatioPositionInput = findInputByName(basicInputs, 'windowRatioPosition')
    if (windowRatioPositionInput) {
      const positionSwitchInput = findInputByName(basicInputs, 'positionSwitch')
      windowRatioPositionInput.visible = !isFirefox && positionSwitchInput?.value === true
    }

    // disableSsl / disableSslList：Firefox 不支持 SSL 指纹设置，Chrome 专有
    const disableSslInput = findInputByName(highLevelInputs, 'disableSsl')
    if (disableSslInput)
      disableSslInput.visible = !isFirefox
    const disableSslListInput = findInputByName(highLevelInputs, 'disableSslList')
    if (disableSslListInput)
      disableSslListInput.visible = !isFirefox && disableSslInput?.value === true

    // syncExtensions：getNeedSyncLocalFileMap 的 Firefox 分支不包含此 key，Chrome 专有
    const syncExtensionsInput = findInputByName(otherInputs, 'syncExtensions')
    if (syncExtensionsInput)
      syncExtensionsInput.visible = !isFirefox

    if (browserVersionInput) {
      const showBrowserVersion = !isFirefox && userConfig?.uaModeSwitch === UaStrictMode.close
      browserVersionInput.visible = showBrowserVersion
      if (isFirefox) {
        browserVersionInput.value = []
        browserVersionInput._oldValue = []
        browserVersionInput.options = []
      }
      else if (showBrowserVersion && os && osVersion) {
        const options = await getBrowserVersion({ os, osVersion })
        browserVersionInput.options = options
        browserVersionInput.value = options.map(item => item.value)
        browserVersionInput._oldValue = browserVersionInput.value.slice()
      }
    }

    // 切换内核时重新生成 Speech Voices：Chrome 使用 Google TTS，Firefox 使用 Windows SAPI，列表完全不同
    const speechVoicesInput = findInputByName(highLevelInputs, 'speechVoices')
    if (speechVoicesInput?.value === true) {
      const osInput = findInputByName(windowInputs, 'os')
      const currentOs = original.os || osInput?.value?.value
      const { getSpeechSynthesis } = await globalThis.electronAPI.send('util:callRandomFingerprintFunc', {
        getSpeechSynthesis: [currentOs, coreType],
      })
      Object.assign(original, { speechVoicesValue: { enable: true, voices: getSpeechSynthesis } })
    }
  }

  inputsGroup.push(...[windowInputs, basicInputs, highLevelInputs, otherInputs])

  await run(() => syncCoreTypeRelatedFields(initialCoreType, osValue?.value, osVersionValue?.value))

  return [inputsGroup, original]
}

export function switchMoblieInputVisible(inputs: any[], value: boolean) {
  const keys = ['BatterySeparator', 'NetworkSeparator', 'bluetoothSeparator', 'openBattery', 'openNetwork', 'openBluetooth']
  const list = filterInputsByNames(inputs, keys)
  if (isEmptyValue(list))
    return

  list.forEach((input) => {
    Reflect.set(input, 'visible', value)
    input.change?.(input)
  })
}

export function genSwitchOptions(options?: { trueText: string, falseText: string, trueValue: any, falseValue: any }) {
  const defaultOptions = { trueText: $t('开启'), falseText: $t('关闭'), trueValue: true, falseValue: false }
  const { trueText, falseText, trueValue, falseValue } = { ...defaultOptions, ...options }
  return [
    { label: trueText, value: trueValue },
    { label: falseText, value: falseValue },
  ]
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
    disableSsl: false,
    disableSslList: [],
    isPositionBaseIp: true,
    // Chrome-only 字段的兜底默认值：Firefox 下这些字段被隐藏，
    // 通过 original 中的默认值保证提交时数据完整，不丢失字段
    webGpu: 'webgl',
    deviceInfo: true,
    deviceNameSwitch: true,
    macInfo: true,
    syncExtensions: false,
    enableGoogleLogin: 2,
  }
}

/**
 * 仅新用户注册礼物选择 ip 时使用
 */
export async function genDefaultProfileByCount(count: number, customerParams?: Record<string, any>) {
  const [inputsGroup, original] = await getInputsGroup()
  const defaultParams = getFormDataByList(inputsGroup)
  const fingerKeys: (keyof typeof defaultParams)[] = ['fontType', 'canvas', 'webGL', 'audioContext', 'speechVoices', 'clientRects', 'macInfo', 'os', 'osVersion', 'coreVersion', 'coreType']
  const fingerParams = Object.fromEntries(fingerKeys.map(key => [key, defaultParams[key]]))
  const fingerDetail = await globalThis.electronAPI.send('util:genRandomFingerprint', fingerParams, count)

  try {
    const { data } = await API.window.userBatchWindowInfoV2Create({
      createCount: count,
      ...toRaw(original),
      ...fingerDetail[0],
      ...toRaw(defaultParams),
      fingerDetail,
      proxyInfoList: Array.from({ length: count }, () => ({ id: 0, proxyCategory: 'noproxy' })),
      ...customerParams,
    })

    return data.windowIds
  }
  catch {
    return []
  }
}
