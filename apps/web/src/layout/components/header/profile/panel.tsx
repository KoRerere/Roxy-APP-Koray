import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { API } from '/@/api'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import RyButton from '/@/components/ry-button'
import { settingAppearance } from '/@/enums'
import { useUserStore } from '/@/stores/user'
import type { Items, SettingsModule } from './type'
import UploadAvatar from './upload-avatar.vue'

const { setUserInfo } = useUserStore()

async function updateAvatar(item: Items) {
  await API.base.userUploadAvatarCreate({ avatar: item.value })
  const { data } = await API.base.userGetUserInfoList()
  setUserInfo(data)
}

async function updateUserName(item: Items) {
  API.base.userChangeAccountCreate({ realName: item.value })
}

async function saveUserConfig(item: Items) {
  const { name, value } = item
  API.base.userSetUserConfigCreate({ [name as any]: value })
}

// function DetectLocalNetwork() { }
// function DetectSystemNetwork() { }

async function selectDir() {
  const _dir = await window.electronAPI.send('dialog:selectDir')
}

export function getProfilePanel(data?: any): SettingsModule {
  return {
    title: 'Profile',
    description: 'Manage your account info and email.',
    list: [
      {
        items: [
          {
            label: 'Whitelist',
            text: 'Visiting sites using local network without proxy',
            name: 'avatar',
            classes: 'flex-col !items-start gap-4',
            value: data?.avatar ?? '',
            props: {
              class: 'resize-none w-full',
              placeholder: 'Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com',
            },
            component: ({ item, ...props }: any) => {
              return (
                <UploadAvatar {...item.props} {...props} onChange={() => updateAvatar(item)} />
              )
            },
          },
          {
            label: 'Email address',
            name: 'email',
            value: data?.email ?? '',
            component: ({ item, ...props }: any) => {
              return (
                <InputText {...item.props} {...props} class="!w-0 flex-1" type="text" disabled />
              )
            },
          },
          {
            label: 'Username',
            text: 'Usually used in teamworks and members.',
            name: 'realName',
            value: data?.realName ?? '',
            component: ({ item, ...props }: any) => {
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

export function getPreferencesPanel(data?: any): SettingsModule {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')
  return {
    title: 'Preferences',
    description: 'Manage client experience settings. Including languages and appearance.',
    list: [
      {
        subtitle: 'Interface',
        items: [
          {
            label: 'Language',
            text: 'Not your language include? <span class="text-blue">Contact us</span>',
            name: 'language',
            value: data?.language ?? '',
            props: {
              options: $dict_map.language,
            },
            component: ({ item, ...props }: any) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" />
              )
            },
          },
          {
            label: 'Timezone',
            text: 'Some hints for you',
            name: 'timeZone',
            value: data?.timeZone ?? '',
            props: {
              options: $dict_map.timeZone,
            },
            component: ({ item, ...props }: any) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" />
              )
            },
          },
          {
            label: 'Appearance',
            text: 'Themes for different mode',
            name: 'appearance',
            value: data?.appearance ?? '',
            props: {
              options: [
                { label: 'System', value: `${settingAppearance.system}` },
                { label: 'Dark', value: `${settingAppearance.dark}` },
                { label: 'Light', value: `${settingAppearance.light}` },
              ],
            },
            component: ({ item, ...props }: any) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" />
              )
            },
          },
        ],
      },
      {
        subtitle: 'Local Settings',
        items: [
          {
            label: 'Cash Folder Directory',
            text: 'Where to store your cash files in roxy',
            name: 'cacheDir',
            value: data?.cacheDir ?? '',
            props: {
              disabled: true,
            },
            component: ({ item, ...props }: any) => {
              return (
                <div class="flex gap-2">
                  <InputText {...item.props} {...props} class="!w-0 flex-1" type="text" />
                  <RyButton outlined severity="secondary" icon="base/rx_ic_folder" onClick={selectDir} />
                </div>
              )
            },
          },
        ],
      },
      {
        subtitle: 'Behavior',
        items: [
          {
            label: 'Close Button',
            text: 'Behavior while click the close button',
            name: 'closeSoft',
            value: data?.closeSoft ?? '',
            props: {
              options: [
                { label: 'Popup tips', value: 'pop' },
                { label: 'Hide client', value: 'min' },
                { label: 'Close client', value: 'exit' },
              ],
            },
            component: ({ item, ...props }: any) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" />
              )
            },
          },
        ],
      },
    ],
  }
}

export function getNetworkPanel(data?: any): SettingsModule {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')
  return {
    title: 'Network',
    description: 'Manage anything related to network, including whitelist, IP checker',
    list: [
      {
        subtitle: 'Network detection',
        items: [
          {
            label: 'Use system proxy for connection',
            text: 'Use system proxy',
            name: 'systemProxySwitch',
            value: data?.systemProxySwitch ?? false,
            component: ({ item, ...props }: any) => {
              return (
                <RxToggleSwitch {...item.props} {...props} onChange={() => saveUserConfig(item)}></RxToggleSwitch>
              )
            },
          },
          {
            label: 'Detect local network',
            text: 'Some hints',
            component: () => {
              return (
                <RyButton size="small" outlined severity="secondary" icon="base/rx_ic_speed_test" label="Start Detect"></RyButton>
              )
            },
          },
          {
            label: 'Detect system network',
            text: 'Some hints',
            component: () => {
              return (
                <RyButton size="small" outlined severity="secondary" icon="base/rx_ic_speed_test" label="Start Detect"></RyButton>
              )
            },
          },
        ],
      },
      {
        items: [
          {
            label: 'Default IP checker',
            text: 'Checkers to test your proxies in projects',
            name: 'ipChecker',
            value: data?.ipChecker ?? '',
            props: {
              options: $dict_map.ipCheckAddress,
            },
            component: ({ item, ...props }: any) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
              )
            },
          },
          {
            label: 'Whitelist',
            text: 'Visiting sites using local network without proxy',
            name: 'ipBlackList',
            classes: 'flex-col !items-start gap-4',
            value: (data?.ipBlackList || []).join('\n'),
            props: {
              class: 'resize-none w-full',
              placeholder: 'Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com',
            },
            component: ({ item, ...props }: any) => {
              return (
                <Textarea {...item.props} {...props} rows="8" onBlur={() => saveUserConfig(item)} />
              )
            },
          },
        ],
      },
    ],
  }
}
