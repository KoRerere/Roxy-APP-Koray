import { API } from "/@/api";
import type { PreferenceSettings } from "/@/views/sync-control/model";

/** 保存偏好设置 */
export async function savePreferenceSettings(preferenceSettings: PreferenceSettings) {
  const { code, msg } = await API.base.userSetUserConfigCreate({ preferenceSettings });
  console.log('saveSettings', preferenceSettings)
  if (code === 0) {
    const payload = toRaw({
      ...preferenceSettings.base,
      ...preferenceSettings.simulate,
    })
    electronAPI.send('syncControl:changeSyncSettings', payload)
  }
  return { code, msg }
}
