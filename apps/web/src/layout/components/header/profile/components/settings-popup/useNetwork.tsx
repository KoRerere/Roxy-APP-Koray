import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import RxButton from '/@/components/rx-button'
import RxInputGroup from '/@/components/rx-input-group.vue'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import { RxAlert } from '/@/components/rx-alert'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'
import type {
  Items,
  SettingsModule,
} from '/@/layout/components/header/profile/type'
import { $t } from '/@/locales'
import { getDictMap, strConcat } from '/@/utils'
import { NetworkType, ProxyCheckStatus, ProxyProtocol } from '/@/enums'

const DEFAULT_PROXY_HOST = '127.0.0.1'
const APP_PROXY_PROTOCOL_OPTIONS = [
  { label: 'SOCKS5', value: ProxyProtocol.SOCKS5 },
  { label: 'HTTP', value: ProxyProtocol.HTTP },
]

function resolveProxyHost(host?: string | null) {
  return host?.trim() || DEFAULT_PROXY_HOST
}

function getNetworkModeValue(items: Items[]) {
  return items.find(i => i.name === 'networkMode')?.value ?? NetworkType.System
}

export function useNetworkPanel() {
  const { saveUserConfig, saveLocalConfig, detectLocalNetwork, detectSystemNetwork, detectCustomAppNetwork } = useCommonUtil()

  const getNetworkPanels = async (data?: any): Promise<SettingsModule> => {
    const [$dict_map, softConfig] = await Promise.all([
      getDictMap(),
      globalThis.electronAPI.send('app:getSoftConfig'),
    ])

    const items = reactive({
      title: $t('网络设置'),
      description: $t('设置您的客户端网络连接，包括白名单和默认 IP 查询渠道'),
      list: [
        {
          subtitle: $t('网络连接方式'),
          items: [
            {
              label: $t('网络模式'),
              name: 'networkMode',
              value: softConfig?.networkMode ?? NetworkType.System,
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  { label: $t('本地网络'), value: NetworkType.Local },
                  { label: $t('系统代理'), value: NetworkType.System },
                  { label: $t('自定义代理'), value: NetworkType.Custom },
                ],
                class: 'w-[180px]',
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <TsFormSelect
                    {...item.props}
                    {...props}
                    name={item.name}
                    onChange={() => saveLocalConfig(item)}
                  />
                )
              },
            },
            {
              label: $t('网络兼容模式'),
              text: $t('系统代理识别失败时，可尝试启用'),
              name: 'v2raySwitch',
              hide: (_: Items, sectionItems: Items[]) => getNetworkModeValue(sectionItems) !== NetworkType.System,
              value: data?.v2raySwitch ?? false,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <RxToggleSwitch
                    {...item.props}
                    {...props}
                    onChange={() => saveUserConfig(item)}
                  />
                )
              },
            },
            {
              label: $t('代理协议'),
              name: 'proxyProtocol',
              value: softConfig?.proxyProtocol ?? ProxyProtocol.SOCKS5,
              props: {
                filter: false,
                optionValue: 'value',
                options: APP_PROXY_PROTOCOL_OPTIONS,
                class: 'w-[180px]',
              },
              hide: (_: Items, sectionItems: Items[]) => getNetworkModeValue(sectionItems) !== NetworkType.Custom,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <TsFormSelect
                    {...item.props}
                    {...props}
                    name={item.name}
                    onChange={() => saveLocalConfig(item)}
                  />
                )
              },
            },
            {
              label: $t('代理信息'),
              name: 'proxyHostPort',
              value: [resolveProxyHost(softConfig?.proxyHost), (softConfig?.proxyPort ?? 0) > 0 ? softConfig?.proxyPort : null],
              oldValue: [resolveProxyHost(softConfig?.proxyHost), (softConfig?.proxyPort ?? 0) > 0 ? softConfig?.proxyPort : null],
              props: {
                items: [
                  { placeholder: $t('主机') },
                  { separator: true },
                  { placeholder: $t('端口'), min: 1, max: 65535 },
                ],
                class: 'w-[270px]',
              },
              hide: (_: Items, sectionItems: Items[]) => getNetworkModeValue(sectionItems) !== NetworkType.Custom,
              formatValue: (item: Items) => {
                const [proxyHost, proxyPort] = item.value
                return { proxyHost: resolveProxyHost(proxyHost), proxyPort }
              },
              vaildator: (item: Items) => {
                const [oldHost, oldPort] = item.oldValue ?? []
                const [newHost, newPort] = item.value ?? []
                return oldHost !== newHost || oldPort !== newPort
              },
              component: ({ item }: any) => {
                return (
                  <RxInputGroup
                    {...item.props}
                    modelValue={item.value}
                    onUpdate:modelValue={(val: (string | number | null)[]) => { item.value = val }}
                    onBlur={() => saveLocalConfig(item)}
                  />
                )
              },
            },
            {
              label: () => (
                <span>
                  {$t('代理账号')}
                  <span class="text-[color:var(--colors-text-text-tertiary)]">{` (${$t('选填')})`}</span>
                </span>
              ),
              name: 'proxyUsername',
              value: softConfig?.proxyUsername ?? '',
              oldValue: softConfig?.proxyUsername ?? '',
              props: {
                placeholder: $t('请输入代理账号'),
                class: 'w-[180px]',
              },
              hide: (_: Items, sectionItems: Items[]) => getNetworkModeValue(sectionItems) !== NetworkType.Custom,
              vaildator: (item: Items) => item.oldValue !== item.value,
              component: ({ item }: any) => {
                return (
                  <InputText
                    {...item.props}
                    modelValue={item.value}
                    onUpdate:modelValue={(val: string) => { item.value = val }}
                    type="text"
                    onBlur={() => saveLocalConfig(item)}
                  />
                )
              },
            },
            {
              label: () => (
                <span>
                  {$t('代理密码')}
                  <span class="text-[color:var(--colors-text-text-tertiary)]">{` (${$t('选填')})`}</span>
                </span>
              ),
              name: 'proxyPassword',
              value: softConfig?.proxyPassword ?? '',
              oldValue: softConfig?.proxyPassword ?? '',
              props: {
                placeholder: $t('请输入代理密码'),
                class: 'w-[180px]',
              },
              hide: (_: Items, sectionItems: Items[]) => getNetworkModeValue(sectionItems) !== NetworkType.Custom,
              vaildator: (item: Items) => item.oldValue !== item.value,
              component: ({ item }: any) => {
                return (
                  <InputText
                    {...item.props}
                    modelValue={item.value}
                    onUpdate:modelValue={(val: string) => { item.value = val }}
                    type="password"
                    onBlur={() => saveLocalConfig(item)}
                  />
                )
              },
            },
            {
              label: $t('检测自定义代理'),
              hide: (_: Items, sectionItems: Items[]) => getNetworkModeValue(sectionItems) !== NetworkType.Custom,
              component: ({ item }: any) => (
                <RxButton
                  class="mb-1.5"
                  size="sm"
                  outlined
                  severity="secondary"
                  icon="base/rx_ic_speed_test"
                  label={$t('检测')}
                  onClick={() => detectCustomAppNetwork(item, items)}
                />
              ),
              afterComponent: ({ item }: any) =>
                item.value?.checkStatus === ProxyCheckStatus.success && (
                  <RxAlert
                    class="w-full whitespace-pre-wrap"
                    type="success"
                    visible={true}
                    closable={true}
                    title={$t('检测成功')}
                    content={$t('位置: {location}\nIP: {ip}\n时区: {timezone}', {
                      location: `${item.value.lastCountry}${strConcat('/', item.value.lastCity)}`,
                      ip: item.value.lastIp,
                      timezone: item.value.timezone,
                    })}
                    onUpdate:visible={(visible: boolean) => {
                      if (!visible)
                        item.value = null
                    }}
                  />
                ),
            },
            {
              label: $t('检测本地网络'),
              component: ({ item }: any) => (
                <RxButton
                  class="mb-1.5"
                  size="sm"
                  outlined
                  severity="secondary"
                  icon="base/rx_ic_speed_test"
                  label={$t('检测')}
                  onClick={() => detectLocalNetwork(item)}
                />
              ),
              afterComponent: ({ item }: any) =>
                item.value && (
                  <RxAlert
                    class="w-full whitespace-pre-wrap"
                    type="success"
                    visible={true}
                    closable={true}
                    title={$t('检测成功')}
                    content={$t('位置: {code}/{country}\nIP: {ip}', { code: item.value.country_code, country: item.value.country, ip: item.value.ip })}
                    onUpdate:visible={(visible: boolean) => {
                      if (!visible)
                        item.value = null
                    }}
                  />
                ),
            },
            {
              label: $t('检查系统代理'),
              component: ({ item }: any) => (
                <RxButton
                  class="mb-1.5"
                  size="sm"
                  outlined
                  severity="secondary"
                  icon="base/rx_ic_speed_test"
                  label={$t('检测')}
                  onClick={() => detectSystemNetwork(item)}
                />
              ),
              afterComponent: ({ item }: any) =>
                item.value && (
                  <RxAlert
                    class="w-full whitespace-pre-wrap"
                    type="success"
                    visible={true}
                    closable={true}
                    title={$t('检测成功')}
                    content={$t('位置: {code}/{country}\nIP: {ip}', { code: item.value.country_code, country: item.value.country, ip: item.value.ip })}
                    onUpdate:visible={(visible: boolean) => {
                      if (!visible)
                        item.value = null
                    }}
                  />
                ),
            },
            {
              label: $t('自动检测代理 IP'),
              name: 'autoDetectProxy',
              value: data?.autoDetectProxy ?? false,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <RxToggleSwitch
                    {...item.props}
                    {...props}
                    onChange={() => saveUserConfig(item)}
                  />
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
                  <TsFormSelect
                    {...item.props}
                    {...props}
                    name={item.name}
                    onChange={() => saveUserConfig(item)}
                  />
                )
              },
            },
            {
              label: $t('白名单'),
              text: $t('使用本地网络请求以下域名'),
              name: 'ipBlackList',
              classes: 'flex-col !items-start gap-4',
              value: Array.isArray(data?.ipBlackList)
                ? data.ipBlackList.join('\n')
                : (data.ipBlackList ?? ''),
              oldValue: Array.isArray(data?.ipBlackList)
                ? data.ipBlackList.join('\n')
                : (data.ipBlackList ?? ''),
              formatValue: (item: Items) => item.value.split('\n'),
              vaildator: (item: Items) => item.oldValue !== item.value,
              props: {
                class: 'resize-none w-full',
                placeholder: `${$t('请直接输入 *域名 用回车键分割')}\n${$t('示例')}:\n*google.com\n*facebook.com`,
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <Textarea
                    {...item.props}
                    {...props}
                    rows="8"
                    onBlur={() => saveUserConfig(item)}
                  />
                )
              },
            },
          ],
        },
      ],
    })

    return items
  }

  return {
    getNetworkPanels,
  }
}
