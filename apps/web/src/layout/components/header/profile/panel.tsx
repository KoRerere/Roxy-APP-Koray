import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { settingAppearance } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { getDictMap } from '/@/utils'
import type { Items, SettingsModule } from './type'
import FolderDirectory from './folder-directory.vue'
import UploadAvatar from './upload-avatar.vue'

const { getUserInfo, updateUserConfig } = useUserStore()

const toast = ref()

async function updateAvatar(item: Items) {
  const { code, msg } = await API.base.userUploadAvatarCreate({ avatar: item.value })
  toast.value?.(code, msg)
  if (code === 0) {
    getUserInfo()
  }
}

async function updateUserName(item: Items) {
  if (item.oldValue === item.value)
    return

  const { code, msg } = await API.base.userChangeUsernameCreate({ userName: item.value })
  toast.value?.(code, msg)
  if (code === 0) {
    getUserInfo()
    item.oldValue = item.value
  }
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
  toast.value = showToast
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
  ] as const
}

export async function getProfilePanel(data?: any): Promise<SettingsModule> {
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
      //           { label: $t('系统'), value: `${settingAppearance.system}` },
      //           { label: $t('#Light'), value: `${settingAppearance.light}` },
      //           { label: $t('#Dark'), value: `${settingAppearance.dark}` },
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
