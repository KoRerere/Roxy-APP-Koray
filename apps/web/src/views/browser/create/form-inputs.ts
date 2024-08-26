function setInputVisible(inputs: any[], names: string | string[], state: boolean) {
  const _names: string[] = ([] as string[]).concat(names)
  inputs.forEach((item: any) => {
    if (_names.includes(item.name)) {
      item.visible = state
    }
  })
}

const languageOptions = [
  { label: '中文(CN)', value: 'zh-CN' },
  { label: '英文(US)', value: 'en-US' },
  { label: '日文(JP)', value: 'ja-JP' },
  { label: '韩文(KR)', value: 'ko-KR' },
  { label: '法文(FR)', value: 'fr-FR' },
  { label: '德文(DE)', value: 'de-DE' }
]

export const windowInputs = [
  {
    label: 'System',
    slot: 'System',
    items: [
      {
        type: 'select',
        name: 'system',
        placeholder: 'select system',
        options: [
          { label: 'windows', value: '1' },
          { label: 'macOS', value: '2' },
          { label: 'Android', value: '3' },
          { label: 'IOS', value: '4' }
        ]
      },
      {
        type: 'select',
        name: 'version',
        placeholder: 'select version',
        options: [
          { label: 'ccc', value: 'C' },
          { label: 'ddd', value: 'D' }
        ]
      }
    ]
  },
  {
    type: 'select',
    label: 'Kernel',
    name: 'kernel',
    value: null,
    placeholder: 'Username for your server',
    options: [
      { icon: 'mdi mdi-currency-eur', label: 'Australia', value: 'AU' },
      { icon: 'mdi mdi-currency-fra', label: 'Brazil', value: 'BR' },
      { icon: 'mdi mdi-currency-gbp', label: 'China', value: 'CN' },
      { icon: 'mdi mdi-currency-ils', label: 'Egypt', value: 'EG' },
      { icon: 'mdi mdi-currency-inr', label: 'France', value: 'FR' },
      { icon: 'mdi mdi-currency-jpy', label: 'Germany', value: 'DE' }
    ]
  },
  {
    type: 'textarea',
    label: 'User-Agent',
    name: 'userAgent',
    value: null,
    placeholder: 'placeholder',
    icon: 'mdi mdi-shuffle-variant'
  },
  {
    separator: true
  },
  {
    label: 'Proxy(Direct)',
    value: null,
    slot: 'Proxy'
  },
  {
    separator: true
  },
  {
    label: 'URLs',
    value: null,
    slot: 'urls',
    tooltip: 'man!'
  },
  {
    label: 'Accounts',
    value: null,
    slot: 'accounts'
  },
  {
    type: 'textarea',
    label: 'Cookies',
    name: 'cookies',
    value: null,
    placeholder: 'Paste your cookies with JSON format',
    icon: 'mdi mdi-paperclip',
    formatValue: (value, input, inputs) => {}
  }
]

export const basicInputs = [
  {
    type: 'radio',
    label: '语言',
    name: 'language',
    value: '1',
    options: [
      { label: '跟随ip匹配', value: '1' },
      { label: '自定义', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'lang1', input.value === '2')
    }
  },
  {
    type: 'select',
    label: ' ',
    name: 'lang1',
    placeholder: '选择语言',
    value: { label: '中文(CN)', value: 'zh-CN' },
    options: languageOptions,
    visible: false
  },
  {
    type: 'radio',
    label: '语言界面',
    name: 'languageInterface',
    value: '1',
    options: [
      { label: '跟随ip匹配', value: '1' },
      { label: '自定义', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'lang2', input.value === '2')
    }
  },
  {
    type: 'select',
    label: ' ',
    name: 'lang2',
    placeholder: '选择语言',
    value: { label: '日文(JP)', value: 'ja-JP' },
    options: languageOptions,
    visible: false
  },
  {
    type: 'radio',
    label: '时区',
    name: 'timeZone',
    value: '1',
    options: [
      { label: '跟随ip匹配', value: '1' },
      { label: '自定义', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'time1', input.value === '2')
    }
  },
  {
    type: 'select',
    label: ' ',
    name: 'time1',
    placeholder: '选择时区',
    value: { label: '北京时间', value: 'Asia/Shanghai' },
    options: [
      { label: '北京时间', value: 'Asia/Shanghai' },
      { label: '上海时间', value: 'Asia/Shanghai' },
      { label: '香港时间', value: 'Asia/Shanghai' },
      { label: '澳门时间', value: 'Asia/Shanghai' },
      { label: '新加坡时间', value: 'Asia/Shanghai' },
      { label: '东京时间', value: 'Asia/Tokyo' },
      { label: '巴黎时间', value: 'Europe/Paris' }
    ],
    visible: false
  },
  {
    type: 'radio',
    label: '地理位置提示',
    name: 'geographicalLocation',
    value: '3',
    options: [
      { label: '询问', value: '1' },
      { label: '允许', value: '2' },
      { label: '禁用', value: '3' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'geographical', input.value !== '3')
    }
  },
  {
    type: 'radio',
    label: '地理位置',
    name: 'geographical',
    value: '1',
    options: [
      { label: '跟随ip匹配', value: '1' },
      { label: '自定义', value: '2' }
    ],
    visible: false
  },
  {
    type: 'radio',
    label: '声音',
    name: 'sound',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '图片',
    name: 'image',
    value: '1',
    options: [
      { label: '加载', value: '1' },
      { label: '禁止', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '视频',
    name: 'video',
    value: '1',
    options: [
      { label: '允许', value: '1' },
      { label: '禁止', value: '2' }
    ]
  },
  {
    label: '窗口大小',
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
]

export const hardwareInputs = [
  {
    type: 'radio',
    label: '分辨率',
    name: 'resolution',
    value: '1',
    options: [
      { label: '真实', value: '1' },
      { label: '自定义', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'resolutionValue', input.value === '2')
    }
  },
  {
    type: 'select',
    label: '分辨率值',
    name: 'resolutionValue',
    value: { label: '1280 x 720', value: '1' },
    options: [
      { label: '1280 x 720', value: '1' },
      { label: '1920 x 1080', value: '2' },
      { label: '2560 x 1440', value: '3' },
      { label: '3840 x 2160', value: '4' }
    ],
    visible: false
  },
  {
    type: 'radio',
    label: '字体指纹',
    name: 'fontFingerprint',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'webRTC',
    name: 'webRTC',
    value: '1',
    options: [
      { label: '替换', value: '1' },
      { label: '真实', value: '2' },
      { label: '禁止', value: '3' }
    ]
  },
  {
    type: 'radio',
    label: 'WebGL图像',
    name: 'webglImage',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'WebGL Info',
    name: 'webglInfo',
    value: '1',
    options: [
      { label: '真实', value: '1' },
      { label: '自定义', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, ['WebGLManufacturer', 'WebGLRender'], input.value === '2')
    }
  },
  {
    type: 'text',
    label: 'WebGL厂商',
    name: 'WebGLManufacturer',
    value: null,
    placeholder: '',
    icon: 'mdi mdi-shuffle-variant',
    visible: false
  },
  {
    type: 'textarea',
    label: 'WebGL渲染',
    name: 'WebGLRender',
    value: null,
    placeholder: '',
    rows: 3,
    icon: 'mdi mdi-shuffle-variant',
    visible: false
  },
  {
    type: 'radio',
    label: 'WebGpu',
    name: 'webGpu',
    value: '1',
    options: [
      { label: '基于WebGL匹配', value: '1' },
      { label: '自定义', value: '2' },
      { label: '禁用', value: '3' }
    ]
  },
  {
    type: 'radio',
    label: 'canvas',
    name: 'canvas',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'AudioContext',
    name: 'AudioContext',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'Speech Voices',
    name: 'speechvoices',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'Do Not Track',
    name: 'donottrack',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'ClientRects',
    name: 'clientrects',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '媒体设备',
    name: 'mediaEquipment',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '设备名称',
    name: 'deviceName',
    value: '1',
    options: [
      { label: '随机', value: '1' },
      { label: '真实', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'deviceName2', input.value === '1')
    }
  },
  {
    type: 'text',
    label: ' ',
    name: 'deviceName2',
    value: null,
    placeholder: '',
    icon: 'mdi mdi-shuffle-variant',
    visible: true
  },
  {
    type: 'radio',
    label: 'MAC地址',
    name: 'macAddress',
    value: '1',
    options: [
      { label: '真实', value: '1' },
      { label: '自定义', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'macAddress2', input.value === '2')
    }
  },
  {
    type: 'text',
    label: ' ',
    name: 'macAddress2',
    value: null,
    placeholder: '',
    icon: 'mdi mdi-shuffle-variant',
    visible: false
  },
  {
    type: 'select',
    label: '硬件并发数',
    name: 'hardwareParallelNumber',
    value: { label: '2核', value: '2' },
    placeholder: 'Username for your server',
    options: Array.from({ length: 8 }, (_, i) => ({
      label: `${(i + 1) * 2}核`,
      value: `${(i + 1) * 2}`
    }))
  },
  {
    type: 'select',
    label: '设备内存',
    name: 'DeviceMemory',
    value: { label: '2G', value: '2' },
    placeholder: 'Username for your server',
    options: Array.from({ length: 5 }, (_, i) => ({
      label: `${(i + 1) * 2}G`,
      value: `${(i + 1) * 2}`
    }))
  },
  {
    type: 'radio',
    label: 'SSL指纹设置',
    name: 'sslFingerprintSettings',
    value: '2',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'sslFingerprintSettings1', input.value === '1')
    }
  },
  {
    type: 'select',
    label: ' ',
    name: 'sslFingerprintSettings1',
    value: null,
    placeholder: '选择SSL指纹设置',
    options: [
      { label: '1280 x 720', value: '1' },
      { label: '1920 x 1080', value: '2' },
      { label: '2560 x 1440', value: '3' },
      { label: '3840 x 2160', value: '4' }
    ],
    visible: false
  },
  {
    type: 'radio',
    label: '端口扫描保护',
    name: 'portScanningProtection',
    value: '2',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ],
    change(_v: any, input: any, inputs: any) {
      setInputVisible(inputs, 'portScanningProtection2', input.value === '1')
    }
  },
  {
    type: 'text',
    label: '扫描白名单',
    name: 'portScanningProtection2',
    value: null,
    placeholder: '输入整数，多个用英文逗号隔开',
    visible: false
  },
  {
    type: 'radio',
    label: '硬件加速模式',
    name: 'hardwareAccelerationMode',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '禁用沙盒',
    name: 'disableSandbox',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'text',
    label: '启动参数',
    name: 'startParameters',
    value: null,
    placeholder: '浏览器启动参数,如 --mute,多个参数以英文逗号分隔'
    // icon: 'mdi mdi-shuffle-variant',
  }
]

export const otherInputs = [
  {
    type: 'radio',
    label: '窗口名称',
    name: 'resolution1',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步书签',
    name: 'resolution2',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步历史记录',
    name: 'resolution3',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步标签页',
    name: 'resolution4',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步Cookie',
    name: 'resolution5',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步扩展应用程序',
    name: 'resolution6',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步已保存的用户名密码',
    name: 'resolution7',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步IndexedDB',
    name: 'resolution8',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '同步Local Storage',
    name: 'resolution9',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '启动浏览器前删除缓存文件',
    name: 'resolution10',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '启动浏览器前删除Cookie',
    name: 'resolution11',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '启动浏览器时随机指纹',
    name: 'resolution12',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '弹出保存密码提示',
    name: 'resolution13',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: '网络不通停止打开',
    name: 'resolution14',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'IP发生变化停止打开',
    name: 'resolution15',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  },
  {
    type: 'radio',
    label: 'IP对应国家 / 地区发生改变停止打开',
    name: 'resolution16',
    value: '1',
    options: [
      { label: '开启', value: '1' },
      { label: '关闭', value: '2' }
    ]
  }
]
