import { $t } from '/@/locales'

export function getOperation() {
  return [
    {
      name: 'restore',
      label: $t('恢复'),
      icon: 'base/rx_ic_refresh',
      iconClass: 'text-gray-500',
      quick: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: $t('彻底删除'),
      icon: 'base/rx_ic_shredder',
      iconClass: 'text-red',
      quick: true,
      multiple: true,
    },
  ]
}

export default {
  getOperation,
}
