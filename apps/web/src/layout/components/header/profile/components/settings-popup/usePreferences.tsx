import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import FolderDirectory from '../folder-directory.vue'
import DiskOverview from '../disk-overview.vue'
import UploadBookmarks from '../upload-bookmarks.vue'
import SimulationShortcut from '../simulation-shortcut.vue'
import ClearCache from '/@/layout/components/header/profile/components/settings-popup/components/clear-cache.vue'
import RxTooltip from '/@/components/rx-tooltip'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ClearType, UaStrictMode } from '/@/enums'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { DEFAULT_SIMULATION_DELAY, DEFAULT_SIMULATION_ENABLE, DEFAULT_SIMULATION_SHORTCUT_KEYS } from '/@/constants/simulation-default'
import { isWindows } from '/@/utils/common'
import { MaximumLimitExceeded } from './index'
import { getColorSchemeList } from '/@/stores/theme'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'

export function usePreferencesPanel() {
  const { saveUserConfig } = useCommonUtil()

  const getPreferencesPanels = async (data?: any) => {
    const [softConfig, disk, searchEngineResult] = await Promise.all([
      globalThis.electronAPI.send('app:getSoftConfig'),
      globalThis.electronAPI.send('app:getRoxyCacheDiskInfo'),
      API.platform.userGetSearchEnginesList(),
    ])

    let searchEngineOptions: { label: string, value: string, image: string }[] = []
    if (searchEngineResult.code === 0 && searchEngineResult.data) {
      searchEngineOptions = searchEngineResult.data.map((item: any) => ({
        label: item.code,
        value: item.code,
        image: item.icon,
      }))
    }

    const simulation: Record<string, any> = data?.simulation
      ? data.simulation
      : {
          delay: DEFAULT_SIMULATION_DELAY,
          enable: DEFAULT_SIMULATION_ENABLE,
          shortcutKey: DEFAULT_SIMULATION_SHORTCUT_KEYS,
        }

    const items = reactive<SettingsModule>({
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
        //           <TsFormSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
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
        //           <TsFormSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
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
        //           <TsFormSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
        //         )
        //       },
        //     },
        //   ],
        // },
        {
          subtitle: $t('窗口'),
          items: [
            {
              label: $t('主题模式'),
              name: 'browserColorScheme',
              text: $t('支持 Roxychrome 125 及更高版本'),
              value: getColorSchemeList().find(item => item.value === (data?.browserColorScheme || 'system')),
              props: {
                filter: false,
                options: getColorSchemeList(),
              },
              formatValue: (item: Items) => {
                return item.value.value
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
              label: $t('UA 严格模式'),
              text: () => (
                <div class="w-88">
                  {$t(
                    '关闭此选项后，可以自定义浏览器的版本。一般情况下我们推荐保持该选项开启。',
                  )}
                </div>
              ),
              name: 'uaModeSwitch',
              value: data?.uaModeSwitch ?? UaStrictMode.open,
              props: {
                trueValue: UaStrictMode.open,
                falseValue: UaStrictMode.close,
              },
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
              label: $t('工作台'),
              text: () => (
                <div class="w-88">
                  {$t(
                    '打开窗口时，是否打开工作台页面',
                  )}
                </div>
              ),
              name: 'openWorkbench',
              value: data?.openWorkbench ?? 1,
              props: {
                trueValue: 1,
                falseValue: 0,
              },
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
              label: $t('Google 登录'),
              text: () => (
                <div class="w-88">
                  {$t(
                    '窗口是否开启谷歌账号登录',
                  )}
                </div>
              ),
              name: 'googleLoginEnable',
              value: data?.googleLoginEnable ?? false,
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
              label: $t('IP 变化提示'),
              text: () => (
                <div class="w-88">
                  {$t(
                    'IP 变化时是否弹窗提示',
                  )}
                </div>
              ),
              name: 'ipChangeModal',
              value: data?.ipChangeModal ?? false,
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
              label: $t('搜索引擎'),
              name: 'searchEngine',
              text: $t('打开窗口时，浏览器使用的默认搜索引擎'),
              value: searchEngineOptions.find(item => item.value === data?.searchEngine) ?? searchEngineOptions[0],
              props: {
                filter: false,
                // optionValue: "value",
                // optionLabel: "label",
                options: searchEngineOptions,
              },
              formatValue: (item: Items) => {
                return item.value.value
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
          ],
        },
        {
          subtitle: $t('仿真输入'),
          items: [
            {
              label: $t('是否启用'),
              name: 'simulation',
              value: !!simulation.enable,
              props: {
                trueValue: true,
                falseValue: false,
              },
              formatValue: (item: Items) => {
                simulation.enable = item.value
                return simulation
              },
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
              // 默认值调整为100
              label: $t('延迟时间'),
              name: 'simulation',
              value: simulation.delay,
              text: $t('粘贴时每个字符键入的延迟时间'),
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'simulation')?.value,
              formatValue: (item: Items) => {
                simulation.delay = item.value
                return simulation
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                const oldValue = item.value
                return (
                  <IconField class="w-full">
                    <InputNumber
                      {...item.props}
                      {...props}
                      onValueChange={() => {
                        if (oldValue !== item.value) {
                          saveUserConfig(item)
                        }
                      }}
                      pt={{ root: { class: 'w-full' } }}
                    />
                    <InputIcon class="tip-text">ms</InputIcon>
                  </IconField>
                )
              },
            },
            {
              label: $t('快捷键'),
              name: 'simulation',
              text: $t('必须是 {firstKey} + 字母 或 {firstKey} + Shift + 字母', { firstKey: isWindows ? 'Ctrl' : 'Command' }),
              value: simulation.shortcutKey,
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'simulation')?.value,
              formatValue: (item: Items) => {
                simulation.shortcutKey = item.value
                return simulation
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <SimulationShortcut
                    {...item.props}
                    {...props}
                    onChange={() => {
                      if (simulation.shortcutKey !== item.value) {
                        saveUserConfig(item)
                      }
                    }}
                  />
                )
              },
            },
          ],
        },
        {
          subtitle: $t('磁盘使用和设置'),
          subId: 'diskSettings',
          items: [
            {
              renderComponent: () => <DiskOverview disk={disk} data={data} softConfig={softConfig} />,
            },
            {
              label: $t('缓存目录'),
              text: $t('修改缓存路径'),
              name: 'browserCacheRootDir',
              value: softConfig.browserCacheRootDir ?? '',
              props: {
                disabled: true,
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <FolderDirectory
                    item={item}
                    {...item.props}
                    {...props}
                    onChange={() => saveUserConfig(item)}
                  />
                )
              },
            },
            {
              label: $t('磁盘限制'),
              name: 'diskLimit',
              value: data?.diskLimit ?? 8,
              text: () => (
                <div class="w-88">{$t('磁盘空间低于设置的阈值时，将停止打开浏览器窗口')}</div>
              ),
              component: ({ item, ...props }: { item: Items, props: any }) => {
                const oldValue = item.value
                return (
                  <div class="flex">
                    <IconField class="w-25">
                      <InputNumber
                        {...item.props}
                        {...props}
                        name={item.name}
                        useGrouping={false}
                        fluid
                        min={0}
                        max={100000}
                        onValueChange={() => {
                          if (oldValue !== item.value) {
                            saveUserConfig(item)
                          }
                        }}
                      />
                      <InputIcon class="pt-0.5">GB</InputIcon>
                    </IconField>
                  </div>
                )
              },
            },
            {
              label: $t('手动清除缓存'),
              name: 'manuallyClear',
              component: () => <ClearCache />,
            },
            {
              label: $t('自动清除缓存'),
              name: 'autoClearCache',
              value: data?.autoClearCache ?? false,
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
              label: $t('自动清除缓存选项'),
              name: 'clearCacheType',
              value: data?.clearCacheType ?? ClearType.partial,
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  {
                    label: $t('清除本地缓存（保留插件）'),
                    value: ClearType.partial,
                    tooltip: $t('清除扩展数据以外的所有本地缓存文件，登录状态不会失效！窗口指纹信息、IP 不会被清理。'),
                  },
                  {
                    label: $t('清除本地缓存'),
                    value: ClearType.all,
                    tooltip: $t('清除所有本地缓存文件，登录状态不会失效！窗口指纹信息、IP 不会被清理。'),
                  },
                ],
              },
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'autoClearCache')?.value,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <TsFormSelect
                    {...item.props}
                    {...props}
                    name={item.name}
                    onChange={() => saveUserConfig(item)}
                  >
                    {{
                      'option-extra': ({ option }: any) => {
                        return (
                          <RxTooltip class="flex items-center">
                            {{
                              default: () => <RxSvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)"></RxSvgIcon>,
                              content: () => <div class="w-76 whitespace-pre-wrap text-3" style="color: var(--component-tooltip-text-primary)">{option.tooltip}</div>,
                            }}
                          </RxTooltip>
                        )
                      },
                    }}
                  </TsFormSelect>
                )
              },
            },
            {
              label: $t('自动清除缓存时间'),
              text: () => <div class="w-88">{$t('清除过去指定时间内未使用窗口的缓存数据')}</div>,
              name: 'clearCachePeriod',
              value: data?.clearCachePeriod ?? 30,
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'autoClearCache')?.value,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                const oldValue = item.value
                return (
                  <IconField class="w-25">
                    <InputNumber
                      {...item.props}
                      {...props}
                      name={item.name}
                      useGrouping={false}
                      fluid
                      min={0}
                      max={100}
                      onValueChange={() => {
                        if (oldValue !== item.value) {
                          saveUserConfig(item)
                        }
                      }}
                    />
                    <InputIcon class="pt-0.5">{$t('天')}</InputIcon>
                  </IconField>
                )
              },
            },
          ],
        },
        {
          subtitle: $t('本地设置'),
          items: [
            {
              label: $t('系统日志'),
              name: 'systemLogDir',
              value: '',
              component: () => {
                return (
                  <RxButton
                    severity="secondary"
                    outlined
                    onClick={() => globalThis.electronAPI.send('app:showLogDir')}
                  >
                    {$t('查看详情')}
                  </RxButton>
                )
              },
            },
            {
              label: $t('内存限制'),
              name: 'memoryLimit',
              value: data?.memoryLimit ?? '',
              text: () => (
                <div class="w-88">
                  {$t('内存使用达到设置的阈值时，将停止打开浏览器窗口')}
                </div>
              ),
              component: ({ item, ...props }: { item: Items, props: any }) => {
                const oldValue = item.value
                return (
                  <div class="flex">
                    <IconField class="w-16">
                      <InputNumber
                        {...item.props}
                        {...props}
                        name={item.name}
                        useGrouping={false}
                        fluid
                        min={0}
                        max={100}
                        onValueChange={() => {
                          if (oldValue !== item.value) {
                            saveUserConfig(item)
                          }
                        }}
                      />
                      <InputIcon class="pt-0.5">%</InputIcon>
                    </IconField>
                  </div>
                )
              },
            },
            {
              label: $t('自定义书签'),
              name: 'bookText',
              text: $t('仅支持.html 格式，最多 {count} 个 URL\n窗口偏好设置中开启“自定义书签”功能生效', { count: MaximumLimitExceeded.MAX_BOOKMARK_COUNT }),
              value: data?.bookText,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <UploadBookmarks
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
          subtitle: $t('行为设置'),
          items: [
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
              label: $t('开机自启动'),
              text: () => (
                <div class="w-88">
                  {$t(
                    '开机时是否自动启动客户端',
                  )}
                </div>
              ),
              name: 'autoStart',
              value: data?.autoStart ?? true,
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
              label: $t('自动更新内核'),
              text: () => (<div class="w-88">{$t('已下载的内核在未使用时将会自动更新')}</div>),
              name: 'autoUpdateKernel',
              value: data?.autoUpdateKernel ?? false,
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
      ],
    })

    return items
  }

  return {
    getPreferencesPanels,
  }
}
