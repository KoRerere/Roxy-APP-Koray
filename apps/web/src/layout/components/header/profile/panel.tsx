import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { settingAppearance } from '/@/enums'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import type { Items, SettingsModule } from './type'
import FolderDirectory from './folder-directory.vue'
import UploadAvatar from './upload-avatar.vue'

const { setUserInfo } = useUserStore()

const toast = ref()

async function updateAvatar(item: Items) {
  await API.base.userUploadAvatarCreate({ avatar: item.value })
  toast.value?.add({ severity: 'success', summary: $t('Success'), detail: $t('Modification successful'), life: 5000 })
  updateUserInfo()
}

async function updateUserName(item: Items) {
  await API.base.userChangeUsernameCreate({ userName: item.value })
  toast.value?.add({ severity: 'success', summary: $t('Success'), detail: $t('Modification successful'), life: 5000 })
  updateUserInfo()
}

async function updateUserInfo() {
  const { data } = await API.base.userGetUserInfoList()
  setUserInfo(data)
}

async function saveUserConfig(item: Items) {
  const value = item.formatValue?.(item) ?? item.value
  await API.base.userSetUserConfigCreate({ [item.name as any]: value })
  toast.value?.add({ severity: 'success', summary: $t('Success'), detail: $t('Modification successful'), life: 5000 })
  electronAPI.send('app:saveSoftConfig', { [item.name as any]: value })
}

async function detectLocalNetwork(item: Items) {
  const dirId = Math.random().toString(36).slice(2)
  const data = await electronAPI.send('proxy:detect', { dirId }).finally(() => {
    window.electronAPI.send('proxy:delLuminetProxy', dirId)
  })
  item.value = data
}

async function detectSystemNetwork(item: Items) {
  const systemProxy = await electronAPI.send('proxy:getSystemProxy')
  const [host, port] = systemProxy.split(':')
  const dirId = Math.random().toString(36).slice(2)
  const data = await electronAPI.send('proxy:detect', { dirId, proxyCategory: 'HTTP', host, port, outerParamFirst: true }).finally(() => {
    window.electronAPI.send('proxy:delLuminetProxy', dirId)
  })
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
      label: $t('Profiles'),
      icon: 'base/rx_ic_user_circle',
    },
    {
      label: $t('Preferences'),
      icon: 'base/rx_ic_slider',
    },
    {
      label: $t('Network'),
      icon: 'base/rx_ic_wifi',
    },
  ] as const
}

export function getProfilePanel(data?: any): SettingsModule {
  return {
    title: $t('Profile'),
    description: $t('Manage your account info and email.'),
    list: [
      {
        items: [
          {
            label: $t('Profile picture'),
            text: $t('Size should be 64px*64px and less than 2MB'),
            name: 'avatar',
            classes: 'flex-col !items-start gap-4',
            value: data?.avatar ?? '',
            props: {
              class: 'resize-none w-full',
              placeholder: $t('Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com'),
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
            label: $t('Email address'),
            name: 'email',
            value: data?.email ?? '',
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <InputText {...item.props} {...props} class="!w-0 flex-1" type="text" disabled />
              )
            },
          },
          {
            label: $t('Username'),
            text: $t('Usually used in teamworks and members.'),
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
  // const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')
  return {
    title: $t('Preferences'),
    description: $t('Manage client experience settings. Including languages and appearance.'),
    list: [
      // !todo: 后台暂时没做，一期暂时隐藏
      // {
      //   subtitle: $t('Interface'),
      //   items: [
      //     {
      //       label: $t('Language'),
      //       text: $t('Not your language include? <span class="text-blue">Contact us</span>'),
      //       name: 'language',
      //       value: $dict_map.language?.find((item: any) => item.value === data.language) ?? $dict_map.language[0],
      //       props: {
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
      //       label: $t('Timezone'),
      //       text: $t('Some hints for you'),
      //       name: 'timeZone',
      //       value: data?.timeZone ?? '',
      //       props: {
      //         options: $dict_map.timeZone,
      //       },
      //       component: ({ item, ...props }: { item: Items, props: any }) => {
      //         return (
      //           <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
      //         )
      //       },
      //     },
      //     {
      //       label: $t('Appearance'),
      //       text: $t('Themes for different mode'),
      //       name: 'appearance',
      //       value: data?.appearance?.toString() ?? '',
      //       props: {
      //         options: [
      //           { label: $t('System'), value: `${settingAppearance.system}` },
      //           { label: $t('Light'), value: `${settingAppearance.light}` },
      //           { label: $t('Dark'), value: `${settingAppearance.dark}` },
      //         ],
      //       },
      //       formatValue: (item: Items) => Number(item.value),
      //       component: ({ item, ...props }: { item: Items, props: any }) => {
      //         return (
      //           <Select {...item.props} {...props} option-label="label" option-value="value" onChange={() => saveUserConfig(item)} />
      //         )
      //       },
      //     },
      //   ],
      // },
      {
        subtitle: $t('Local Settings'),
        items: [
          {
            label: $t('Cash Folder Directory'),
            text: $t('Where to store your cash files in roxy'),
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
        subtitle: $t('Behavior'),
        items: [
          {
            label: $t('Close Button'),
            text: $t('Behavior while click the close button'),
            name: 'closeSoft',
            value: data?.closeSoft ?? '',
            props: {
              options: [
                { label: $t('Popup tips'), value: 'pop' },
                { label: $t('Hide client'), value: 'min' },
                { label: $t('Close client'), value: 'exit' },
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
    title: $t('Network'),
    description: $t('Manage anything related to network, including whitelist, IP checker'),
    list: [
      {
        subtitle: $t('Network detection'),
        items: [
          {
            label: $t('Use system proxy for connection'),
            text: $t('Use system proxy'),
            name: 'systemProxySwitch',
            value: data?.systemProxySwitch ?? false,
            component: ({ item, ...props }: { item: Items, props: any }) => {
              return (
                <RxToggleSwitch {...item.props} {...props} onChange={() => saveUserConfig(item)}></RxToggleSwitch>
              )
            },
          },
          {
            label: $t('Detect local network'),
            text: $t('Some hints'),
            component: ({ item }: any) => {
              return (
                <RxButton class="mb-1.5" size="sm" outlined severity="secondary" icon="base/rx_ic_speed_test" label={$t('Start Detect')} onClick={() => detectLocalNetwork(item)}></RxButton>
              )
            },
            afterComponent: ({ item }: any) => {
              return (
                item.value && (
                  <Message icon="pi pi-check-circle" severity="success" closable={true} pt={{ content: '!items-start' }} onClose={() => item.value = ''}>
                    <div class="text-3 color-[#171C1F]">
                      {$t('Detection passed')}
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      {$t('Location:')}
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
            label: $t('Detect system network'),
            text: $t('Some hints'),
            component: ({ item }: any) => {
              return (
                <RxButton class="mb-1.5" size="sm" outlined severity="secondary" icon="base/rx_ic_speed_test" label={$t('Start Detect')} onClick={() => detectSystemNetwork(item)}></RxButton>
              )
            },
            afterComponent: ({ item }: any) => {
              return (
                item.value && (
                  <Message icon="pi pi-check-circle" severity="success" closable={true} pt={{ content: '!items-start' }} onClose={() => item.value = ''}>
                    <div class="text-3 color-[#171C1F]">
                      {$t('Detection passed')}
                    </div>
                    <div class="text-3 line-height-normal color-[#575D61]">
                      {$t('Location:')}
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
            label: $t('Default IP checker'),
            text: $t('Checkers to test your proxies in projects'),
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
            label: $t('Whitelist'),
            text: $t('Visiting sites using local network without proxy'),
            name: 'ipBlackList',
            classes: 'flex-col !items-start gap-4',
            value: Array.isArray(data?.ipBlackList) ? data.ipBlackList.join('\n') : (data.ipBlackList ?? ''),
            formatValue: (item: Items) => {
              return item.value.split('\n')
            },
            props: {
              class: 'resize-none w-full',
              placeholder: $t('Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com'),
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
