import { $t } from '/@/locales'

export function getSorts(_params: any = {}) {
  return []
}

export function getOperation() {
  return [
    {
      name: 'restore',
      label: $t('恢复'),
      icon: 'base/rx_ic_refresh',
      classes: 'text-gray-500',
      quick: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: $t('彻底删除'),
      icon: 'base/rx_ic_shredder',
      classes: 'text-red',
      quick: true,
      multiple: true,
    },
  ]
}

export default {
  getSorts,
  getOperation,
}
