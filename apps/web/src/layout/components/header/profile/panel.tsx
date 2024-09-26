import type { SettingsModule } from './type'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

import Textarea from 'primevue/textarea'
import UploadAvatar from './upload-avatar.vue'
import RxToggleSwitch from '/@/components/rx-toggle-switch'

import RyButton from '/@/components/ry-button'

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
            value: data?.avatar,
            classes: 'flex-col !items-start gap-4',
            props: {
              class: 'resize-none w-full',
              placeholder: 'Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com',
            },
            component: (props: any) => {
              return (
                <UploadAvatar {...props} />
              )
            },
          },
          {
            label: 'Email address',
            name: 'email',
            value: data?.email,
            component: (props: any) => {
              return (
                <InputText {...props} class="!w-0 flex-1" type="text" disabled />
              )
            },
          },
          {
            label: 'Username',
            text: 'Usually used in teamworks and members.',
            name: 'username',
            value: data?.username,
            component: (props: any) => {
              return (
                <InputText {...props} class="!w-0 flex-1" type="text" />
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
            value: data?.language,
            props: {
              options: [
                { label: 'Option 1', value: '1' },
                { label: 'Option 2', value: '2' },
                { label: 'Option 3', value: '3' },
              ],
            },
            component: (props: any) => {
              return (
                <Select {...props} option-label="label" option-value="value" />
              )
            },
          },
          {
            label: 'Timezone',
            text: 'Some hints for you',
            name: 'language',
            value: data?.timeZone,
            props: {
              options: $dict_map.timeZone,
            },
            component: (props: any) => {
              return (
                <Select {...props} option-label="label" option-value="value" />
              )
            },
          },
          {
            label: 'Appearance',
            text: 'Themes for different mode',
            name: 'appearance',
            value: data?.appearance,
            props: {
              options: [
                { label: 'Option 1', value: '1' },
                { label: 'Option 2', value: '2' },
                { label: 'Option 3', value: '3' },
              ],
            },
            component: (props: any) => {
              return (
                <Select {...props} option-label="label" option-value="value" />
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
            value: data?.cacheDir,
            props: {
              disabled: true,
            },
            component: (props: any) => {
              return (
                <div class="flex gap-2">
                  <InputText {...props} class="!w-0 flex-1" type="text" />
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
            value: data?.closeSoft,
            props: {
              options: [
                { label: 'Popup tips', value: 'pop' },
                { label: 'Hide client', value: 'min' },
                { label: 'Close client', value: 'exit' },
              ],
            },
            component: (props: any) => {
              return (
                <Select {...props} option-label="label" option-value="value" />
              )
            },
          },
        ],
      },
    ],
  }
}

export function getNetworkPanel(data?: any): SettingsModule {
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
            name: 'language',
            value: true,
            component: (props: any) => {
              return (
                <RxToggleSwitch {...props}></RxToggleSwitch>
              )
            },
          },
          {
            label: 'Detect local network',
            text: 'Some hints',
            name: 'timeZone',
            value: data?.timeZone,
            component: () => {
              return (
                <RyButton size="small" outlined severity="secondary" icon="base/rx_ic_speed_test" label="Start Detect"></RyButton>
              )
            },
          },
          {
            label: 'Detect system network',
            text: 'Some hints',
            value: null,
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
            name: 'language',
            value: '1',
            props: {
              options: [
                { label: 'Option 1', value: '1' },
                { label: 'Option 2', value: '2' },
                { label: 'Option 3', value: '3' },
              ],
            },
            component: (props: any) => {
              return (
                <Select {...props} option-label="label" option-value="value" />
              )
            },
          },
          {
            label: 'Whitelist',
            text: 'Visiting sites using local network without proxy',
            name: 'timeZone',
            value: null,
            classes: 'flex-col !items-start gap-4',
            props: {
              class: 'resize-none w-full',
              placeholder: 'Please enter * followed by the domain name, without the protocol at the beginning, such as:\n* google.com\n* facebook.com',
            },
            component: (props: any) => {
              return (
                <Textarea {...props} rows="8" />
              )
            },
          },
        ],
      },
    ],
  }
}

async function selectDir() {
  const _dir = await window.electronAPI.send('dialog:selectDir')
}
