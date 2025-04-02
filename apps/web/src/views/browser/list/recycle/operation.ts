import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'

const { isViewer } = storeToRefs(useRoleStore())

export function getOperation() {
  return [
    {
      name: 'restore',
      label: $t('恢复'),
      tooltip: $t('恢复窗口'),
      icon: 'base/rx_ic_refresh',
      iconClass: 'text-gray-500',
      power: !isViewer.value,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'one',
      },
    },
    {
      name: 'delete',
      label: $t('彻底删除'),
      tooltip: $t('彻底删除'),
      icon: 'base/rx_ic_shredder',
      iconClass: 'text-red',
      power: !isViewer.value,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'one',
      },
    },
  ]
}

export default {
  getOperation,
}
