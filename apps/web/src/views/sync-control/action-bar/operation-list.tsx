import ToggleSwitch from "primevue/toggleswitch";
import { $t } from "/@/locales";

export function getOperationList(formData: Recordable) {
  return [
    {
      label: $t('窗口布局'),
      icon: 'base/rx_ic_layout',
      items: [
        {
          label: $t('宫格布局'),
        },
        {
          label: $t('堆叠布局'),
        },
        {
          separator: true
        },
        {
          label: $t('自定义布局'),
        },
      ]
    },
    {
      label: $t('批量输入'),
      icon: 'base/rx_ic_keyboard'
    },
    {
      label: $t('标签控制'),
      icon: 'base/rx_ic_tabs',
      items: [
        {
          label: $t('统一页签'),
        },
        {
          label: $t('关闭其他标签页'),
        },
        {
          label: $t('关闭当前标签页'),
        },
        {
          label: $t('关闭空白页签'),
        },
        {
          separator: true
        },
        {
          label: $t('打开网址'),
        },
      ]
    },
    {
      label: $t('偏好设置'),
      icon: 'base/rx_ic_finger_tap',
      items: [
        {
          label: $t('点击延迟'),
          labelTip: $t('点击延迟'),
          suffix: () => <ToggleSwitch v-model={formData.clickDelayInterval} />
        },
        {
          label: $t('输入延迟'),
        },
      ]
    }
  ]
}
