import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import RyButton from '/@/components/ry-button'
import { settingAppearance } from '/@/enums'
import { useUserStore } from '/@/stores/user'
import type { Items, SettingsModule } from './type'
import FolderDirectory from './folder-directory.vue'
import UploadAvatar from './upload-avatar.vue'

const { setUserInfo } = useUserStore()

const toast = ref()

async function updateAvatar(item: Items) {
  await API.base.userUploadAvatarCreate({ avatar: item.value })
  toast.value?.add({ severity: 'success', summary: 'Success', detail: '修改成功', life: 5000 })
  updateUserInfo()
}

async function updateUserName(item: Items) {
  await API.base.userChangeUsernameCreate({ userName: item.value })
  toast.value?.add({ severity: 'success', summary: 'Success', detail: '修改成功', life: 5000 })
  updateUserInfo()
}

async function updateUserInfo() {
  const { data } = await API.base.userGetUserInfoList()
  setUserInfo(data)
}

async function saveUserConfig(item: Items) {
  const value = item.formatValue?.(item) ?? item.value
  await API.base.userSetUserConfigCreate({ [item.name as any]: value })
  toast.value?.add({ severity: 'success', summary: 'Success', detail: '修改成功', life: 5000 })
  electronAPI.send('app:saveSoftConfig', { [item.name]: value })
}

async function detectLocalNetwork(item: Items) {
  const data = await electronAPI.send('proxy:detect', {})
  item.value = data
}

async function detectSystemNetwork(item: Items) {
  const systemProxy = await electronAPI.send('proxy:getSystemProxy')
  const [host, port] = systemProxy.split(':')
  const data = await electronAPI.send('proxy:detect', { protocol: 'HTTP', host, port })
  item.value = data
}

// async function selectDir(item: Items) {
//   const dirPath = await window.electronAPI.send('dialog:selectDir')
//   item.value = dirPath
// }

export function getSettings() {
  toast.value = useToast()
  return [
    {
      label: 'Profiles',
      icon: 'base/rx_ic_user_circle',
    },
    {
      label: 'Preferences',
      icon: 'base/rx_ic_slider',
    },
    {
      label: 'Network',
      icon: 'base/rx_ic_wifi',
    },
  ] as const
}

export function getProfilePanel(data?: any): SettingsModule {
  return {
    title: 'Profile',
    description: 'Manage your account info and email.',
    list: [
      {
        items: [
          {
            label: 'Profile picture',
            text: 'Size should be 64px*64px and less than 2MB',
            name: 'avatar',
            classes: 'flex-col !items-start gap-4',
            value: data?.avatar ?? '',
            props: {
              class: 'resize-none w-full',
              placeholder: 'Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com',
              userName: data.userName,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <UploadAvatar {...item.props} {...props} onChange={() => updateAvatar(item)} />
              )
            },
          },
          {
            label: 'Email address',
            name: 'email',
            value: data?.email ?? '',
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <InputText {...item.props} {...props} class="!w-0 flex-1" type="text" disabled />
              )
            },
          },
          {
            label: 'Username',
            text: 'Usually used in teamworks and members.',
            name: 'userName',
            value: data?.userName ?? '',
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
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
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
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
              )
            },
          },
          {
            label: 'Appearance',
            text: 'Themes for different mode',
            name: 'appearance',
            value: data?.appearance?.toString() ?? '',
            props: {
              options: [
                { label: 'System', value: `${settingAppearance.system}` },
                { label: 'Light', value: `${settingAppearance.light}` },
                { label: 'Dark', value: `${settingAppearance.dark}` },
              ],
            },
            formatValue: (item: Items) => Number(item.value),
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
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
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <FolderDirectory item={item} {...item.props} {...props} onChange={() => saveUserConfig(item)}></FolderDirectory>
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
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
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
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxToggleSwitch {...item.props} {...props} onChange={() => saveUserConfig(item)}></RxToggleSwitch>
              )
            },
          },
          {
            label: 'Detect local network',
            text: 'Some hints',
            component: ({ item }: any) => {
              return (
                <RyButton class="mb-1.5" size="small" outlined severity="secondary" icon="base/rx_ic_speed_test" label="Start Detect" onClick={() => detectLocalNetwork(item)}></RyButton>
              )
            },
            afterComponent: ({ item }: any) => {
              return (
                item.value && (
                  <Message icon="pi pi-check-circle" severity="success" closable={true} pt={{ content: '!items-start' }} onClose={() => item.value = ''}>
                    <div class="text-3 color-[#171C1F]">
                      Detection passed
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      Location:
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
            label: 'Detect system network',
            text: 'Some hints',
            component: ({ item }: any) => {
              return (
                <RyButton class="mb-1.5" size="small" outlined severity="secondary" icon="base/rx_ic_speed_test" label="Start Detect" onClick={() => detectSystemNetwork(item)}></RyButton>
              )
            },
            afterComponent: ({ item }: any) => {
              return (
                item.value && (
                  <Message icon="pi pi-check-circle" severity="success" closable={true} pt={{ content: '!items-start' }} onClose={() => item.value = ''}>
                    <div class="text-3 color-[#171C1F]">
                      Detection passed
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      Location:
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
            label: 'Default IP checker',
            text: 'Checkers to test your proxies in projects',
            name: 'ipChecker',
            value: data?.ipChecker ?? '',
            props: {
              options: $dict_map.checkChannel,
            },
            component: ({ item, ...props }: { item: Items, props: any }) => {
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
            value: Array.isArray(data?.ipBlackList) ? data.ipBlackList.join('\n') : (data.ipBlackList ?? ''),
            formatValue: (item: Items) => {
              return item.value.split('\n')
            },
            props: {
              class: 'resize-none w-full',
              placeholder: 'Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com',
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
  }
}
