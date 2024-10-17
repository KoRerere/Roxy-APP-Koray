import { $t } from '/@/locales'

export function getSorts(params: any = {}) {
  return [
    {
      label: $t('Sort by'),
      placeholder: $t('please select sorting rules'),
      name: 'orderName',
      value: params.orderName ?? 'createTime',
      options: [
        { label: $t('creation time'), value: 'createTime' },
        { label: $t('modify time'), value: 'updateTime' },
        { label: $t('last opening time'), value: 'openTime' },
        { label: $t('last closure time'), value: 'closeTime' },
        { label: $t('agent detection time'), value: 'checkTime' },
        { label: $t('window serial number'), value: 'windowSortNum' },
        { label: $t('window name'), value: 'name' },
        { label: $t('nation'), value: 'lastCountry' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
    {
      label: $t('Order'),
      placeholder: $t('please select sort type'),
      name: 'orderType',
      value: params.orderType ?? 'desc',
      options: [
        { label: $t('desc'), value: 'desc' },
        { label: $t('asc'), value: 'asc' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
  ]
}

export function getOperation() {
  return [
    {
      name: 'restore',
      label: $t('Restore'),
      icon: 'base/rx_ic_refresh',
      classes: 'text-gray-500',
      quick: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: $t('Delete Permanently'),
      icon: 'base/rx_ic_bin_1',
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
