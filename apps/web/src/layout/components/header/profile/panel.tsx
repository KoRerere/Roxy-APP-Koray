import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
// import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { SettingAppearance, UaStrictMode } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { getDictMap, isWindows } from '/@/utils'
import type { Items, SettingsModule } from './type'
import FolderDirectory from './components/folder-directory.vue'
import UploadAvatar from './components/upload-avatar.vue'
import InputNumber from 'primevue/inputnumber'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { getResetPasswordFormSchemas, getSettingPasswordFormSchemas } from '/@/layout/components/header/profile/components/schemas'
import { RxAlert } from '/@/components/rx-alert'
import router from '/@/router'
import LoginDevices from './components/login-devices.vue'
import { format } from 'date-fns'

const { fetchUserInfo, updateUserConfig } = useUserStore()

const toast = ref()
const dialog = ref()
let dialogRef;

async function updateAvatar(item: Items) {
  const { code, msg } = await API.base.userUploadAvatarCreate({ avatar: item.value })
  toast.value?.(code, msg)
  if (code === 0) {
    fetchUserInfo()
  }
}

async function updateUserName(item: Items) {
  if (item.oldValue === item.value)
    return

  const { code, msg } = await API.base.userChangeUsernameCreate({ userName: item.value })
  toast.value?.(code, msg)
  if (code === 0) {
    fetchUserInfo()
    item.oldValue = item.value
  }
}

/** 显示设置密码弹窗 */
async function showSettingPasswordDialog() {
  console.log('showSettingPasswordDialog')
  const userStore = useUserStore()

  await dialog.value.showModal({
    header: $t('设置密码'),
    class: 'w-[400px]',
    schemas: getSettingPasswordFormSchemas(),
    formProps: {
      layout: 'vertical',
      initialValues: {
        email: userStore.userInfo?.email,
      }
    },
    dialogSlots: {
      beforeForm: () => (
        <RxAlert visible={true} type="info" title={$t('使用邮箱和密码登录您的账号')} closable={false} class="w-full" />
      ),
    },
    handleOk: async (params: any) => {
      const res = await API.base.userSettingPasswordCreate({ ...params })
      toast.value(res.code, res.msg)
      if (res.code === 0 && params.password) {
        userStore.setPassword(params.password)
        toast.value(0, $t('密码设置成功'))
        userStore.fetchUserInfo()
      } else {
        return Promise.reject(res.msg)
      }
    },
  })
}

/** 显示重置密码弹窗 */
async function showResetPasswordDialog() {
  console.log('showResetPasswordDialog')
  const userStore = useUserStore()

  await dialog.value.showModal({
    header: $t('重置密码'),
    class: 'w-[400px]',
    schemas: getResetPasswordFormSchemas(),
    formProps: {
      layout: 'vertical',
    },
    handleOk: async (params: any) => {
      const res = await API.base.userChangePwdCreate({
        old_pwd: params.oldPassword,
        new_pwd: params.newPassword,
      })
      toast.value(res.code, res.msg)
      if (res.code === 0) {
        userStore.setPassword('')
        userStore.clearUserInfo()
        toast.value(0, $t('密码重置成功'))
        dialogRef.value.close();
        setTimeout(() => {
          router.push({ name: 'login' })
        })
      } else {
        return Promise.reject(res.msg)
      }
    },
  })
}

async function saveUserConfig(item: Items, items: SettingsModule | null = null) {
  if (!item.vaildator || item.vaildator(item)) {
    const value = item.formatValue?.(item) ?? item.value
    const { code, msg } = await API.base.userSetUserConfigCreate({ [item.name as any]: value })
    toast.value?.(code, msg)
    if (code === 0) {
      electronAPI.send('app:saveSoftConfig', { [item.name as any]: value })
      updateUserConfig()
    }

    if (items && item.name === 'systemProxySwitch') {
      const v2 = items.list[0].items.find((i: any) => i.name === 'v2raySwitch')

      if (v2) {
        v2.hide = !value
      }
    }
  }
}

async function detectLocalNetwork(item: Items) {
  try {
    item.value = await window.electronAPI.send('proxy:detectNetwork', 'local')
  }
  catch (error) {
    item.value = null
    toast.value?.(-1, error)
  }
}

async function detectSystemNetwork(item: Items) {
  try {
    item.value = await window.electronAPI.send('proxy:detectNetwork', 'system')
  }
  catch (error) {
    item.value = null
    toast.value?.(-1, error)
  }
}

export function getSettings() {
  const [showToast] = useResponseToast()
  const formDialog = useFormDialog()
  toast.value = showToast
  dialog.value = formDialog[0]
  dialogRef = inject('dialogRef')

  return [
    {
      label: $t('个人信息'),
      name: 'profiles',
      icon: 'base/rx_ic_user_circle',
    },
    {
      label: $t('软件设置'),
      name: 'preferences',
      icon: 'base/rx_ic_slider',
    },
    {
      label: $t('网络设置'),
      name: 'network',
      icon: 'base/rx_ic_wifi',
    },
    {
      label: $t('登录历史'),
      name: 'loginActivity',
      icon: 'base/rx_ic_monitor',
    },
  ] as const
}

export async function getProfilePanel(data?: any): Promise<SettingsModule> {
  const userStore = useUserStore()

  return {
    title: $t('个人信息'),
    description: $t('设置您的账号信息和邮箱'),
    list: [
      {
        items: [
          {
            label: $t('个人头像'),
            text: $t('推荐尺寸为 64*64，最大不超过 2MB'),
            name: 'avatar',
            classes: 'flex-col !items-start gap-4',
            value: data?.avatar ?? '',
            props: {
              class: 'resize-none w-full',
              userName: data.userName,
              avatarColor: data.avatarColor,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <UploadAvatar {...item.props} {...props} onChange={() => updateAvatar(item)} />
              )
            },
          },
          {
            label: $t('邮箱地址'),
            name: 'email',
            value: data?.email ?? '',
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <InputText {...item.props} {...props} class="!w-0 flex-1" type="text" disabled />
              )
            },
          },
          {
            label: $t('用户名'),
            name: 'userName',
            value: data?.userName ?? '',
            oldValue: data?.userName,
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <InputText {...item.props} {...props} class="!w-0 flex-1" type="text" onBlur={() => updateUserName(item)} />
              )
            },
          },
          {
            label: $t('密码'),
            name: 'password',
            component: ({ item, ...props }: { item: Items, props: any }) => {
              const hasPassword = userStore.userInfo?.setPasswordStatus
              return (
                <div class="w-full flex items-center justify-between">
                  <div>{hasPassword ? '********' : $t('当前未设置密码')}</div>
                  <RxButton severity="secondary" size="sm" outlined onClick={hasPassword ? showResetPasswordDialog : showSettingPasswordDialog}>
                    {hasPassword ? $t('重置密码') : $t('设置密码')}
                  </RxButton>
                </div>
              )
            },
          },
        ],
      },
    ],
  }
}

export async function getPreferencesPanel(data?: any): Promise<SettingsModule> {
  // const $dict_map = await getDictMap()
  const softConfig = await electronAPI.send('app:getSoftConfig')
  return {
    title: $t('软件设置'),
    description: $t('设置您的客户端使用偏好'),
    list: [
      // !todo: 后台暂时没做，一期暂时隐藏
      // {
      //   subtitle: $t('界面'),
      //   items: [
      //     {
      //       label: $t('语言'),
      //       text: $t('没有您需要的语言? <span class="text-blue">联系我们</span>'),
      //       name: 'language',
      //       value: $dict_map.language?.find((item: any) => item.value === data.language) ?? $dict_map.language[0],
      //       props: {
      //         filter: false,
      //         optionValue: 'value',
      //         options: $dict_map.language,
      //         virtualScrollerOptions: { itemSize: 38 },
      //       },
      //       formatValue: (item: Items) => item.value.value,
      //       component: ({ item, ...props }: { item: Items, props: any }) => {
      //         return (
      //           <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
      //         )
      //       },
      //     },
      //     {
      //       label: $t('时区'),
      //       text: $t('#Some hints for you'),
      //       name: 'timeZone',
      //       value: data?.timeZone ?? '',
      //       props: {
      //         filter: false,
      //         optionValue: 'value',
      //         options: $dict_map.timeZone,
      //       },
      //       component: ({ item, ...props }: { item: Items, props: any }) => {
      //         return (
      //           <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
      //         )
      //       },
      //     },
      //     {
      //       label: $t('#Appearance'),
      //       text: $t('#Themes for different mode'),
      //       name: 'appearance',
      //       value: data?.appearance?.toString() ?? '',
      //       props: {
      //         filter: false,
      //         optionValue: 'value',
      //         options: [
      //           { label: $t('系统'), value: `${SettingAppearance.system}` },
      //           { label: $t('#Light'), value: `${SettingAppearance.light}` },
      //           { label: $t('#Dark'), value: `${SettingAppearance.dark}` },
      //         ],
      //       },
      //       formatValue: (item: Items) => Number(item.value),
      //       component: ({ item, ...props }: { item: Items, props: any }) => {
      //         return (
      //           <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
      //         )
      //       },
      //     },
      //   ],
      // },
      {
        subtitle: $t('窗口'),
        items: [
          {
            label: $t('UA 严格模式'),
            text: () => (
              <div class="w-[370px]">{$t('关闭此选项后，可以自定义浏览器的版本。一般情况下我们推荐保持该选项开启。')}</div>
            ),
            name: 'uaModeSwitch',
            value: data?.uaModeSwitch ?? UaStrictMode.open,
            props: {
              trueValue: UaStrictMode.open,
              falseValue: UaStrictMode.close,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxToggleSwitch {...item.props} {...props} onChange={() => saveUserConfig(item)}></RxToggleSwitch>
              )
            },
          },
        ],
      },
      {
        subtitle: $t('本地设置'),
        items: [
          {
            label: $t('缓存目录'),
            text: $t('设置 RoxyBrowser 缓存路径'),
            name: 'browserCacheRootDir',
            value: softConfig.browserCacheRootDir ?? '',
            props: {
              disabled: true,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <FolderDirectory item={item} {...item.props} {...props} onChange={() => saveUserConfig(item)}></FolderDirectory>
              )
            },
          },
          {
            label: $t('系统日志'),
            name: 'systemLogDir',
            value: '',
            component: () => {
              return (
                <RxButton severity="secondary" outlined onClick={() => electronAPI.send('app:showLogDir')}>{$t('查看详情')}</RxButton>
              )
            },
          },
          {
            label: $t('内存限制'),
            name: 'memoryLimit',
            value: data?.memoryLimit ?? '',
            text: () => (
              <div class="w-[370px]">{$t('内存使用达到设置的阈值时，将停止打开浏览器窗口')}</div>
            ),
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <div class="flex">
                  <IconField class="w-[60px]">
                    <InputNumber {...item.props} {...props} name={item.name} useGrouping={false} fluid min={0} max={100} onValueChange={() => saveUserConfig(item)} />
                    <InputIcon>%</InputIcon>
                  </IconField>
                </div>
              )
            },
          },
          {
            label: $t('关闭客户端'),
            text: $t('当点击关闭客户端时'),
            name: 'closeSoft',
            value: data?.closeSoft ?? '',
            props: {
              filter: false,
              optionValue: 'value',
              options: [
                { label: $t('弹出提示'), value: 'pop' },
                { label: $t('最小化到托盘'), value: 'min' },
                { label: $t('退出程序'), value: 'exit' },
              ],
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
              )
            },
          },
        ],
      },
    ],
  }
}

export async function getNetworkPanel(data?: any): Promise<SettingsModule> {
  const $dict_map = await getDictMap()
  const items = reactive({
    title: $t('网络设置'),
    description: $t('设置您的客户端网络连接，包括白名单和默认 IP 查询渠道'),
    list: [
      {
        subtitle: $t('网络连接方式'),
        items: [
          {
            label: $t('使用系统代理'),
            text: () => (
              <div>
                <div>{$t('关闭后使用本地网络连接')}</div>
                <div class="w-[370px] text-red line-height-normal">{$t('改变此开关状态后，请重启窗口以确保生效')}</div>
              </div>
            ),
            name: 'systemProxySwitch',
            value: data?.systemProxySwitch ?? false,
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxToggleSwitch {...item.props} {...props} onChange={() => saveUserConfig(item, items)}></RxToggleSwitch>
              )
            },
          },
          {
            label: $t('网络兼容模式'),
            text: $t('当系统代理识别失败时尝试启用'),
            name: 'v2raySwitch',
            hide: !data?.systemProxySwitch,
            value: data?.v2raySwitch ?? false,
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxToggleSwitch {...item.props} {...props} onChange={() => saveUserConfig(item)}></RxToggleSwitch>
              )
            },
          },
          {
            label: $t('检查系统代理'),
            component: ({ item }: any) => {
              return (
                <RxButton class="mb-1.5" size="sm" outlined severity="secondary" icon="base/rx_ic_speed_test" label={$t('检测')} onClick={() => detectSystemNetwork(item)}></RxButton>
              )
            },
            afterComponent: ({ item }: any) => {
              return (
                item.value && (
                  <Message icon="pi pi-check-circle" severity="success" closable={true} pt={{ content: '!items-start' }} onClose={() => { item.value = null }}>
                    <div class="text-3 color-[#171C1F]">
                      {$t('检测成功')}
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      {$t('位置')}
                      :
                      {item.value.country_code}
                      /
                      {item.value.country}
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      IP:
                      {item.value.ip}
                    </div>
                  </Message>
                )
              )
            },
          },
          {
            label: $t('检测本地网络'),
            component: ({ item }: any) => {
              return (
                <RxButton class="mb-1.5" size="sm" outlined severity="secondary" icon="base/rx_ic_speed_test" label={$t('检测')} onClick={() => detectLocalNetwork(item)}></RxButton>
              )
            },
            afterComponent: ({ item }: any) => {
              return (
                item.value && (
                  <Message icon="pi pi-check-circle" severity="success" closable={true} pt={{ content: '!items-start' }} onClose={() => { item.value = null }}>
                    <div class="text-3 color-[#171C1F]">
                      {$t('检测成功')}
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      {$t('位置')}
                      :
                      {item.value.country_code}
                      /
                      {item.value.country}
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      IP:
                      {item.value.ip}
                    </div>
                  </Message>
                )
              )
            },
          },

        ],
      },
      {
        items: [
          {
            label: $t('默认 IP 查询渠道'),
            text: $t('所有 IP 查询结果都会通过该渠道获取'),
            name: 'ipChecker',
            value: data?.ipChecker ?? '',
            props: {
              filter: false,
              optionValue: 'value',
              options: $dict_map.checkChannel,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
              )
            },
          },
          {
            label: $t('白名单'),
            text: $t('使用本地网络请求以下域名'),
            name: 'ipBlackList',
            classes: 'flex-col !items-start gap-4',
            value: Array.isArray(data?.ipBlackList) ? data.ipBlackList.join('\n') : (data.ipBlackList ?? ''),
            oldValue: Array.isArray(data?.ipBlackList) ? data.ipBlackList.join('\n') : (data.ipBlackList ?? ''),
            formatValue: (item: Items) => item.value.split('\n'),
            vaildator: (item: Items) => item.oldValue !== item.value,
            props: {
              class: 'resize-none w-full',
              placeholder: `${$t('请直接输入 *域名 用回车键分割')}\n${$t('示例')}:\n* google.com\n* facebook.com`,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <Textarea {...item.props} {...props} rows="8" onBlur={() => saveUserConfig(item)} />
              )
            },
          },
        ],
      },
    ],
  })
  return items
}

const deviceInfo: Recordable = ref({})
requestIdleCallback(() => {
  electronAPI.send('util:getDeviceInfo').then(async (info) => {
    Object.assign(deviceInfo.value, info)
    console.log('deviceInfo', deviceInfo.value)

    info.createTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

    if (!info.address) {
      const result = await electronAPI.send('proxy:detectNetwork')
      deviceInfo.value.address = result.ip
      deviceInfo.value.location = result.city
      deviceInfo.value.platform = isWindows ? 'win' : 'mac'
      deviceInfo.value.createTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    }
  })
})
export async function getLoginActive(data?: any): Promise<SettingsModule> {
  const { data: loginHistory } = await API.base.userGetLoginInfoList()

  const currentDevice = loginHistory.find((item) => item.deviceId === deviceInfo.value.deviceId) || loginHistory.find((item) => decodeURIComponent(item.deviceName || '') === decodeURIComponent(deviceInfo.value.deviceName))

  const historicalDevices = loginHistory.filter((item) => item !== currentDevice)

  return {
    title: $t('登录历史'),
    description: $t('近 90 天内的登录记录'),
    list: [
      {
        subtitle: $t('当前设备'),
        items: [
          {
            name: 'currentDevice',
            text: () => <LoginDevices devices={[currentDevice || deviceInfo.value]} />
          },
        ],
      },
      ...(historicalDevices.length ? [{
        subtitle: $t('历史设备'),
        items: [
          {
            name: 'historicalDevices',
            text: () => <LoginDevices devices={historicalDevices} />
          }
        ]
      }] : [])
    ],
  }
}
