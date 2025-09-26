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
        name: 'G1',
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
        name: 'G1',
      },
    },
  ]
}

export function getAdvancedSearch() {
  return [
    {
      key: 'name',
      label: $t('窗口名称'),
      icon: 'base/rx_ic_browser',
      syntax: 'name::'
    },
    {
      key: 'remark',
      label: $t('备注'),
      icon: 'base/rx_ic_doc_article',
      syntax: 'note::'
    },
    {
      key: 'tag',
      label: $t('标签'),
      icon: 'base/rx_ic_tag',
      syntax: 'tag::'
    },
    {
      key: 'sortNum',
      label: ' ID',
      icon: 'base/rx_ic_id',
      syntax: 'id::'
    }
  ]
}

export default {
  getOperation,
  getAdvancedSearch
}
