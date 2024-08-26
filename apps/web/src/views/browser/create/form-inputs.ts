import { API } from '/@/api'
import { formatInputsByList, hasOwnProperty } from '/@/utils'

function setInputVisible(inputs: any[], names: string | string[], state: boolean) {
  const _names: string[] = ([] as string[]).concat(names)
  inputs.forEach((item: any) => {
    if (_names.includes(item.name)) {
      item.visible = state
    }
  })
}

async function getUaWebgl(windowInputs: any) {
  const { os, osVersion, coreVersion } = formatInputsByList(windowInputs)
  const { data } = await API.window.userGetUaWebglList({ os, osVersion, coreVersion })

  const keys = Object.keys(data)

  windowInputs.forEach((inputs) => {
    inputs.forEach((input: any) => {
      if (keys.includes(input.name)) {
        input.value = data[input.name]
      }
    })
  })
}

export function getInputs(_data?: any) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')
  console.log('🚀 ~ getInputs ~  $dict_map:', $dict_map)

  const windowInputs = [
    [
      {
        label: '系统选择',
        slot: 'System',
        items: [
          {
            type: 'select',
            name: 'os',
            placeholder: '请选择系统',
            value: $dict_map.os[0].value,
            options: $dict_map.os,
            change(self: any, items: any) {
              const osVersionInput = items.find((item: any) => item.name === 'osVersion')
              if (self.value) {
                const osVersionOptions = $dict_map[`osVersion-${self.value}`]
                osVersionInput.value = osVersionOptions[0].value
                osVersionInput.options = osVersionOptions
                osVersionInput.disabled = false
              } else {
                osVersionInput.value = null
                osVersionInput.options = []
                osVersionInput.disabled = true
              }
            }
          },
          {
            type: 'select',
            name: 'osVersion',
            placeholder: '请选择版本',
            value: $dict_map['osVersion-Windows'][0].value,
            options: $dict_map['osVersion-Windows']
          }
        ]
      },
      {
        type: 'select',
        label: '浏览器内核',
        name: 'coreVersion',
        placeholder: '请选择浏览器内核',
        value: $dict_map.coreVersion[0],
        options: $dict_map.coreVersion
      },
      {
        type: 'textarea',
        label: 'User-Agent',
        name: 'userAgent',
        value:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.202 Safari/537.36',
        placeholder: 'placeholder',
        icon: 'mdi mdi-shuffle-variant',
        iconClick: async (self: any, inputs: any) => {
          // const { os, osVersion, coreVersion } = formatInputs(inputs)
          // API.window.userGetUaWebglList({ os, osVersion, coreVersion }).then((res) => {
          //   self.value = res.data.userAgent
          // })
          getUaWebgl(windowInputs)
        }
      },
      {
        separator: true
      },
      {
        label: '#xProxy(Direct)',
        value: null,
        slot: 'Proxy'
      },
      {
        separator: true
      },
      {
        label: '#xURLs',
        value: null,
        slot: 'urls',
        tooltip: 'man!'
      },
      {
        label: '#xAccounts',
        value: null,
        slot: 'accounts'
      },
      {
        type: 'textarea',
        label: '#xCookies',
        name: 'cookies',
        value: null,
        placeholder: 'Paste your cookies with JSON format',
        icon: 'mdi mdi-paperclip',
        formatValue: (value: string) => {
          return value
        }
      }
    ],
    [
      {
        type: 'radio',
        label: '语言',
        name: 'isLanguageBaseIp',
        value: true,
        options: [
          { label: '跟随ip匹配true', value: true },
          { label: '自定义false', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'language', input.value === false)
        }
      },
      {
        type: 'select',
        label: '#x ',
        name: 'language',
        placeholder: '选择语言',
        value: { label: '#x中文(CN)', value: 'zh-CN' },
        options: [],
        visible: false
      },
      {
        type: 'radio',
        label: '语言界面',
        name: 'languageInterface',
        value: true,
        options: [
          { label: '跟随ip匹配true', value: true },
          { label: '自定义false', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'displayLanguage', input.value === false)
        }
      },
      {
        type: 'select',
        label: '#x ',
        name: 'displayLanguage',
        placeholder: '选择语言',
        value: { label: '#x日文(JP)', value: 'ja-JP' },
        options: [],
        visible: false
      },
      {
        type: 'radio',
        label: '时区',
        name: 'isTimeZone',
        value: true,
        options: [
          { label: '跟随ip匹配', value: true },
          { label: '自定义', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'timeZone', input.value === false)
        }
      },
      {
        type: 'select',
        label: '#x ',
        name: 'timeZone',
        placeholder: '选择时区',
        value: { label: '#x北京时间', value: 'Asia/Shanghai' },
        options: [
          { label: '#x北京时间', value: 'Asia/Shanghai' },
          { label: '#x上海时间', value: 'Asia/Shanghai' },
          { label: '#x香港时间', value: 'Asia/Shanghai' },
          { label: '#x澳门时间', value: 'Asia/Shanghai' },
          { label: '#x新加坡时间', value: 'Asia/Shanghai' },
          { label: '#x东京时间', value: 'Asia/Tokyo' },
          { label: '#x巴黎时间', value: 'Europe/Paris' }
        ],
        visible: false
      },
      {
        type: 'radio',
        label: '地理位置提示',
        name: 'position',
        value: 0,
        options: [
          { label: '询问', value: 0 },
          { label: '允许', value: 1 },
          { label: '禁用', value: 2 }
        ],
        change(_v: any, input: any, inputs: any) {
          const ipt = inputs.find((ipt: any) => ipt.name === 'isPositionBaseIp')
          if (ipt) {
            const visible = input.value !== 2
            ipt.visible = visible
            if (!visible) {
              ipt.value = true
              ipt.change(ipt.value, ipt, inputs)
            }
          }
        }
      },
      {
        type: 'radio',
        label: '地理位置',
        name: 'isPositionBaseIp',
        value: true,
        options: [
          { label: '跟随ip匹配', value: true },
          { label: '自定义', value: false }
        ],
        visible: true,
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, ['longitude', 'latitude', 'precisionPos'], input.value === false)
        }
      },
      {
        type: 'text',
        label: '经度',
        name: 'longitude',
        value: null,
        placeholder: '请填写经度, 示例: -40.123',
        visible: false
      },
      {
        type: 'text',
        label: '纬度',
        name: 'latitude',
        value: null,
        placeholder: '请填写纬度, 示例: 30.123',
        visible: false
      },
      {
        type: 'text',
        label: '精度(米)',
        name: 'precisionPos',
        value: null,
        placeholder: '请填写精度, 范围: 10-5000',
        visible: false
      },
      {
        type: 'radio',
        label: '声音',
        name: 'forbidAudio',
        value: true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '图片',
        name: 'forbidImage',
        value: 1,
        options: [
          { label: '加载', value: 1 },
          { label: '禁止', value: 2 }
        ]
      },
      {
        type: 'radio',
        label: '视频',
        name: 'forbidMedia',
        value: true,
        options: [
          { label: '允许', value: true },
          { label: '禁止', value: false }
        ]
      },
      {
        label: '#x窗口大小',
        slot: 'windowSize',
        items: [
          {
            type: 'text',
            name: 'windowWidth',
            placeholder: 'width'
          },
          {
            type: 'text',
            name: 'windowHeight',
            placeholder: 'height'
          }
        ]
      }
    ],
    [
      {
        type: 'radio',
        label: '分辨率',
        name: 'resolutionType',
        value: false,
        options: [
          { label: '跟随电脑', value: false },
          { label: '自定义', value: true }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'resolutionValue', input.value === true)
        }
      },
      {
        type: 'select',
        label: '#x分辨率值',
        name: 'resolutionValue',
        value: { label: '#x1280 x 720', value: true },
        options: [
          { label: '#x1280 x 720', value: true },
          { label: '#x1920 x 1080', value: false },
          { label: '#x2560 x 1440', value: '3' },
          { label: '#x3840 x 2160', value: '4' }
        ],
        visible: false
      },
      {
        type: 'radio',
        label: '字体指纹',
        name: 'fontType',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '系统默认', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'WebRTC',
        name: 'webRTC',
        value: 0,
        options: [
          { label: '替换', value: 0 },
          { label: '真实', value: 1 },
          { label: '禁止', value: 2 }
        ]
      },
      {
        type: 'radio',
        label: 'WebGL图像',
        name: 'webGL',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'WebGL Info',
        name: 'webGLInfo',
        value: false,
        options: [
          { label: '真实', value: true },
          { label: '自定义', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, ['webGLManufacturer', 'webGLRender'], input.value === false)
        }
      },
      {
        type: 'text',
        label: 'WebGL厂商',
        name: 'webGLManufacturer',
        value: null,
        placeholder: '',
        icon: 'mdi mdi-shuffle-variant',
        visible: true
      },
      {
        type: 'textarea',
        label: 'WebGL渲染',
        name: 'webGLRender',
        value: null,
        placeholder: '',
        rows: 3,
        icon: 'mdi mdi-shuffle-variant',
        visible: true
      },
      {
        type: 'radio',
        label: 'WebGpu',
        name: 'webGpu',
        value: 'webgl',
        options: [
          { label: '基于WebGL匹配', value: 'webgl' },
          { label: '真实', value: 'real' },
          { label: '禁用', value: 'block' }
        ]
      },
      {
        type: 'radio',
        label: 'canvas',
        name: 'canvas',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'AudioContext',
        name: 'audioContext',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'Speech Voices',
        name: 'speechVoices',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'Do Not Track',
        name: 'doNotTrack',
        value: true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'ClientRects',
        name: 'clientRects',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false }
        ]
      },
      {
        type: 'radio',
        label: '媒体设备',
        name: 'deviceInfo',
        value: true,
        options: [
          { label: '随机', value: true },
          { label: '真实', value: false }
        ]
      },
      {
        type: 'radio',
        label: '设备名称',
        name: 'deviceNameSwitch',
        value: false,
        options: [
          { label: '随机', value: false },
          { label: '真实', value: true }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'deviceName', input.value === false)
        }
      },
      {
        type: 'text',
        label: '#x ',
        name: 'deviceName',
        value: null,
        placeholder: '',
        icon: 'mdi mdi-shuffle-variant',
        visible: true
      },
      {
        type: 'radio',
        label: 'MAC地址',
        name: 'macInfo',
        value: false,
        options: [
          { label: '真实', value: true },
          { label: '自定义', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'macAddr', input.value === false)
        }
      },
      {
        type: 'text',
        label: '#x ',
        name: 'macAddr',
        value: null,
        placeholder: '',
        icon: 'mdi mdi-shuffle-variant',
        visible: true
      },
      {
        type: 'select',
        label: '#x硬件并发数',
        name: 'hardwareParallelNumber',
        value: { label: '#x2核', value: false },
        placeholder: 'Username for your server',
        options: Array.from({ length: 8 }, (_, i) => ({
          label: `${(i + 1) * 2}核`,
          value: `${(i + 1) * 2}`
        }))
      },
      {
        type: 'select',
        label: '#x设备内存',
        name: 'DeviceMemory',
        value: { label: '#x2G', value: false },
        placeholder: 'Username for your server',
        options: Array.from({ length: 5 }, (_, i) => ({
          label: `${(i + 1) * 2}G`,
          value: `${(i + 1) * 2}`
        }))
      },
      {
        type: 'radio',
        label: 'SSL指纹设置',
        name: 'disableSsl',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'disableSslList', input.value === true)
        }
      },
      {
        type: 'select',
        label: '#x ',
        name: 'disableSslList',
        value: null,
        placeholder: '选择SSL指纹设置',
        options: [
          { label: '#x1280 x 720', value: '1' },
          { label: '#x1920 x 1080', value: '2' },
          { label: '#x2560 x 1440', value: '3' },
          { label: '#x3840 x 2160', value: '4' }
        ],
        visible: false
      },
      {
        type: 'radio',
        label: '端口扫描保护',
        name: 'portScanProtect',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ],
        change(_v: any, input: any, inputs: any) {
          setInputVisible(inputs, 'portScanList', input.value === true)
        }
      },
      {
        type: 'text',
        label: '扫描白名单',
        name: 'portScanList',
        value: null,
        placeholder: '输入整数，多个用英文逗号隔开',
        visible: false
      },
      {
        type: 'radio',
        label: '硬件加速模式',
        name: 'useGpu',
        value: true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '禁用沙盒',
        name: 'sandboxPermission',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'text',
        label: '启动参数',
        name: 'startupParam',
        value: null,
        placeholder: '浏览器启动参数,如 --mute,多个参数以英文逗号分隔'
      }
    ],
    [
      {
        type: 'radio',
        label: '窗口名称',
        name: 'isDisplayName',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步书签',
        name: 'syncBookmark',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步历史记录',
        name: 'syncHistory',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步标签页',
        name: 'syncTab',
        value: true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步Cookie',
        name: 'syncCookie',
        value: true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步扩展应用程序',
        name: 'syncExtensions',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步已保存的用户名密码',
        name: 'syncPassword',
        value: true,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步IndexedDB',
        name: 'syncIndexedDb',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '同步Local Storage',
        name: 'syncLocalStorage',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '启动浏览器前删除缓存文件',
        name: 'clearCacheFile',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '启动浏览器前删除Cookie',
        name: 'clearCookie',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '启动浏览器时随机指纹',
        name: 'randomFingerprint',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '弹出保存密码提示',
        name: 'forbidSavePassword',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: '网络不通停止打开',
        name: 'stopOpenNet',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'IP发生变化停止打开',
        name: 'stopOpenIP',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      },
      {
        type: 'radio',
        label: 'IP对应国家 / 地区发生改变停止打开',
        name: 'stopOpenPosition',
        value: false,
        options: [
          { label: '开启', value: true },
          { label: '关闭', value: false }
        ]
      }
    ]
  ]

  return { windowInputs }
}
