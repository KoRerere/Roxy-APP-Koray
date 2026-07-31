import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import { defineComponent, onUnmounted, Teleport, watch } from 'vue'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import FolderDirectory from '../folder-directory.vue'
import DiskOverview from '../disk-overview.vue'
import UploadBookmarks from '../upload-bookmarks.vue'
import SimulationShortcut from '../simulation-shortcut.vue'
import ClearCache from '/@/layout/components/header/profile/components/settings-popup/components/clear-cache.vue'
import RxTooltip from '/@/components/rx-tooltip'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ClearType, RestoreWindowNetworkChange, TaskbarIconDisplay, TaskbarTabDisplay, UaStrictMode } from '/@/enums'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { DEFAULT_SIMULATION_DELAY, DEFAULT_SIMULATION_DELAY_RANGE, DEFAULT_SIMULATION_ENABLE, DEFAULT_SIMULATION_HUMAN_NOISE, DEFAULT_SIMULATION_SHORTCUT_KEYS } from '/@/constants/simulation-default'
import { isDev, isLinux, isWindows } from '/@/utils/common'
import { supportsApp4_0_0 } from '/@/utils/app-supports'
import { MaximumLimitExceeded } from './index'
import { getColorSchemeList } from '/@/stores/theme'
import { getImage, isEmptyValue, isObject } from '/@/utils'
import { createProfileEntityLabels, useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useRouteContext } from '/@/composables/useRouteContext'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'

const SIMULATION_DELAY_RANGE_KEY = 'delayRange'

const TASK_BAR_SETTING_TOOLTIP_CLASS = '!bg-[var(--colors-background-bg-overlay)] !border-[0.5px] !border-[var(--colors-border-border-base)] !shadow-[0px_3px_8px_0px_rgba(0,0,0,0.07),0px_2px_5px_0px_rgba(0,0,0,0.07),0px_1px_1px_0px_rgba(0,0,0,0.07)]'

const TASK_BAR_PREVIEW_IMAGE_MAX_STYLE = {
  maxWidth: '480px',
  maxHeight: '360px',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
} as const

const taskbarPreviewImageSrc = ref<string | null>(null)

function openTaskbarImagePreview(src: string, hideTooltip: () => void) {
  taskbarPreviewImageSrc.value = src
  hideTooltip()
}

function closeTaskbarImagePreview() {
  taskbarPreviewImageSrc.value = null
}

export const TaskbarImagePreviewHost = defineComponent({
  name: 'TaskbarImagePreviewHost',
  setup() {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape')
        closeTaskbarImagePreview()
    }

    watch(taskbarPreviewImageSrc, (src) => {
      if (src)
        window.addEventListener('keydown', onKeydown)
      else
        window.removeEventListener('keydown', onKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeydown)
      closeTaskbarImagePreview()
    })

    return () => {
      if (!taskbarPreviewImageSrc.value)
        return null

      return (
        <Teleport to="body">
          <div
            class="fixed inset-0 z-[5001] flex items-center justify-center bg-black/50"
            onClick={closeTaskbarImagePreview}
          >
            <img
              src={taskbarPreviewImageSrc.value}
              style={TASK_BAR_PREVIEW_IMAGE_MAX_STYLE}
              class="rounded-lg"
              onClick={(event: Event) => event.stopPropagation()}
            />
          </div>
        </Teleport>
      )
    }
  },
})

function TaskbarSettingPreviewImage({ src, onPreview }: { src: string, onPreview: (src: string) => void }) {
  return (
    <div
      class="group relative h-[108px] w-full cursor-pointer overflow-hidden rounded-lg"
      onClick={(event: Event) => {
        event.stopPropagation()
        onPreview(src)
      }}
    >
      <img src={src} class="h-full w-full object-cover" alt="" />
      <div class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
        <RxSvgIcon name="base/rx_ic_eye" size="24" class="text-white opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  )
}

function resolveTaskbarIconDisplay(data?: { taskbarIconDisplay?: string }) {
  if (data?.taskbarIconDisplay === TaskbarIconDisplay.windowNum || data?.taskbarIconDisplay === TaskbarIconDisplay.windowName)
    return data.taskbarIconDisplay

  return TaskbarIconDisplay.windowName
}

function resolveTaskbarTabDisplay(data?: { taskbarTabDisplay?: string }) {
  if (data?.taskbarTabDisplay === TaskbarTabDisplay.tabTitle || data?.taskbarTabDisplay === TaskbarTabDisplay.windowName)
    return data.taskbarTabDisplay

  return TaskbarTabDisplay.windowName
}

function TaskbarIconDisplayTooltipContent({ onHideTooltip }: { onHideTooltip: () => void }) {
  const profileLabels = useProfileEntityLabels()
  const handlePreview = (src: string) => openTaskbarImagePreview(src, onHideTooltip)

  return (
    <div class="flex flex-col gap-3 w-[258px]">
      <div class="text-3 leading-[19.2px] text-[var(--colors-text-text-primary)]">
        {$t('设置 Windows 任务栏中浏览器图标显示的内容')}
      </div>
      <div class="flex gap-2.5">
        <div class="flex flex-col gap-1 items-start w-[116px]">
          <TaskbarSettingPreviewImage src={getImage('settings/task-icon-window-num.jpg')} onPreview={handlePreview} />
          <span class="text-3 leading-5 text-[var(--colors-text-text-primary)]">{profileLabels.value.entityNum}</span>
        </div>
        <div class="flex flex-col gap-1 items-start w-[116px]">
          <TaskbarSettingPreviewImage src={getImage('settings/task-icon-window-name.jpg')} onPreview={handlePreview} />
          <span class="text-3 leading-5 text-[var(--colors-text-text-primary)]">{profileLabels.value.entityDisplayName}</span>
        </div>
      </div>
    </div>
  )
}

function TaskbarTabDisplayTooltipContent({ onHideTooltip }: { onHideTooltip: () => void }) {
  const profileLabels = useProfileEntityLabels()
  const handlePreview = (src: string) => openTaskbarImagePreview(src, onHideTooltip)

  return (
    <div class="flex flex-col gap-3 w-[258px]">
      <div class="text-3 leading-[19.2px] text-[var(--colors-text-text-primary)]">
        {$t('设置 Windows 任务栏中浏览器图标悬停提示显示的内容')}
      </div>
      <div class="flex gap-2.5">
        <div class="flex flex-col gap-1 items-start w-[116px]">
          <TaskbarSettingPreviewImage src={getImage('settings/task-label-tab-name.jpg')} onPreview={handlePreview} />
          <span class="text-3 leading-5 text-[var(--colors-text-text-primary)]">{$t('当前标签页名称')}</span>
        </div>
        <div class="flex flex-col gap-1 items-start w-[116px]">
          <TaskbarSettingPreviewImage src={getImage('settings/task-label-window-name.jpg')} onPreview={handlePreview} />
          <span class="text-3 leading-5 text-[var(--colors-text-text-primary)]">{profileLabels.value.entityName}</span>
        </div>
      </div>
    </div>
  )
}

export function usePreferencesPanel() {
  const { saveUserConfig, saveLocalConfig } = useCommonUtil()
  const { isEcommerce } = useRouteContext()

  const getPreferencesPanels = async (data?: any) => {
    const profileLabels = createProfileEntityLabels(isEcommerce.value)
    const [softConfig, disk, searchEngineResult] = await Promise.all([
      globalThis.electronAPI.send('app:getSoftConfig'),
      globalThis.electronAPI.send('app:getRoxyCacheDiskInfo'),
      API.platform.userGetSearchEnginesList(),
    ])

    const proxyInfoText = data?.quickCreateProxyTemplate ?? ''

    let searchEngineOptions: { label: string, value: string, image: string }[] = []
    if (searchEngineResult.code === 0 && searchEngineResult.data) {
      searchEngineOptions = searchEngineResult.data.map((item: any) => ({
        label: item.code,
        value: item.code,
        image: item.icon,
      }))
    }

    const simulation: Record<string, any> = {
      enable: DEFAULT_SIMULATION_ENABLE,
      humanNoise: DEFAULT_SIMULATION_HUMAN_NOISE,
      delayRange: [...DEFAULT_SIMULATION_DELAY_RANGE],
      shortcutKey: DEFAULT_SIMULATION_SHORTCUT_KEYS,
      ...(isObject(data.simulation) ? data.simulation : {}),
    }

    if (!Array.isArray(simulation[SIMULATION_DELAY_RANGE_KEY]) || simulation[SIMULATION_DELAY_RANGE_KEY].length < 2) {
      const fallbackMin = simulation.delay ?? DEFAULT_SIMULATION_DELAY
      const fallbackMax = simulation.delay ?? DEFAULT_SIMULATION_DELAY_RANGE[1]
      simulation[SIMULATION_DELAY_RANGE_KEY] = [fallbackMin, fallbackMax]
    }

    const isAutoUpdateOnLaunchLocal = supportsApp4_0_0()

    const items = reactive<SettingsModule>({
      title: $t('软件设置'),
      description: $t('设置您的客户端使用偏好'),
      list: [
        {
          subtitle: profileLabels.settingsPanelSubtitle,
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
                  {profileLabels.openWorkbenchWhenOpen}
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
                  <div>{profileLabels.googleLoginEnableDesc}</div>
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
              text: profileLabels.searchEngineWhenOpen,
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
            {
              label: () => (
                <div class="flex items-center gap-1">
                  <span>{$t('任务栏图标显示')}</span>
                  <RxTooltip
                    placement="top"
                    tooltipContentClass={TASK_BAR_SETTING_TOOLTIP_CLASS}
                  >
                    {{
                      default: () => <RxSvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />,
                      content: ({ hide }: { hide: () => void }) => <TaskbarIconDisplayTooltipContent onHideTooltip={hide} />,
                    }}
                  </RxTooltip>
                </div>
              ),
              text: $t('Chrome 内核暂时仅 148 及以上版本支持'),
              name: 'taskbarIconDisplay',
              hide: () => isLinux,
              value: resolveTaskbarIconDisplay(data),
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  { label: profileLabels.entityNum, value: TaskbarIconDisplay.windowNum },
                  { label: profileLabels.entityName, value: TaskbarIconDisplay.windowName },
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
              label: () => (
                <div class="flex items-center gap-1">
                  <span>{$t('任务栏标签显示')}</span>
                  <RxTooltip
                    placement="top"
                    tooltipContentClass={TASK_BAR_SETTING_TOOLTIP_CLASS}
                  >
                    {{
                      default: () => <RxSvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />,
                      content: ({ hide }: { hide: () => void }) => <TaskbarTabDisplayTooltipContent onHideTooltip={hide} />,
                    }}
                  </RxTooltip>
                </div>
              ),
              name: 'taskbarTabDisplay',
              value: resolveTaskbarTabDisplay(data),
              hide: () => !isWindows,
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  { label: $t('当前标签页名称'), value: TaskbarTabDisplay.tabTitle },
                  { label: profileLabels.entityName, value: TaskbarTabDisplay.windowName },
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
              label: $t('批量打开布局'),
              text: profileLabels.batchOpenLayoutDesc,
              name: 'batchOpenLayout',
              value: data?.batchOpenLayout ?? 'stack',
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  { label: $t('堆叠'), value: 'stack' },
                  { label: $t('网格'), value: 'grid' },
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
          ],
        },
        {
          subtitle: $t('快速创建'),
          hide: () => !isDev,
          items: [
            {
              label: $t('每次显示配置弹窗'),
              name: 'quickCreateModalSwitch',
              value: data?.quickCreateModalSwitch ?? true,
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
              label: $t('代理配置'),
              name: 'quickCreateProxyTemplate',
              classes: 'flex-col !items-start gap-2',
              value: proxyInfoText,
              oldValue: proxyInfoText,
              vaildator: (item: Items) => item.oldValue !== item.value,
              props: {
                size: 'md',
                rows: 4,
                class: 'resize-none w-full',
                placeholder: $t('示例（刷新 URL 与备注为选填）:\n192.168.0.1:8000:用户名:密码[刷新 URL]{notes}\n用户名:密码{at}192.168.0.1:8000[刷新 URL]{notes}', { at: '@', notes: `{${$t('备注')}}` }),
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <TsFormInputTextarea
                    {...item.props}
                    {...props}
                    class="w-full"
                    onBlur={() => saveUserConfig(item)}
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
              label: $t('人类噪音'),
              text: $t('模拟人类输入时的随机停顿和错误（仅支持 145+ 内核）'),
              name: 'simulation',
              value: !!simulation.humanNoise,
              props: {
                trueValue: true,
                falseValue: false,
              },
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'simulation')?.value,
              formatValue: (item: Items) => {
                simulation.humanNoise = item.value
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
              label: $t('输入延迟区间'),
              name: 'simulation',
              value: [...simulation[SIMULATION_DELAY_RANGE_KEY]],
              text: $t('设置粘贴时每个字符键入的随机延迟区间'),
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === 'simulation')?.value,
              formatValue: (item: Items) => {
                simulation[SIMULATION_DELAY_RANGE_KEY] = [...item.value]
                delete simulation.delay
                return simulation
              },
              component: ({ item }: { item: Items, props: any }) => {
                const oldValue = [...item.value]

                const saveDelayConfig = () => {
                  if (oldValue[0] !== item.value[0] || oldValue[1] !== item.value[1]) {
                    saveUserConfig(item)
                  }
                }

                return (
                  <div class="flex items-center gap-[8px] self-stretch">
                    <IconField class="w-[92px]">
                      <InputNumber
                        modelValue={item.value[0]}
                        min={0}
                        useGrouping={false}
                        fluid
                        size="small"
                        onValueChange={(val) => {
                          console.debug('min value change: ', val, item.value) // debug log
                          if (val >= item.value[1]) {
                            item.value[1] = val + 1
                          }
                          item.value[0] = val
                          saveDelayConfig()
                        }}
                      />
                      <InputIcon>ms</InputIcon>
                    </IconField>
                    <div class="text-5 tt-inactive">~</div>
                    <IconField class="w-[92px]">
                      <InputNumber
                        modelValue={item.value[1]}
                        min={1}
                        useGrouping={false}
                        fluid
                        size="small"
                        onValueChange={(val) => {
                          console.debug('max value change: ', val, item.value) // debug log
                          if (val <= item.value[0]) {
                            item.value[0] = Math.max(2, val - 1)
                          }
                          item.value[1] = val
                          saveDelayConfig()
                        }}
                      />
                      <InputIcon>ms</InputIcon>
                    </IconField>
                  </div>
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
                <div class="w-88">{profileLabels.stopOpenWhenDiskLow}</div>
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
                          nextTick(() => {
                            if (isEmptyValue(item.value))
                              item.value = 8
                            if (oldValue !== item.value) {
                              saveUserConfig(item)
                            }
                          })
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
                    tooltip: profileLabels.clearCachePartialTooltipPlain,
                  },
                  {
                    label: $t('清除本地缓存'),
                    value: ClearType.all,
                    tooltip: profileLabels.clearCacheAllTooltipPlain,
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
              text: () => <div class="w-88">{profileLabels.clearUnusedEntityCacheDesc}</div>,
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
                        nextTick(() => {
                          if (isEmptyValue(item.value))
                            item.value = 30
                          if (oldValue !== item.value) {
                            saveUserConfig(item)
                          }
                        })
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
                  {profileLabels.stopOpenWhenMemoryLow}
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
              text: $t('支持 Chrome / Firefox 导出的 .html 格式，最多 {count} 个 URL\n{pref}', { count: MaximumLimitExceeded.MAX_BOOKMARK_COUNT, pref: profileLabels.customBookmarksPreferenceDesc }),
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
              label: profileLabels.autoRestoreEntity,
              text: profileLabels.autoRestoreEntityDesc,
              name: 'autoRestoreWindow',
              value: data?.autoRestoreWindow ?? 2,
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  { label: $t('弹出提示'), value: 2 },
                  { label: $t('开启'), value: 1 },
                  { label: $t('关闭'), value: 0 },
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
              label: $t('客户端网络变化提示'),
              text: profileLabels.restoreEntityNetworkChangeDesc,
              name: 'restoreWindowNetworkChange',
              value: data?.restoreWindowNetworkChange ?? RestoreWindowNetworkChange.Prompt,
              hide: (_item, items) => {
                const autoRestoreWindow = items.find(i => i.name === 'autoRestoreWindow')?.value ?? data?.autoRestoreWindow ?? 2
                return autoRestoreWindow === 0
              },
              props: {
                filter: false,
                optionValue: 'value',
                options: [
                  { label: $t('弹出提示'), value: RestoreWindowNetworkChange.Prompt },
                  { label: profileLabels.continueRestoreEntity, value: RestoreWindowNetworkChange.Continue },
                  { label: profileLabels.abortRestoreEntity, value: RestoreWindowNetworkChange.Abort },
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
              value: data?.autoStart ?? false,
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
              label: $t('自动更新客户端'),
              hide: () => !isWindows,
              text: () => (
                <div class="w-88">
                  {$t(
                    '客户端启动时，自动安装已下载的最新版本',
                  )}
                </div>
              ),
              name: isAutoUpdateOnLaunchLocal ? 'autoUpdateAppOnLaunch' : 'autoUpdateApp',
              value: isAutoUpdateOnLaunchLocal
                ? (softConfig?.autoUpdateAppOnLaunch ?? softConfig?.autoUpdateApp ?? true)
                : (data?.autoUpdateApp ?? softConfig?.autoUpdateApp ?? true),
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <RxToggleSwitch
                    {...item.props}
                    {...props}
                    onChange={() => (isAutoUpdateOnLaunchLocal ? saveLocalConfig(item) : saveUserConfig(item))}
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
