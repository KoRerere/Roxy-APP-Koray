import ToggleSwitch from "primevue/toggleswitch";
import { $t } from "/@/locales";
import { useToast } from "primevue/usetoast";
import type { PreferenceSettings } from "../model";
import type { Ref } from 'vue';

export function getOperationList(formData: Ref<PreferenceSettings>) {
  const toast = useToast();

  return [
    {
      label: $t('窗口布局'),
      icon: 'base/rx_ic_layout',
      items: [
        {
          label: $t('宫格布局'),
          command: () => {
            electronAPI.send('syncControl:doLayout', { type: 'grid' })
          }
        },
        {
          label: $t('堆叠布局'),
          command: () => {
            electronAPI.send('syncControl:doLayout', { type: 'stack' })
          }
        },
        {
          separator: true
        },
        {
          label: $t('自定义'),
          command: () => {
            electronAPI.send('syncControl:openPreferencesDialog', { tab: 'customLayout' });
          }
        },
      ]
    },
    {
      label: $t('批量输入'),
      icon: 'base/rx_ic_keyboard',
      command: () => {
        electronAPI.send('syncControl:openBatchInputsDialog');
      }
    },
    {
      label: $t('标签控制'),
      icon: 'base/rx_ic_tabs',
      items: [
        // {
        //   label: $t('统一页签'),
        //   command: () => {
        //     electronAPI.send('syncControl:unifyTabs')
        //   }
        // },
        {
          label: $t('关闭其他标签页'),
          command: () => {
            electronAPI.send('syncControl:closeOtherTabs')
          }
        },
        {
          label: $t('关闭当前标签页'),
          command: () => {
            electronAPI.send('syncControl:closeCurrentTab')
          }
        },
        {
          label: $t('关闭空白页签'),
          command: () => {
            electronAPI.send('syncControl:closeBlankTabs')
          }
        },
        {
          separator: true
        },
        {
          label: $t('打开网址'),
          command: () => {
            electronAPI.send('syncControl:openOpenSitesDialog')
          }
        },
      ]
    },
    {
      label: $t('仿真操作'),
      icon: 'base/rx_ic_finger_tap',
      items: [
        {
          label: $t('点击延迟'),
          labelTip: $t('点击延迟'),
          suffix: () => <ToggleSwitch v-model={formData.value.simulate.enableClickDelay} />,
        },
        {
          label: $t('输入延迟'),
          suffix: () => <ToggleSwitch v-model={formData.value.simulate.enableInputDelay} />,
        },
        {
          separator: true
        },
        {
          label: $t('仿真参数设置'),
          command: () => {
            electronAPI.send('syncControl:openPreferencesDialog', { tab: 'simulate' });
          }
        },
      ]
    }
  ]
}
