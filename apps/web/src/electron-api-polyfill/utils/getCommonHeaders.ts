import { osConfig } from '../constants'

export function getCommonRequestHeaders() {
  const isMac = osConfig.os === 'darwin'
  const isLinux = osConfig.os === 'linux'

  return {
    'source': 'web',
    'osVersion': osConfig.osVersion,
    'R-OS': isMac ? 'mac' : (isLinux ? 'linux' : 'win'),
    'R-OSBIT': isMac ? osConfig.cpu : osConfig.osBit,
    // ['R-DEVICE-ID']: await getDeviceId(), // Web 端难以获取唯一设备 ID，跳过
    'R-DEVICE-NAME': 'web', // Web 端无法获取系统用户名，返回空字符串
    'R-Local-Timezone-Offset': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'R-Local-System-Language': navigator.language, // 使用浏览器语言代替 app.getLocale()
  }
}
