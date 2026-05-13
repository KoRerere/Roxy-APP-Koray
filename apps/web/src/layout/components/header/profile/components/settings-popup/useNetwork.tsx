import Textarea from 'primevue/textarea'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import { RxAlert } from '/@/components/rx-alert'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'
import type {
  Items,
  SettingsModule,
} from '/@/layout/components/header/profile/type'
import { $t } from '/@/locales'
import { getDictMap } from '/@/utils'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { withDirectives } from 'vue'
import { TooltipHook } from '/@/layout/components/header/profile/components/settings-popup/useAuthentication'

export function useNetworkPanel() {
  const { saveUserConfig, detectLocalNetwork, detectSystemNetwork } = useCommonUtil()

  const getNetworkPanels = async (data?: any): Promise<SettingsModule> => {
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
                  <div class="w-[370px] text-[color:--colors-text-text-error] line-height-normal">
                    {$t('改变此开关状态后，请重启窗口以确保生效')}
                  </div>
                </div>
              ),
              name: 'systemProxySwitch',
              value: data?.systemProxySwitch ?? false,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <RxToggleSwitch
                    {...item.props}
                    {...props}
                    onChange={() => saveUserConfig(item, items)}
                  />
                )
              },
            },
            {
              label: $t('网络兼容模式'),
              text: () => (
                <div class="flex items-center gap-1">
                  <span>{$t('系统代理识别失败时，可尝试启用')}</span>
                  { withDirectives(<SvgIcon name="base/rx_ic_question" class="w-4 h-4" />, [
                    [TooltipHook, { value: $t('帮助客户端使用系统代理网络，但开启后可能影响 HTTP 代理检测') }, '', { top: true }],
                  ])}
                </div>
              ),
              name: 'v2raySwitch',
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'systemProxySwitch')?.value,
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
                    onClose={() => { item.value = null }}
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
                    onClose={() => { item.value = null }}
                  />
                ),
            },
            {
              label: $t('自动检测代理 IP'),
              name: 'autoDetectProxy',
              value: data?.autoDetectProxy ?? true,
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
